#!/usr/bin/env python3
"""Perceptual colour engine for aeriel.xyz. Run after build_archive.py:

    python3 scripts/chroma.py            # reads data/archive.json, writes data/chroma.json

For every photo's 128 inner-frame colours (hex + weight ‰) it computes:

- OKLab / OKLCH coordinates, and one of the 24 curatorial swatches (18 chromatic along the OKLCH hue
  circle, 6 tonal): see nearest_swatch() for the rule.
- Atmosphere: the 5 heaviest distinct colours (CIEDE2000 > 8 apart, each carrying the weight of the
  colours it absorbs) and the swatches that hold >= 10 % of the frame.
- Accents: colours that are rare but stand far from the frame's mean colour. Score =
  ΔE00(colour, field) × (0.5 + 6·chroma) × min(1, weight/4‰), kept when ΔE00 >= 15 from the field and
  >= 12 from every atmosphere colour; top 5, at least 10 ΔE apart. The palette carries no spatial data,
  so this is chromatic saliency, not true focal saliency. If the export provides `engine.atmosphere`,
  `engine.accents` or `engine.swatches` for a photo, those are used instead.
- A 16-point signature (weighted k-means in OKLab) and the Earth Mover's Distance between every pair of
  photos (Sinkhorn, ground cost = Euclidean OKLab distance). D is reported ×100 (≈ ΔE-like units).

Output is compact: the browser only looks distances up; path finding happens in js/chroma-worker.js.
numpy is used when present; otherwise a pure-Python fallback runs (slower, same result).
"""
import json, math, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(ROOT, "data", "archive.json")
OUT = os.path.join(ROOT, "data", "chroma.json")
try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

# 24 swatches: id, group, anchor (OKLCH L, C, h), names. Order = position along the strip.
SWATCHES = [
    ("crimson",       "chroma", (0.55, 0.20, 22),  {"en": "Crimson", "es": "Carmesí", "pt": "Carmesim"}),
    ("vermilion",     "chroma", (0.64, 0.20, 38),  {"en": "Vermilion", "es": "Bermellón", "pt": "Vermelhão"}),
    ("tangerine",     "chroma", (0.73, 0.16, 56),  {"en": "Tangerine", "es": "Mandarina", "pt": "Tangerina"}),
    ("amber",         "chroma", (0.80, 0.15, 76),  {"en": "Amber", "es": "Ámbar", "pt": "Âmbar"}),
    ("ochre",         "chroma", (0.62, 0.11, 84),  {"en": "Ochre", "es": "Ocre", "pt": "Ocre"}),
    ("acid-yellow",   "chroma", (0.92, 0.18, 108), {"en": "Acid Yellow", "es": "Amarillo ácido", "pt": "Amarelo ácido"}),
    ("chartreuse",    "chroma", (0.82, 0.18, 128), {"en": "Chartreuse", "es": "Chartreuse", "pt": "Chartreuse"}),
    ("emerald",       "chroma", (0.63, 0.15, 155), {"en": "Emerald", "es": "Esmeralda", "pt": "Esmeralda"}),
    ("bottle-green",  "chroma", (0.40, 0.08, 162), {"en": "Bottle Green", "es": "Verde botella", "pt": "Verde-garrafa"}),
    ("teal",          "chroma", (0.52, 0.09, 198), {"en": "Teal", "es": "Petróleo", "pt": "Petróleo"}),
    ("cyan",          "chroma", (0.80, 0.12, 208), {"en": "Cyan", "es": "Cian", "pt": "Ciano"}),
    ("cobalt",        "chroma", (0.48, 0.17, 262), {"en": "Cobalt", "es": "Cobalto", "pt": "Cobalto"}),
    ("ultraviolet",   "chroma", (0.45, 0.20, 295), {"en": "Ultraviolet", "es": "Ultravioleta", "pt": "Ultravioleta"}),
    ("lilac",         "chroma", (0.75, 0.09, 310), {"en": "Lilac", "es": "Lila", "pt": "Lilás"}),
    ("club-fuchsia",  "chroma", (0.62, 0.24, 336), {"en": "Club Fuchsia", "es": "Fucsia de club", "pt": "Fúcsia de clube"}),
    ("plum",          "chroma", (0.38, 0.11, 340), {"en": "Plum", "es": "Ciruela", "pt": "Ameixa"}),
    ("bubblegum",     "chroma", (0.80, 0.10, 355), {"en": "Bubblegum", "es": "Chicle", "pt": "Chiclete"}),
    ("deep-burgundy", "chroma", (0.34, 0.11, 12),  {"en": "Deep Burgundy", "es": "Burdeos profundo", "pt": "Bordô profundo"}),
    ("obsidian",      "tone",   (0.16, 0.00, 0),   {"en": "Obsidian", "es": "Obsidiana", "pt": "Obsidiana"}),
    ("charcoal",      "tone",   (0.34, 0.00, 0),   {"en": "Charcoal", "es": "Carbón", "pt": "Carvão"}),
    ("silver",        "tone",   (0.64, 0.005, 250), {"en": "Silver", "es": "Plata", "pt": "Prata"}),
    ("bone",          "tone",   (0.88, 0.02, 90),  {"en": "Bone", "es": "Hueso", "pt": "Osso"}),
    ("pure-white",    "tone",   (0.985, 0.00, 0),  {"en": "Pure White", "es": "Blanco puro", "pt": "Branco puro"}),
    ("sepia",         "tone",   (0.56, 0.055, 66), {"en": "Sepia", "es": "Sepia", "pt": "Sépia"}),
]
ACHROMATIC_C = 0.03

