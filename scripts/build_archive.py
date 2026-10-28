#!/usr/bin/env python3
"""Ingest an ÆRIEL Archive Studio export into aeriel.xyz.

    python3 scripts/build_archive.py \
        --export  "~/…/000 ÆRIEL/Photos archive website/aeriel-site-data" \
        --sqlite  "~/…/000 ÆRIEL/Photos archive website/AER_Archive/archive.sqlite" \
        [--translate] [--check]

What it does, in order:

1. Reads archive_export.json (schemaVersion 1).
2. Consent and visibility gate. With --sqlite, every photo is re-checked against the
   database: it must be `Public Web`, must not need anonymization, and its consent must
   not be pending, declined or revoked. Anything that fails is dropped and reported.
3. Obfuscation. Spaces marked obfuscated in the Studio keep only their type and neighborhood; their name, address
   and coordinates are never written. Other spaces keep their street address (coordinates are not needed).
   Spaces marked obfuscated keep only their type and neighborhood ("Private home · Brasil").
   Sensitive person fields (custom fields marked sensitive) are never read.
4. Supplements what the export leaves out, from SQLite: organizations and memberships of the
   people in the published photos (public columns only), and the 128-colour palette.
5. Syncs images: copies images/<code>.webp and thumbs/<code>.webp into assets/archive/,
   verifies every catalog code resolves to both, and deletes files whose photo has left the
   export, so a takedown in the Studio reaches the site on the next build.
6. Localizes dates (en/es/pt) and translates narrative text (captions, photographer notes,
   bios, org history/ethos, context notes) through data/translations.json. Missing
   translations are created with the Anthropic API when --translate is set and
   ANTHROPIC_API_KEY is present; proper nouns (people, houses, events, series, venues,
   Æ000.X codes) are swapped for placeholder tokens first, so they can never be translated.
7. Writes data/archive.json for the page.

Standard library only (Python 3.9+). --check validates and reports without writing anything.
"""
import argparse, hashlib, json, os, re, shutil, sqlite3, struct, sys, unicodedata, urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JSON = os.path.join(ROOT, "data", "archive.json")
TAXONOMY = os.path.join(ROOT, "data", "taxonomy.i18n.json")
CACHE = os.path.join(ROOT, "data", "translations.json")
ASSETS = os.path.join(ROOT, "assets", "archive")
LANGS = ("en", "es", "pt")
LANG_NAME = {"en": "English", "es": "Latin American Spanish (Chile)", "pt": "Brazilian Portuguese"}

CITY_ALIASES = {"Santiago de Chile": "Santiago", "SP": "São Paulo", "Sao Paulo": "São Paulo"}
BLOCKED_CONSENT = ("pending", "revoked", "takedown", "declin", "refus", "withdraw", "do not")
HOUSE_TYPES = ("house",)

warnings = []
def warn(msg): warnings.append(msg)

def slug(s):
    s = (s or "").replace("Æ", "AE").replace("æ", "ae")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "x"

class Keys:
    """Stable, unique URL slugs per entity kind."""
    def __init__(self): self.by_id, self.used = {}, {}
    def get(self, kind, ident, label):
        k = (kind, ident)
        if k not in self.by_id:
            base, n = slug(label), 2
            cand = base
            while cand in self.used.setdefault(kind, set()):
                cand = f"{base}-{n}"; n += 1
            self.used[kind].add(cand); self.by_id[k] = cand
        return self.by_id[k]

# ---------- dates ----------
MONTHS = {
    "en": "January February March April May June July August September October November December".split(),
    "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(),
    "pt": "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(),
}
def date_display(iso, year, month, precision):
    out = {}
    exact = precision == "Exact"
    for l in LANGS:
        if iso and exact:
            y, m, d = (int(x) for x in iso.split("-"))
            out[l] = f"{d} {MONTHS[l][m-1]} {y}" if l == "en" else f"{d} de {MONTHS[l][m-1]} de {y}"
        elif year:
            mm = f"{MONTHS[l][month-1]} " if month else ""
            if l != "en" and month: mm = f"{MONTHS[l][month-1]} de "
            out[l] = ("c. " if not exact else "") + f"{mm}{year}"
        else:
            out[l] = None
    return out if any(out.values()) else None

