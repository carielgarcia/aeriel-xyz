#!/usr/bin/env python3
"""Stamp local assets with the first 10 hex of the file's sha256: the data files a script fetches
('/data/….json?v=…' inside js/*.js), then every script tag (src="/js/….js?v=…") in the pages.

The ?v= is what makes browsers and Cloudflare fetch a changed script. If it isn't updated, visitors
keep the old archive.js next to the new page and its styles. Run after any change under js/.
`--check` exits 1 when a stamp is out of date, without writing.
"""
import hashlib, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
check = "--check" in sys.argv
stale = []
def ver(path):
    f = root / path.lstrip("/")
    return hashlib.sha256(f.read_bytes()).hexdigest()[:10] if f.is_file() else None
for js in sorted(root.glob("js/*.js")):
    src = js.read_text(encoding="utf-8")
    def jstamp(m):
        v = ver(m.group(1))
        if v is None: return m.group(0)
        if m.group(2) != v: stale.append(f"{js.relative_to(root)}: {m.group(1)} {m.group(2)} → {v}")
        return f"'{m.group(1)}?v={v}'"
    new = re.sub(r"'(/data/[^'?]+\.json)\?v=([0-9a-f]*)'", jstamp, src)
    if new != src and not check:
        js.write_text(new, encoding="utf-8")
for page in [root / "index.html"] + sorted(root.glob("*/index.html")):
    html = page.read_text(encoding="utf-8")
    def stamp(m):
        f = root / m.group(1).lstrip("/")
        if not f.is_file():
            return m.group(0)
        v = hashlib.sha256(f.read_bytes()).hexdigest()[:10]
        if m.group(2) != v:
            stale.append(f"{page.relative_to(root)}: {m.group(1)} {m.group(2)} → {v}")
        return f'src="{m.group(1)}?v={v}"'
    new = re.sub(r'src="(/[^"?]+\.js)\?v=([0-9a-f]*)"', stamp, html)
    if new != html and not check:
        page.write_text(new, encoding="utf-8")
for s in stale:
    print(s)
if check and stale:
    sys.exit(1)
print("asset versions " + ("out of date" if stale and check else "up to date" if not stale else "updated"))