# ---------- colour maths ----------
def hex_rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def oklab(h):
    r, g, b = (lin(c) for c in hex_rgb(h))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)
def oklch_to_lab(L, C, h):
    return (L, C * math.cos(math.radians(h)), C * math.sin(math.radians(h)))
def lab_to_hex(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    def gam(c):
        c = min(1, max(0, c)); return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#" + "".join(f"{round(gam(c) * 255):02X}" for c in rgb)
def cielab(h):
    r, g, b = (lin(c) for c in hex_rgb(h))
    X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    Y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b)
    Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(X), f(Y), f(Z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
def de00(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360; h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lpm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    hpm = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = 1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm)) + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63))
    SL = 1 + 0.015 * (Lpm - 50) ** 2 / math.sqrt(20 + (Lpm - 50) ** 2); SC = 1 + 0.045 * Cpm; SH = 1 + 0.015 * Cpm * T
    RT = -2 * math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hpm - 275) / 25) ** 2)))
    return math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))

ANCHORS = [(sid, grp, oklch_to_lab(*lch)) for sid, grp, lch, _ in SWATCHES]
def nearest_swatch(lab, chroma):
    """Hue first, then lightness. Near-neutral colours go to the tonal ladder by lightness; warm muted
    colours (hue 40–110°, low chroma, mid lightness) are Sepia; everything else takes the nearest chromatic
    anchor by hue angle first (30° ≈ one unit), then lightness and chroma, so a dark teal shadow is Teal."""
    L = lab[0]; h = math.degrees(math.atan2(lab[2], lab[1])) % 360
    warm = 40 <= h <= 110
    if chroma < ACHROMATIC_C:
        if chroma >= 0.018 and warm and 0.35 < L < 0.80: return "sepia"
        return "obsidian" if L < 0.25 else "charcoal" if L < 0.50 else "silver" if L < 0.80 else "bone" if L < 0.94 else "pure-white"
    if chroma < 0.06 and warm and 0.30 < L < 0.82: return "sepia"
    best, bd = None, 1e9
    for sid, grp, lch, _ in SWATCHES:
        if grp != "chroma": continue
        dh = abs((h - lch[2] + 180) % 360 - 180)
        d = (dh / 30) ** 2 + 0.5 * ((L - lch[0]) / 0.25) ** 2 + 0.3 * ((chroma - lch[1]) / 0.1) ** 2
        if d < bd: best, bd = sid, d
    return best
SW_INDEX = {s[0]: i for i, s in enumerate(SWATCHES)}