# ---------- images ----------
def webp_size(path):
    with open(path, "rb") as f: h = f.read(40)
    if h[:4] != b"RIFF" or h[8:12] != b"WEBP": raise ValueError("not a webp")
    c = h[12:16]
    if c == b"VP8 ": w, hh = struct.unpack("<HH", h[26:30]); return w & 0x3FFF, hh & 0x3FFF
    if c == b"VP8L":
        b = h[21:25]; v = int.from_bytes(b, "little"); return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    if c == b"VP8X": return int.from_bytes(h[24:27], "little") + 1, int.from_bytes(h[27:30], "little") + 1
    raise ValueError("unknown webp chunk")

def sha(path):
    m = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 16), b""): m.update(b)
    return m.hexdigest()

def sync_images(export_dir, photos, write):
    """Copy every published image + thumb; delete anything no longer published."""
    keep = {"images": set(), "thumbs": set()}
    resolved = {}
    for p in photos:
        code = p["catalogCode"]; entry = {}
        for kind, field in (("images", "image"), ("thumbs", "thumbnail")):
            src = os.path.join(export_dir, p.get(field) or f"{kind}/{code}.webp")
            if not os.path.isfile(src):
                warn(f"{code}: missing {kind} file {src}"); entry = None; break
            name = f"{code}.webp"; keep[kind].add(name)
            dst = os.path.join(ASSETS, kind, name)
            digest = sha(src)
            if write:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if not (os.path.isfile(dst) and sha(dst) == digest): shutil.copyfile(src, dst)
            w, h = webp_size(src)
            entry[kind] = {"src": f"assets/archive/{kind}/{name}?v={digest[:10]}", "w": w, "h": h}
        if entry: resolved[code] = entry
    removed = []
    for kind in keep:
        d = os.path.join(ASSETS, kind)
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f not in keep[kind]:
                    removed.append(f"{kind}/{f}")
                    if write: os.remove(os.path.join(d, f))
    return resolved, removed

# ---------- translation ----------
ES_WORDS = set("el la los las de del que y en es un una por para con su sus se al como fue".split())
EN_WORDS = set("the and of to in is a for with his her their on at was by".split())
PT_WORDS = set("o os as do da dos das que e em é um uma por para com seu sua no na foi ao".split())
def detect(text):
    w = re.findall(r"[a-záéíóúãõâêôç]+", text.lower())
    sc = {"en": sum(x in EN_WORDS for x in w), "es": sum(x in ES_WORDS for x in w), "pt": sum(x in PT_WORDS for x in w)}
    if re.search(r"[ãõç]|\bnão\b|\bvocê\b", text.lower()): sc["pt"] += 3
    if re.search(r"ñ|¿|¡|\bción\b", text.lower()): sc["es"] += 3
    return max(sc, key=sc.get)

