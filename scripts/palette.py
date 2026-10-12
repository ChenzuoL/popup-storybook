#!/usr/bin/env python3
"""palette.py — derive a book theme palette from its approved composition boards (and covers).

    python3 scripts/palette.py assets/boards/a.png [assets/boards/b.png ...] [--out=data/palette.json]

Prints a JSON `theme.palette` suggestion whose roles are picked from the art itself, so two books from
two worlds never ship the same chrome. The agent still judges it: adjust a role when contrast or the
world's tone calls for it, and record why in theme.derivedFrom.

Roles:
  paper      lightest low-saturation colour, lifted toward cream: reading panel / page stock
  paperDeep  paper darkened a step: stage background, dividers
  ink        darkest colour, pushed toward near-black: body text
  inkSoft    ink mixed toward paper: secondary text
  accent     most saturated mid-value colour: buttons, active dot, chapter label
  cloth      darkest saturated colour: cover cloth / binding boards / spine
  table      a muted mid-dark tone: table surface under the book
"""
import colorsys
import json
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("palette.py needs Pillow: pip install --user --break-system-packages pillow")

files = [a for a in sys.argv[1:] if not a.startswith("--")]
out = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--out=")), None)
if not files:
    sys.exit(__doc__)

pixels = []
for f in files:
    im = Image.open(f).convert("RGB")
    im.thumbnail((320, 320))
    q = im.quantize(colors=12, method=Image.MEDIANCUT)
    pal = q.getpalette()[:36]
    counts = sorted(q.getcolors(), reverse=True)
    for count, idx in counts:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        pixels.append((count, (r, g, b)))


def hls(c):
    return colorsys.rgb_to_hls(*(v / 255 for v in c))


def hexc(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in c)


def mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def with_l(c, light, sat_scale=1.0):
    h, l, s = hls(c)
    r, g, b = colorsys.hls_to_rgb(h, light, min(1, s * sat_scale))
    return (r * 255, g * 255, b * 255)


cols = [c for _, c in pixels]
weights = {c: n for n, c in pixels}
light = max(cols, key=lambda c: hls(c)[1] - 0.25 * hls(c)[2])
dark = min(cols, key=lambda c: hls(c)[1])
sat_mid = [c for c in cols if 0.22 < hls(c)[1] < 0.68]
accent = max(sat_mid or cols, key=lambda c: hls(c)[2] * (0.6 + 0.4 * min(1, weights[c] / 400)))
cloth_pool = [c for c in cols if hls(c)[1] < 0.42 and hls(c)[2] > 0.18] or [dark]
cloth = max(cloth_pool, key=lambda c: hls(c)[2] * (1 - hls(c)[1]))

paper = with_l(light, max(0.88, min(0.94, hls(light)[1])), 0.55)
paper_deep = with_l(light, max(0.78, hls(paper)[1] - 0.08), 0.6)
ink = with_l(dark, min(0.16, hls(dark)[1]), 0.5)
ink_soft = mix(ink, paper, 0.42)
accent_c = with_l(accent, min(0.48, max(0.34, hls(accent)[1])), 1.0)
cloth_c = with_l(cloth, min(0.3, max(0.16, hls(cloth)[1])), 0.9)
table = mix(with_l(dark, 0.3, 0.45), paper_deep, 0.25)

palette = {
    "paper": hexc(paper), "paperDeep": hexc(paper_deep), "ink": hexc(ink), "inkSoft": hexc(ink_soft),
    "accent": hexc(accent_c), "cloth": hexc(cloth_c), "table": hexc(table),
}
result = {"palette": palette, "derivedFrom": files, "swatches": [hexc(c) for c in cols[:16]]}
text = json.dumps(result, indent=2)
if out:
    open(out, "w").write(text + "\n")
print(text)