# ---------- per-photo analysis ----------
def analyse(photo):
    pal = [(h, (w or 0) / 1000) for h, w in photo.get("palette") or [] if h]
    tot = sum(w for _, w in pal) or 1
    cols = []
    for h, w in pal:
        o = oklab(h); C = math.hypot(o[1], o[2])
        cols.append({"hex": h, "w": w / tot, "ok": o, "C": C, "lab": cielab(h), "sw": nearest_swatch(o, C)})
    if not cols: return None
    share = {}
    for c in cols: share[c["sw"]] = share.get(c["sw"], 0) + c["w"]
    # atmosphere: heaviest distinct colours, each absorbing its near neighbours
    left = sorted(cols, key=lambda c: -c["w"]); atm = []
    while left and len(atm) < 5:
        pick = left[0]; group = [c for c in left if de00(c["lab"], pick["lab"]) < 8]
        atm.append({"hex": pick["hex"], "w": sum(c["w"] for c in group), "sw": pick["sw"], "lab": pick["lab"]})
        left = [c for c in left if c not in group]
    field = tuple(sum(c["lab"][i] * c["w"] for c in cols) for i in range(3))
    # accents: rare, chromatic and far from the field
    cands = []
    for c in cols:
        if c["w"] < 0.0008: continue
        dF = de00(c["lab"], field)
        if dF < 15 or min(de00(c["lab"], a["lab"]) for a in atm) < 12: continue
        cands.append((dF * (0.5 + 6 * c["C"]) * min(1, c["w"] / 0.004), dF, c))
    acc = []
    for score, dF, c in sorted(cands, key=lambda x: -x[0]):
        if all(de00(c["lab"], a["lab"]) >= 10 for a in acc):
            acc.append({"hex": c["hex"], "w": c["w"], "sw": c["sw"], "lab": c["lab"], "dE": dF})
        if len(acc) == 5: break
    atm_sw = sorted({s for s, v in share.items() if v >= 0.10} | {a["sw"] for a in atm[:3]}, key=SW_INDEX.get)
    acc_sw = sorted({a["sw"] for a in acc}, key=SW_INDEX.get)
    # barcode: strip order (swatch index), then lightness inside a swatch
    bar = sorted(cols, key=lambda c: (SW_INDEX[c["sw"]], c["ok"][0]))
    return {
        "atmSw": atm_sw, "accSw": acc_sw,
        "share": {k: round(v * 1000, 1) for k, v in sorted(share.items(), key=lambda kv: SW_INDEX[kv[0]])},
        "atm": [[a["hex"], round(a["w"] * 1000, 1), a["sw"]] for a in atm],
        "acc": [[a["hex"], round(a["w"] * 1000, 2), a["sw"], round(a["dE"], 1)] for a in acc],
        "bar": [[c["hex"], round(c["w"] * 1000, 2)] for c in bar],
        "sig": signature(cols),
    }

def engine_override(photo, res):
    """Use the Studio's own perceptual engine output when the export carries it."""
    e = photo.get("engine") or {}
    if e.get("atmosphere"): res["atm"] = [[x["hex"], x.get("weight", 0), x.get("swatch") or nearest_swatch(oklab(x["hex"]), 1)] for x in e["atmosphere"]]
    if e.get("accents"): res["acc"] = [[x["hex"], x.get("weight", 0), x.get("swatch") or nearest_swatch(oklab(x["hex"]), 1), x.get("deltaE", 0)] for x in e["accents"]]
    sw = e.get("swatches") or {}
    if sw.get("atmosphere"): res["atmSw"] = sw["atmosphere"]
    if sw.get("accent"): res["accSw"] = sw["accent"]
    return res