class Translator:
    def __init__(self, use_api):
        self.cache = json.load(open(CACHE, encoding="utf-8")) if os.path.isfile(CACHE) else {}
        self.key = os.environ.get("ANTHROPIC_API_KEY") if use_api else None
        self.model = os.environ.get("ARCHIVE_TRANSLATE_MODEL", "claude-sonnet-5-5")
        self.protected = set()
        self.used = set()
        self.dirty = False

    def protect(self, *terms):
        for t in terms:
            if t and len(t.strip()) > 2: self.protected.add(t.strip())

    def _mask(self, text):
        toks = []
        terms = sorted(self.protected, key=len, reverse=True)
        pat = "|".join(re.escape(t) for t in terms) if terms else None
        def sub(m):
            toks.append(m.group(0)); return f"⟦{len(toks)-1}⟧"
        masked = re.sub(pat, sub, text) if pat else text
        masked = re.sub(r"Æ\d+(?:\.[0-9X]+)?", sub, masked)
        return masked, toks

    def _api(self, text, src, dst):
        masked, toks = self._mask(text)
        prompt = (f"Translate this archive text from {LANG_NAME[src]} into {LANG_NAME[dst]}. "
                  "It is from a queer nightlife and ballroom photography archive; keep its register, "
                  "markdown and line breaks. Copy every token like ⟦3⟧ exactly, once, unchanged: they are "
                  "names that must not be translated. Keep English ballroom titles (Father, Icon, Legendary) as written. "
                  "Reply with the translation only.\n\n" + masked)
        body = json.dumps({"model": self.model, "max_tokens": 8000,
                           "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", body, {
            "content-type": "application/json", "x-api-key": self.key, "anthropic-version": "2023-06-01"})
        with urllib.request.urlopen(req, timeout=120) as r:
            out = "".join(b.get("text", "") for b in json.load(r)["content"]).strip()
        for i, t in enumerate(toks):
            if out.count(f"⟦{i}⟧") != 1: raise ValueError(f"protected term {t!r} was altered")
            out = out.replace(f"⟦{i}⟧", t)
        return out

    def __call__(self, text, where):
        if not text or not text.strip(): return None
        text = text.strip()
        h = hashlib.sha256(text.encode()).hexdigest()[:16]; self.used.add(h)
        e = self.cache.get(h)
        if not e:
            e = {"src": detect(text), "where": where, "text": text}; e[e["src"]] = text
            self.cache[h] = e; self.dirty = True
        for l in LANGS:
            if not e.get(l):
                if self.key:
                    try: e[l] = self._api(text, e["src"], l); self.dirty = True
                    except Exception as x: warn(f"translate {where} → {l}: {x}")
                else: warn(f"untranslated {where} → {l} (run with --translate)")
        return {"src": e["src"], **{l: e.get(l) for l in LANGS if e.get(l)}}

    def save(self):
        stale = [k for k in self.cache if k not in self.used]
        for k in stale: del self.cache[k]
        if self.dirty or stale:
            with open(CACHE, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=1, sort_keys=True); f.write("\n")

# ---------- sqlite ----------
def load_db(path):
    if not path: return None
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True); c.row_factory = sqlite3.Row
    db = {"photos": {r["catalog_code"]: dict(r) for r in c.execute(
              "SELECT catalog_code, consent_status, visibility_tier, anonymization_required, palette_128_json, frame_border_color_hex FROM photos")},
          "orgs": {r["id"]: dict(r) for r in c.execute(
              "SELECT id, org_name, short_name, org_type, founding_year, dissolution_year, lineage_parent_org_id, "
              "manifesto_or_ethos, history, associated_scenes_json, chapter_place FROM organizations")},
          "members": [dict(r) for r in c.execute(
              "SELECT person_id, org_id, role_title, joined_year, left_year, is_current FROM org_memberships")]}
    c.close(); return db

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", required=True)
    ap.add_argument("--sqlite")
    ap.add_argument("--translate", action="store_true")
    ap.add_argument("--check", action="store_true", help="validate only, write nothing")
    a = ap.parse_args()
    export_dir = os.path.expanduser(a.export)
    src = json.load(open(os.path.join(export_dir, "archive_export.json"), encoding="utf-8"))
    if src.get("schemaVersion") != 1: sys.exit(f"Unsupported schemaVersion {src.get('schemaVersion')}")
    db = load_db(os.path.expanduser(a.sqlite) if a.sqlite else None)
    if not db: warn("no --sqlite: consent re-check, organizations and 128-colour palettes are skipped")
    tax = json.load(open(TAXONOMY, encoding="utf-8"))
    T = Translator(a.translate)

    # Fields that never reach the site, whatever the export carries: identity, sexuality, health and private contact data.
    SENSITIVE = re.compile(r"gender|g[eé]nero|identi|sexual|orienta|pronoun|pronombre|birth|nacimiento|nascimento|\bage\b|\bedad\b|"
                           r"\bidade\b|address|direcci|domicilio|endere|phone|tel[eé]fono|telefone|whats|e-?mail|correo|\brut\b|"
                           r"\bdni\b|\bcpf\b|passport|pasaporte|passaporte|health|salud|sa[uú]de|medic|religi|immigra|migra|legal name|nombre legal|"
                           r"deadname|nombre muerto|private|privad|sensib|sensitiv", re.I)

    def public_attrs(attrs, where):
        """Custom fields marked "publish with the record", minus anything that looks sensitive. Long texts are translated."""
        out = {}
        for k, vals in (attrs or {}).items():
            if not k or SENSITIVE.search(k): continue
            vals = [v.strip() for v in (vals or []) if isinstance(v, str) and v.strip()]
            if vals: out[k] = [T(v, f"{where}:{k}") if len(v) > 60 else v for v in vals]
        return out or None

    def public_links(links):
        """Every social profile and website, https only; contact channels (email, phone, WhatsApp) never ship."""
        out = {}
        for platform, urls in (links or {}).items():
            if not platform or SENSITIVE.search(platform): continue
            keep = [u.strip() for u in (urls or []) if isinstance(u, str) and re.match(r"^https?://", u.strip(), re.I)]
            keep = ["https://" + u.split("://", 1)[1] for u in keep]
            if keep: out[platform.lower()] = list(dict.fromkeys(keep))
        return out or None
    K = Keys()

    people_src = {p["id"]: p for p in src["people"]}
    spaces_src = {s["id"]: s for s in src["spaces"]}
    events_src = {e["id"]: e for e in src["events"]}
    series_src = {s["id"]: s for s in src["series"]}
    orgs_src = {o["id"]: o for o in src.get("organizations", [])}

    # 2. consent + visibility gate
    photos = []
    for p in src["photos"]:
        code = p["catalogCode"]
        if db:
            r = db["photos"].get(code)
            if not r: warn(f"{code}: not in SQLite, dropped"); continue
            cs = (r["consent_status"] or "").lower()
            if r["visibility_tier"] != "Public Web" or r["anonymization_required"] or any(b in cs for b in BLOCKED_CONSENT):
                warn(f"{code}: dropped ({r['consent_status']} · {r['visibility_tier']})"); continue
        photos.append(p)

    # protected terms for translation
    for x in src["people"]: T.protect(x.get("name"), x.get("shortName"), x.get("aka"), x.get("givenName"), *x.get("aliases", []))
    for x in src["events"]: T.protect(x.get("title"), x.get("series"))
    for x in src["series"]: T.protect(x.get("name"))
    for x in src["spaces"]:
        if not x.get("locationObfuscated"): T.protect(x.get("name"))
    for x in photos: T.protect(x.get("venue"))
    if db:
        for o in db["orgs"].values(): T.protect(o["org_name"], o["short_name"])
    T.protect("ÆRIEL")

    out = {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "exportedAt": src.get("generatedAt"), "photos": [], "people": {}, "orgs": {},
           "events": {}, "series": {}, "spaces": {}}

    # organizations: export first, SQLite fills in
    def org_key(oid):
        if not oid: return None
        o = orgs_src.get(oid)
        row = db["orgs"].get(oid) if db else None
        if not o and not row: return None
        name = (o or {}).get("name") or row["org_name"]
        k = K.get("org", oid, name)
        if k not in out["orgs"]:
            out["orgs"][k] = None  # reserve (lineage recursion)
            typ = (o or {}).get("type") or (row or {}).get("org_type")
            parent = (row or {}).get("lineage_parent_org_id") or (o or {}).get("parentId")
            out["orgs"][k] = {k2: v for k2, v in {
                "name": name, "type": typ,
                "isHouse": bool(typ and any(t in typ.lower() for t in HOUSE_TYPES)),
                "founded": (o or {}).get("foundingYear") or (row or {}).get("founding_year"),
                "dissolved": (o or {}).get("dissolutionYear") or (row or {}).get("dissolution_year"),
                "parent": org_key(parent),
                "scenes": json.loads(row["associated_scenes_json"]) if row and row["associated_scenes_json"] else (o or {}).get("scenes"),
                "history": T((o or {}).get("history") or (row or {}).get("history"), f"org:{name}:history"),
                "ethos": T((o or {}).get("manifesto") or (row or {}).get("manifesto_or_ethos"), f"org:{name}:ethos"),
                "short": (o or {}).get("shortName"), "international": bool((o or {}).get("isInternational")) or None,
                "chapter": (o or {}).get("chapterPlace"), "attrs": public_attrs((o or {}).get("attributes"), f"org:{name}"),
            }.items() if v not in (None, [], "")}
        return k

    members = {}
    for m in (db["members"] if db else []) + src.get("memberships", []):
        pid = m.get("person_id") or m.get("personId"); oid = m.get("org_id") or m.get("orgId")
        members.setdefault(pid, []).append((oid, m.get("role_title") or m.get("role")))

    def person_key(pid):
        x = people_src.get(pid)
        if not x: warn(f"person {pid} missing from export"); return None
        label = x.get("shortName") or x.get("name")
        k = K.get("person", pid, label)
        if k in out["people"]: return k
        houses, free = [], []
        for scene in ("main", "kiki"):
            hid, hname = x.get(f"{scene}HouseId"), x.get(f"{scene}House")
            titles = x.get(f"{scene}SceneTitles") or []
            if hid and org_key(hid): houses.append({"org": org_key(hid), "scene": scene, "titles": titles})
            elif hname == "007": free.append(scene)
            elif hname: warn(f"{label}: {scene} house {hname!r} has no organization record")
        orgs, seen = [], {h["org"] for h in houses}
        for oid, role in members.get(pid, []):
            ok = org_key(oid)
            if ok and ok not in seen: orgs.append({"org": ok, "role": role}); seen.add(ok)
        links = public_links(x.get("links"))
        # Since Oct 2026 the export puts the shown alias (aka, already printed in the name) first in `aliases`;
        # ship only the other aliases, once each, so the page never repeats a name.
        skip = {(x.get("aka") or "").strip().lower(), (label or "").strip().lower(), (x.get("name") or "").strip().lower()}
        others = []
        for al in x.get("aliases") or []:
            low = (al or "").strip().lower()
            if low and low not in skip: others.append(al.strip()); skip.add(low)
        out["people"][k] = {k2: v for k2, v in {
            "name": label, "aka": x.get("aka"), "aliases": others or None,
            "houses": houses or None, "free": free or None, "orgs": orgs or None, "links": links,
            "pronouns": [v for v in x.get("pronouns") or [] if v in ("male", "female", "neutral")] or None,
            "attrs": public_attrs(x.get("attributes"), f"person:{label}"),
            "bio": T(x.get("bio"), f"person:{label}:bio")}.items() if v}
        return k

    def space_key(p):
        sid = p.get("spaceId"); s = spaces_src.get(sid)
        if s:
            private = bool(s.get("locationObfuscated"))
            hood = s.get("neighborhood") or s.get("givenName")
            label = f"private home {hood or ''}" if private else s["name"]
            k = K.get("space", sid, label)
            if k not in out["spaces"]:
                addr = None if private else (s.get("address") or "").strip()
                public_parts = {(s.get(f) or "").strip().lower() for f in ("name", "neighborhood", "city", "givenName", "country")}
                public_parts.add(CITY_ALIASES.get(s.get("city"), s.get("city") or "").lower())
                if addr and addr.lower() in public_parts: addr = None   # not a street address, just a place name
                out["spaces"][k] = {k2: v for k2, v in {
                    "name": None if private else s["name"], "private": private or None, "type": s.get("type"), "address": addr,
                    "hood": hood, "city": CITY_ALIASES.get(s.get("city"), s.get("city")), "country": s.get("country"),
                    "formerNames": s.get("formerNames") or None, "status": s.get("status") if s.get("status") != "Active" else None,
                    "attrs": None if private else public_attrs(s.get("attributes"), f"space:{label}"),
                }.items() if v}
            return k
        if p.get("venue"):
            k = K.get("space", "venue:" + p["venue"], p["venue"])
            out["spaces"].setdefault(k, {"name": p["venue"], "city": CITY_ALIASES.get(p.get("city"), p.get("city")), "country": p.get("country")})
            out["spaces"][k] = {k2: v for k2, v in out["spaces"][k].items() if v}
            return k
        return None

    def series_key(sid, depth=0):
        """A series and its parent chain (Type → parent series → series → edition → event)."""
        s = series_src.get(sid)
        if not s or depth > 10: return None
        sk = K.get("series", s["id"], s["name"])
        if sk not in out["series"]:
            out["series"][sk] = None  # reserve (parent recursion)
            out["series"][sk] = {k2: v for k2, v in {
                "name": s["name"], "type": s.get("type"),
                "events": s.get("events"),      # events in this series (child series not counted)
                "editions": s.get("editions"),  # editions with a published event (before Oct 2026 the export put the event count here)
                "parent": series_key(s.get("parentId"), depth + 1) if s.get("parentId") else None,
            }.items() if v}
        return sk

    def event_key(eid):
        e = events_src.get(eid)
        if not e: return None
        k = K.get("event", eid, e["title"])
        if k not in out["events"]:
            sk = series_key(e.get("seriesId")) if e.get("seriesId") else None
            out["events"][k] = {k2: v for k2, v in {
                "title": e["title"], "date": e.get("date"), "type": e.get("type"), "series": sk, "edition": e.get("edition"),
                "space": space_key({"spaceId": e.get("spaceId")}) if e.get("spaceId") else None,
                "sonic": e.get("sonicLandscape") or None, "categories": e.get("ballroomCategories") or None,
                "organizers": [o for o in (org_key(x.get("orgId")) if isinstance(x, dict) else None for x in e.get("organizers", [])) if o] or None,
                "crew": [{"p": person_key(x["personId"]), "role": x.get("role")} for x in e.get("organizers", [])
                         if isinstance(x, dict) and x.get("personId") and x["personId"] in people_src] or None,
                "attrs": public_attrs(e.get("attributes"), f"event:{e['title']}"),
            }.items() if v}
        return k

    resolved, removed = sync_images(export_dir, photos, write=not a.check)
    for r in removed: warn(f"removed unpublished image {r}")

    known_values = set(tax["values"])
    for p in sorted(photos, key=lambda x: x["catalogCode"]):
        code = p["catalogCode"]
        img = resolved.get(code)
        if not img: continue
        for f in ("medium", "frameType", "colorMode", "lighting", "timeOfDay", "pushPull", "license", "datePrecision"):
            if p.get(f) and p[f] not in known_values: warn(f"taxonomy: no translation for {f} value {p[f]!r}")
        for f in ("aestheticThemes", "bodyPresentation", "contentWarnings"):
            for v in p.get(f) or []:
                if v not in known_values: warn(f"taxonomy: no translation for {f} value {v!r}")
        sk = space_key(p); sp = out["spaces"].get(sk, {}) if sk else {}
        people = [{k2: v for k2, v in {"p": person_key(x["personId"]), "role": x.get("role"), "persona": x.get("persona"),
                   "look": x.get("lookCredit")}.items() if v} for x in p.get("people", []) if not p.get("peopleWithheld")]
        orgs = [{"org": org_key(x.get("orgId")), "note": T(x.get("contextNote"), f"{code}:org-note")} for x in p.get("organizations", []) if isinstance(x, dict)]
        palette, border = p.get("palette128") or [], p.get("frameBorderColor")
        if db and db["photos"].get(code):
            palette = palette or json.loads(db["photos"][code]["palette_128_json"] or "[]")
            border = border or db["photos"][code]["frame_border_color_hex"]
        # palette entries arrive as "#hex" strings or {hex, weight, …}; ship compact [hex, weight‰] pairs
        palette = [[c, None] if isinstance(c, str) else [c.get("hex"), round((c.get("weight") or 0) * 1000, 2)] for c in palette]
        palette = [c for c in palette if c[0]]
        if not palette: warn(f"{code}: no 128-colour palette")
        city = CITY_ALIASES.get(p.get("city"), p.get("city")) or sp.get("city")
        rec = {
            "code": code, "img": img["images"], "thumb": img["thumbs"], "ar": round(p.get("aspectRatio") or img["images"]["w"] / img["images"]["h"], 4),
            "people": [x for x in people if x.get("p")] or None,
            "orgs": [{k2: v for k2, v in o.items() if v} for o in orgs if o["org"]] or None,
            "event": event_key(p.get("eventId")), "space": sk,
            "hood": sp.get("hood"), "city": city, "country": p.get("country") or sp.get("country"),
            "date": p.get("sessionDate"), "year": p.get("year"),
            "dateText": date_display(p.get("sessionDate"), p.get("year"), p.get("month"), p.get("datePrecision")),
            "precision": p.get("datePrecision"),
            "medium": p.get("medium"), "camera": p.get("camera"), "stock": p.get("filmStock"),
            "frame": p.get("frameType"), "color": p.get("colorMode"), "light": p.get("lighting"),
            "time": p.get("timeOfDay"), "themes": p.get("aestheticThemes") or None, "body": p.get("bodyPresentation") or None,
            "process": p.get("pushPull"), "warnings": [w for w in p.get("contentWarnings") or [] if w != "Safe"] or None,
            "license": p.get("license"), "credit": p.get("creditLine"),
            "caption": T(p.get("caption"), f"{code}:caption"),
            "note": T(p.get("photographerIntent"), f"{code}:photographer-note"),
            "intent": T(p.get("artisticIntent"), f"{code}:artistic-intent"),
            "filmProcess": p.get("filmProcess"), "roll": p.get("rollOrPackId"), "frameNo": p.get("frameNumber"),
            "alter": p.get("physicalAlterations") or None,
            "sound": p.get("soundPairing") if re.match(r"^https://", p.get("soundPairing") or "") else None,
            "attrs": public_attrs(p.get("attributes"), code),
            "dominant": p.get("dominantColors") or None, "border": border, "palette": palette or None,
            # the rest of the Studio's colour profile: named colours with their share of the picture, the atmosphere
            # (the field) and accent (focal pops) colours, and the curatorial swatches (1–24) they fall under
            "named": [[c["name"], round(c.get("share") or 0, 3)] for c in p.get("colors") or [] if (c.get("share") or 0) >= 0.01] or None,
            "atm": [[c["hex"], round(c.get("weight") or 0, 4)] for c in p.get("atmosphereColors") or [] if c.get("hex")] or None,
            "acc": [[c["hex"], round(c.get("weight") or 0, 4)] for c in p.get("accentColors") or [] if c.get("hex")] or None,
            "swAtm": p.get("swatch24Atmosphere") or None, "swAcc": p.get("swatch24Accent") or None,
        }
        out["photos"].append({k: v for k, v in rec.items() if v not in (None, [], "")})

    # obfuscated spaces never leak, whatever the export contains; coordinates are never shipped at all
    blob = json.dumps(out, ensure_ascii=False)
    for bad in ('"latitude"', '"longitude"', '"lat"', '"lng"'):
        assert bad not in blob, f"{bad} written into archive.json"
    for s in spaces_src.values():
        if s.get("locationObfuscated"):
            for secret in (s.get("address"), s.get("givenName") if s.get("givenName") != s.get("neighborhood") else None):
                if secret and len(secret) > 3: assert secret not in blob, f"obfuscated space {s['id']} leaked {secret!r}"

    out["count"] = len(out["photos"])
    T.save() if not a.check else None
    if not a.check:
        os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
        with open(OUT_JSON, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":")); f.write("\n")

    print(f"{'Checked' if a.check else 'Built'} {out['count']} photos · {len(out['people'])} people · {len(out['orgs'])} organizations · "
          f"{len(out['events'])} events · {len(out['spaces'])} spaces")
    for w in dict.fromkeys(warnings): print("  !", w)

if __name__ == "__main__":
    main()
