#!/usr/bin/env python3
"""Rewrite the inline-script sha256 hashes in _headers from index.html.

Run after any change to an inline <script> in index.html (or after build_archive.py regenerates it),
otherwise the Content-Security-Policy blocks that script.
"""
import base64, hashlib, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
hashes = [
    "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'"
    for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
]
headers = root / "_headers"
text = headers.read_text(encoding="utf-8")
new, n = re.subn(r"script-src [^;]*;", "script-src 'self' " + " ".join(hashes) + ";", text)
if n != 1:
    sys.exit("script-src not found exactly once in _headers")
headers.write_text(new, encoding="utf-8")
print(f"updated {len(hashes)} inline-script hash(es)")
