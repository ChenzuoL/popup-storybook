#!/usr/bin/env python3
"""flicker-check.py — catch z-fighting on the closed book (or any view) from two nearly identical shots.

    python3 scripts/flicker-check.py docs/qa/shots/closedSide.png docs/qa/shots/closedSideJ.png [--max=0.5] [--out=diff.png]

shoot.mjs renders each grazing closed view twice, the second nudged by ~0.07 deg (closedSideJ,
closedLowJ). Stable geometry barely changes; two surfaces sharing a plane (a cover inside face on the
block top, a print plane over a board) flip whole runs of edge pixels. Exit 1 if more than --max
percent of the book's pixels change. --out writes the changed pixels in red over the first shot.
Needs Pillow + numpy.
"""
import sys
try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("flicker-check.py needs Pillow and numpy: pip install --user --break-system-packages pillow numpy")

paths = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
if len(paths) != 2:
    sys.exit(__doc__)
limit = float(opts.get("max", 0.5))
view = (0, 0, int(opts.get("width", 960)), int(opts.get("height", 730)))   # canvas area, not the reader UI
A = np.asarray(Image.open(paths[0]).convert("RGB").crop(view)).astype(int)
B = np.asarray(Image.open(paths[1]).convert("RGB").crop(view)).astype(int)
bg = np.median(np.concatenate([A[:8].reshape(-1, 3), A[-8:].reshape(-1, 3)]), axis=0)
book = (np.abs(A - bg).max(2) > 18) | (np.abs(B - bg).max(2) > 18)
diff = np.abs(A - B).max(2) > 45
changed = int((diff & book).sum())
pct = changed / max(1, int(book.sum())) * 100
if "out" in opts:
    vis = (A * 0.5).astype("uint8")
    vis[diff & book] = [255, 40, 40]
    Image.fromarray(vis).save(opts["out"])
ok = pct <= limit
print(f'{{"ok": {str(ok).lower()}, "bookPixels": {int(book.sum())}, "changed": {changed}, "percent": {pct:.3f}, "max": {limit}}}')
sys.exit(0 if ok else 1)
