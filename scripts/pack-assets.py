#!/usr/bin/env python3
"""pack-assets.py — make the book light enough to open fast, without touching layout.

    python3 scripts/pack-assets.py --book=data/book.json [--root=.] [--budget-mb=2.5] [--max-side=1600] [--dry]

- standees with alpha  -> WebP (lossy colour, lossless alpha), same pixel size, so alphaBounds stand;
- opaque page art / cover -> JPEG q86;
- masks stay PNG (they are tiny);
- anything over --max-side is downscaled first (alphaBounds are fractions, so they still hold).
Rewrites asset.file in the manifest, deletes the replaced originals, prints before/after bytes and
exits 1 if what the book loads at start is over --budget-mb. Run after matte.py, before publishing.
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("pack-assets.py needs Pillow: pip install --user --break-system-packages pillow")

ap = argparse.ArgumentParser()
ap.add_argument("--book", required=True)
ap.add_argument("--root")
ap.add_argument("--budget-mb", type=float, default=2.5)
ap.add_argument("--max-side", type=int, default=1600)
ap.add_argument("--cover-max-side", type=int, default=1100, help="the cover is the first thing on screen: keep it small")
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
book_file = os.path.abspath(a.book)
root = os.path.abspath(a.root or os.path.dirname(os.path.dirname(book_file)))
book = json.load(open(book_file, encoding="utf-8"))


def loaded_files(b):
    out = []
    for asset in b.get("assets", []):
        for key in ("file", "maskFile"):
            if asset.get(key) and asset[key] not in out:
                out.append(asset[key])
    return out


def size(rel):
    p = os.path.join(root, rel)
    return os.path.getsize(p) if os.path.exists(p) else 0


before = sum(size(f) for f in loaded_files(book))
report = []
for asset in book.get("assets", []):
    rel = asset.get("file")
    if not rel or not os.path.exists(os.path.join(root, rel)):
        continue
    stem, ext = os.path.splitext(rel)
    im = Image.open(os.path.join(root, rel))
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    if has_alpha:
        im = im.convert("RGBA")
        alpha_used = im.getchannel("A").getextrema()[0] < 255
    else:
        alpha_used = False
    cap = min(a.max_side, a.cover_max_side) if asset.get("type") == "cover" else a.max_side
    if max(im.size) > cap:
        s = cap / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    if alpha_used:
        new_rel, fmt, kw = stem + ".webp", "WEBP", {"quality": 86, "method": 6, "alpha_quality": 100}
    else:
        new_rel, fmt, kw = stem + ".jpg", "JPEG", {"quality": 86, "optimize": True, "progressive": True}
        im = im.convert("RGB")
    old_bytes = size(rel)
    if not a.dry:
        resized = max(Image.open(os.path.join(root, rel)).size) > cap
        im.save(os.path.join(root, new_rel), fmt, **kw)
        new_bytes = size(new_rel)
        if new_rel == rel:
            pass                                          # re-encoded in place
        elif new_bytes >= old_bytes and not resized:
            os.remove(os.path.join(root, new_rel))        # not worth it: keep the original
            new_rel, new_bytes = rel, old_bytes
        else:
            os.remove(os.path.join(root, rel))
            asset["file"] = new_rel
        if new_rel != rel or resized or new_rel == asset.get("file"):
            asset["finalImageSize"] = list(im.size)
    else:
        new_bytes = old_bytes
    report.append({"asset": asset["id"], "from": rel, "to": asset.get("file"), "kb": [old_bytes // 1024, new_bytes // 1024]})

if not a.dry:
    json.dump(book, open(book_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(book_file, "a").write("\n")
after = sum(size(f) for f in loaded_files(book))
ok = after <= a.budget_mb * 1024 * 1024
print(json.dumps({"ok": ok, "loadedMB": [round(before / 1048576, 2), round(after / 1048576, 2)],
                  "budgetMB": a.budget_mb, "assets": report}, ensure_ascii=False, indent=1))
sys.exit(0 if ok else 1)
