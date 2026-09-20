#!/usr/bin/env python3
"""Inline public/styles.css and public/js/*.js into ONE html file (handy for a quick preview / demo).
Usage: python3 scripts/build-single.py out.html
The single file has no backend, so it runs in demo mode (Ideas need the /api/generate backend)."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "public"
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "styles.css").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "\n</style>")
def inline(m):
    js = (root / m.group(1)).read_text(encoding="utf-8")
    assert "</script" not in js.lower(), m.group(1)
    return "<script>\n" + js + "\n</script>"
html = re.sub(r'<script src="(js/[\w.-]+)"></script>', inline, html)
pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "cue-single.html").write_text(html, encoding="utf-8")
print("built", len(html), "bytes")
