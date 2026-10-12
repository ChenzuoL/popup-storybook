#!/usr/bin/env python3
"""hint_mask.py — prepare a qwen input: the master with everything outside a rough hint box painted
white. The model then only has to separate the subject from its immediate neighbours, which it does
reliably; on the full busy board it often keeps every character when asked for one small prop.

    python3 hint_mask.py <board.png> <x,y,w,h> <out.png> [margin_fraction=0.06] [--grid]

The canvas size and framing are unchanged, so the isolate stays in place.
With --grid: write the board with a labelled 64px coordinate grid to <out.png> instead (for reading
rough hint boxes off the master).
"""
import sys
from PIL import Image, ImageDraw, ImageFont

src, rect, out = sys.argv[1], sys.argv[2], sys.argv[3]
board = Image.open(src).convert("RGB")
W, H = board.size
if "--grid" in sys.argv:
    g = board.copy()
    d = ImageDraw.Draw(g)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    step = 64
    for x in range(0, W, step):
        d.line([(x, 0), (x, H)], fill=(255, 0, 80) if x % 256 == 0 else (255, 255, 255), width=2 if x % 256 == 0 else 1)
        if x % 128 == 0:
            d.text((x + 3, 3), str(x), fill=(255, 0, 80), font=font, stroke_width=2, stroke_fill=(255, 255, 255))
    for y in range(0, H, step):
        d.line([(0, y), (W, y)], fill=(255, 0, 80) if y % 256 == 0 else (255, 255, 255), width=2 if y % 256 == 0 else 1)
        if y % 128 == 0:
            d.text((3, y + 3), str(y), fill=(255, 0, 80), font=font, stroke_width=2, stroke_fill=(255, 255, 255))
    g.save(out)
    sys.exit(0)
x, y, w, h = [float(v) for v in rect.split(",")]
margin = float(sys.argv[4]) if len(sys.argv) > 4 and not sys.argv[4].startswith("--") else 0.06
m = max(24, margin * max(w, h))
x0, y0 = max(0, int(x - m)), max(0, int(y - m))
x1, y1 = min(W, int(x + w + m)), min(H, int(y + h + m))
canvas = Image.new("RGB", (W, H), (255, 255, 255))
canvas.paste(board.crop((x0, y0, x1, y1)), (x0, y0))
canvas.save(out)
print(f"{x0},{y0},{x1 - x0},{y1 - y0}")
