#!/usr/bin/env python3
"""Rewrite the inline-script sha256 hashes in _headers from every page (index.html and */index.html).

Run after any change to an inline <script> in index.html (or after build_archive.py regenerates it),
otherwise the Content-Security-Policy blocks that script.
"""
import base64, hashlib, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
# Cloudflare Web Analytics beacon, injected by Pages outside index.html; keep it allowed.
EXTRA_SCRIPT_SRC = ["https://static.cloudflareinsights.com"]
# Every page shares one policy, so collect the inline scripts of all of them (the menu, the archive, the side pages).
pages = [root / "index.html"] + sorted(p for p in root.glob("*/index.html"))
hashes = []
for page in pages:
    html = page.read_text(encoding="utf-8")
    for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S):
        h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'"
        if h not in hashes: hashes.append(h)
headers = root / "_headers"
text = headers.read_text(encoding="utf-8")
new, n = re.subn(r"script-src [^;]*;", "script-src 'self' " + " ".join(hashes + EXTRA_SCRIPT_SRC) + ";", text)
if n != 1:
    sys.exit("script-src not found exactly once in _headers")
headers.write_text(new, encoding="utf-8")
print(f"updated {len(hashes)} inline-script hash(es)")