def signature(cols, k=16, iters=25):
    """Weighted k-means in OKLab; deterministic farthest-point initialisation."""
    pts = [c["ok"] for c in cols]; ws = [c["w"] for c in cols]
    d2 = lambda p, q: (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
    cent = [pts[max(range(len(pts)), key=lambda i: ws[i])]]
    while len(cent) < min(k, len(pts)):
        i = max(range(len(pts)), key=lambda i: ws[i] ** 0.5 * min(d2(pts[i], c) for c in cent))
        cent.append(pts[i])
    for _ in range(iters):
        acc = [[0, 0, 0, 0] for _ in cent]
        for p, w in zip(pts, ws):
            j = min(range(len(cent)), key=lambda j: d2(p, cent[j]))
            a = acc[j]; a[0] += p[0] * w; a[1] += p[1] * w; a[2] += p[2] * w; a[3] += w
        cent = [(a[0] / a[3], a[1] / a[3], a[2] / a[3]) if a[3] else c for a, c in zip(acc, cent)]
    mass = [0.0] * len(cent)
    for p, w in zip(pts, ws): mass[min(range(len(cent)), key=lambda j: d2(p, cent[j]))] += w
    t = sum(mass)
    return [[round(c[0], 4), round(c[1], 4), round(c[2], 4), round(m / t, 4)] for c, m in zip(cent, mass) if m > 0]

# ---------- Earth Mover's Distance (Sinkhorn) ----------
EPS, ITERS = 0.004, 400
def emd_matrix(sigs):
    n = len(sigs)
    D = [[0.0] * n for _ in range(n)]
    if np is not None:
        P = [np.array([s[:3] for s in g]) for g in sigs]; W = [np.array([s[3] for s in g]) for g in sigs]
        for i in range(n):
            for j in range(i + 1, n):
                C = np.sqrt(((P[i][:, None, :] - P[j][None, :, :]) ** 2).sum(-1))
                K = np.exp(-C / EPS); u = np.ones(len(W[i])); v = np.ones(len(W[j]))
                for _ in range(ITERS):
                    u = W[i] / np.maximum(K @ v, 1e-300); v = W[j] / np.maximum(K.T @ u, 1e-300)
                D[i][j] = D[j][i] = float((u[:, None] * K * v[None, :] * C).sum()) * 100
        return D
    for i in range(n):
        for j in range(i + 1, n):
            D[i][j] = D[j][i] = sinkhorn_py(sigs[i], sigs[j]) * 100
    return D

def sinkhorn_py(A, B):
    C = [[math.dist(a[:3], b[:3]) for b in B] for a in A]
    K = [[math.exp(-c / EPS) for c in row] for row in C]
    wa = [a[3] for a in A]; wb = [b[3] for b in B]; u = [1.0] * len(A); v = [1.0] * len(B)
    for _ in range(ITERS):
        u = [wa[i] / max(sum(K[i][j] * v[j] for j in range(len(B))), 1e-300) for i in range(len(A))]
        v = [wb[j] / max(sum(K[i][j] * u[i] for i in range(len(A))), 1e-300) for j in range(len(B))]
    return sum(u[i] * K[i][j] * v[j] * C[i][j] for i in range(len(A)) for j in range(len(B)))

def main():
    t0 = time.time()
    data = json.load(open(IN, encoding="utf-8"))
    photos, order, sigs = {}, [], []
    for p in data["photos"]:
        r = analyse(p)
        if not r: print(f"  ! {p['code']}: no palette, left out of the colour engine"); continue
        photos[p["code"]] = engine_override(p, r); order.append(p["code"]); sigs.append(r["sig"])
    D = emd_matrix(sigs)
    out = {
        "generatedAt": data.get("generatedAt"),
        "swatches": [{"id": sid, "group": grp, "hex": lab_to_hex(*oklch_to_lab(*lch)), "lch": list(lch), "name": names}
                     for sid, grp, lch, names in SWATCHES],
        "order": order,
        "photos": photos,
        # pairwise EMD ×100, rounded to 0.01 and stored as integers (×100) to keep the file small
        "D": [[round(x * 100) for x in row] for row in D],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":")); f.write("\n")
    flat = sorted(x for i, r in enumerate(D) for j, x in enumerate(r) if j > i)
    print(f"Colour engine: {len(order)} photos · {len(flat)} pairs · D min {flat[0]:.2f} median {flat[len(flat)//2]:.2f} max {flat[-1]:.2f} · "
          f"{'numpy' if np is not None else 'pure python'} · {time.time() - t0:.1f}s")

if __name__ == "__main__":
    main()
