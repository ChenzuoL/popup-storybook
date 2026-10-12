#!/usr/bin/env python3
"""matte.py — turn qwen in-place isolates into production standees and measure their board rects.

    python3 scripts/matte.py --book=data/book.json --spread=chapter-01-spread-01 [--root=.] [--items=a,b]

Needs Pillow + numpy (pip install --user --break-system-packages pillow numpy).

Per boardItem (cutMode):
  isolate      colour from the isolate, alpha from BiRefNet fitted back into the isolate's bbox;
               falls back to the white key when BiRefNet returned too little (logged).
  isolate-key  alpha = white background flood-filled from the canvas border (keeps interior whites).
  curtain      opaque plate: isolate resized to the board canvas, cropped to boardRect (rect required).
  crop         no model: board pixels inside boardRect; white-keyed if the region sits on white.

Because isolates are made IN PLACE, the content bbox (scaled to the board canvas) becomes the
item's boardRect unless boardItem.rectLocked is true. The book manifest is updated in place:
boardItems[].boardRect/measured and assets[] file/maskFile/alphaBounds/provenance.
QA written: docs/qa/<spread>-standees.png (light + dark paper) and
            docs/qa/<spread>-recompose.png (board | cutouts recomposed back to front).
"""
import argparse
import json
import os
import sys

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    sys.exit("matte.py needs Pillow and numpy: pip install --user --break-system-packages pillow numpy")

WHITE = 236          # min channel above this counts as the white isolate ground
PAD = 10             # transparent padding around every cutout, in cutout pixels
LAYER_ORDER = {"background": 0, "midground": 1, "foreground": 2}

ap = argparse.ArgumentParser()
ap.add_argument("--book", required=True)
ap.add_argument("--spread", required=True)
ap.add_argument("--root")
ap.add_argument("--items")
ap.add_argument("--white", type=int, default=WHITE)
a = ap.parse_args()

book_file = os.path.abspath(a.book)
root = os.path.abspath(a.root or os.path.dirname(os.path.dirname(book_file)))
book = json.load(open(book_file, encoding="utf-8"))
spread = next((s for s in book["spreads"] if s["id"] == a.spread), None)
if not spread:
    sys.exit(f"unknown spread {a.spread}")
board_meta = spread["compositionBoard"]
W, H = board_meta["canvas"]
board_path = os.path.join(root, board_meta["file"])
board = Image.open(board_path).convert("RGB")
if board.size != (W, H):
    board = board.resize((W, H), Image.LANCZOS)
log_path = os.path.join(root, "data/cut-log.json")
log = json.load(open(log_path, encoding="utf-8")) if os.path.exists(log_path) else {}
only = set(a.items.split(",")) if a.items else None
for d in ("assets/cutout", "assets/masks", "docs/qa"):
    os.makedirs(os.path.join(root, d), exist_ok=True)


def white_key(rgb, thresh):
    """Alpha 0 for near-white pixels connected to the canvas border; interior whites survive."""
    arr = np.asarray(rgb).astype(np.int16)
    white = (arr.min(2) >= thresh) & ((arr.max(2) - arr.min(2)) < 18)
    m = Image.fromarray(np.where(white, 0, 255).astype("uint8"), "L")
    m = ImageOps_expand(m)
    ImageDraw.floodfill(m, (0, 0), 128, thresh=0)
    m = m.crop((1, 1, m.width - 1, m.height - 1))
    out = np.where(np.asarray(m) == 128, 0, 255).astype("uint8")
    alpha = Image.fromarray(out, "L")
    # open: drop isolated specks the model left on the white ground
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return alpha


def ImageOps_expand(m):
    e = Image.new("L", (m.width + 2, m.height + 2), 0)
    e.paste(m, (1, 1))
    return e


def bbox_of(alpha, min_run=3):
    arr = np.asarray(alpha) > 24
    cols = np.where(arr.sum(0) >= min_run)[0]
    rows = np.where(arr.sum(1) >= min_run)[0]
    if not len(cols) or not len(rows):
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def fit_birefnet(alpha_file, box, size):
    """BiRefNet crops/resizes to its own foreground; fit its alpha back into our content box."""
    ref = Image.open(alpha_file).convert("RGBA").split()[-1]
    rb = bbox_of(ref, 1)
    if not rb:
        return None
    ref = ref.crop(rb)
    x0, y0, x1, y1 = box
    full = Image.new("L", size, 0)
    full.paste(ref.resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
    return full


def finish(rgb, alpha, box, name):
    """Crop to box + padding, defringe the white edge, write cutout + mask, return alphaBounds."""
    x0, y0, x1, y1 = box
    crop = rgb.crop((x0, y0, x1, y1)).convert("RGBA")
    al = alpha.crop((x0, y0, x1, y1))
    # pull the alpha in by ~1px so the white isolate ground does not halo on dark pages
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    crop.putalpha(al)
    out = Image.new("RGBA", (crop.width + 2 * PAD, crop.height + 2 * PAD), (0, 0, 0, 0))
    out.paste(crop, (PAD, PAD))
    cut_rel = f"assets/cutout/{name}.png"
    mask_rel = f"assets/masks/{name}.png"
    out.save(os.path.join(root, cut_rel))
    out.split()[-1].save(os.path.join(root, mask_rel))
    b = bbox_of(out.split()[-1], 1) or (0, 0, out.width, out.height)
    bounds = [round(b[0] / out.width, 4), round(b[1] / out.height, 4),
              round((b[2] - b[0]) / out.width, 4), round((b[3] - b[1]) / out.height, 4)]
    return cut_rel, mask_rel, bounds, list(out.size)


def to_board_rect(box, iso_size):
    sx, sy = W / iso_size[0], H / iso_size[1]
    x0, y0, x1, y1 = box
    r = [int(round(x0 * sx)), int(round(y0 * sy)), int(round((x1 - x0) * sx)), int(round((y1 - y0) * sy))]
    r[0] = max(0, min(W - 1, r[0])); r[1] = max(0, min(H - 1, r[1]))
    r[2] = max(1, min(W - r[0], r[2])); r[3] = max(1, min(H - r[1], r[3]))
    return r


assets = {x["id"]: x for x in book.setdefault("assets", [])}
report = []
for item in spread.get("boardItems", []):
    if only and item["id"] not in only:
        continue
    mode = item.get("cutMode")
    name = item["assetId"]
    entry = log.get(name, {})
    note = {}
    try:
        if mode in ("isolate", "isolate-key"):
            iso_rel = entry.get("isolate")
            if not iso_rel or not os.path.exists(os.path.join(root, iso_rel)):
                raise RuntimeError("no isolate yet — run qwen-isolate.mjs first")
            iso = Image.open(os.path.join(root, iso_rel)).convert("RGB")
            key = white_key(iso, a.white)
            box_full = bbox_of(key)  # what BiRefNet saw: its crop maps back onto this box
            hint = item.get("hint")
            if hint:
                # drop anything the model left far outside the hint (scaled to isolate pixels)
                sx, sy = iso.width / W, iso.height / H
                m = max(24, 0.10 * max(hint[2], hint[3]))
                hx0, hy0 = int(max(0, (hint[0] - m) * sx)), int(max(0, (hint[1] - m) * sy))
                hx1, hy1 = int(min(iso.width, (hint[0] + hint[2] + m) * sx)), int(min(iso.height, (hint[1] + hint[3] + m) * sy))
                clip = Image.new("L", iso.size, 0)
                clip.paste(255, (hx0, hy0, hx1, hy1))
                key = Image.fromarray(np.minimum(np.asarray(key), np.asarray(clip)), "L")
            box = bbox_of(key)
            if not box:
                raise RuntimeError("isolate is empty (all white): re-run with a clearer subject or --identity")
            alpha = key
            if mode == "isolate":
                fitted = fit_birefnet(os.path.join(root, entry["alpha"]), box_full, iso.size) if entry.get("alpha") and box_full else None
                ka = np.asarray(key) > 24
                fa = (np.asarray(fitted) > 24) if fitted is not None else None
                iou = float((ka & fa).sum() / max(1, (ka | fa).sum())) if fa is not None else 0.0
                if fa is not None and iou >= 0.82:
                    # BiRefNet edges, never outside the (slightly dilated) keyed, hint-clipped silhouette
                    lim = key.filter(ImageFilter.MaxFilter(9))
                    alpha = Image.fromarray(np.minimum(np.asarray(fitted), np.asarray(lim)), "L")
                    note["alpha"] = f"birefnet (iou {iou:.2f})"
                else:
                    note["alpha"] = f"white-key (birefnet {'missing' if fa is None else f'misregistered, iou {iou:.2f}'})"
            else:
                note["alpha"] = "white-key"
            rect = to_board_rect(box, iso.size)
            if not item.get("rectLocked"):
                item["boardRect"] = rect
            item["measured"] = {"source": "isolate-bbox", "boardRect": rect, "isolateSize": list(iso.size)}
            cut_rel, mask_rel, bounds, size = finish(iso, alpha, box, name)
            src = {"sourceType": "generated", "sourceRef": entry.get("isolateUrl") or iso_rel,
                   "notes": f"qwen-image-2.1 in-place isolate of {item['id']} from the approved board ({note['alpha']} alpha)."}
        elif mode == "curtain":
            iso_rel = entry.get("isolate")
            if not iso_rel:
                raise RuntimeError("no curtain isolate yet — run qwen-isolate.mjs first")
            if not item.get("boardRect"):
                raise RuntimeError("curtain needs an authored boardRect (the band to keep, floor excluded)")
            iso = Image.open(os.path.join(root, iso_rel)).convert("RGB").resize((W, H), Image.LANCZOS)
            x, y, w, h = item["boardRect"]
            full = Image.new("L", (W, H), 0)
            full.paste(255, (x, y, x + w, y + h))
            cut_rel, mask_rel, bounds, size = finish(iso, full, (x, y, x + w, y + h), name)
            note["alpha"] = "opaque curtain"
            src = {"sourceType": "generated", "sourceRef": entry.get("isolateUrl") or iso_rel,
                   "notes": f"qwen-image-2.1 curtain of {item['id']}: subjects removed, scenery kept in board framing."}
        elif mode == "crop":
            if not item.get("boardRect"):
                raise RuntimeError("crop needs an authored boardRect")
            x, y, w, h = item["boardRect"]
            key = white_key(board, a.white)
            region = np.asarray(key.crop((x, y, x + w, y + h)))
            alpha = key if (region < 24).mean() > 0.15 else Image.new("L", (W, H), 255)
            cut_rel, mask_rel, bounds, size = finish(board, alpha, (x, y, x + w, y + h), name)
            note["alpha"] = "board crop"
            src = {"sourceType": "board-crop", "sourceRef": board_meta["file"], "notes": f"Direct crop of {item['id']} from the approved board."}
        else:
            report.append({"id": item["id"], "skipped": f"cutMode {mode}"})
            continue
    except Exception as exc:  # report every item, keep going
        report.append({"id": item["id"], "error": str(exc)})
        continue
    asset = assets.get(name)
    if not asset:
        asset = {"id": name, "type": "standee"}
        book["assets"].append(asset)
        assets[name] = asset
    asset.update({
        "type": "standee",
        "role": asset.get("role") or f"{item.get('layer', 'midground')} {item.get('role', 'prop')}",
        "file": cut_rel, "maskFile": mask_rel, "alphaBounds": bounds, "finalImageSize": size,
        "provenance": src,
    })
    if item.get("materialRef") and not asset.get("identityReference"):
        asset["identityReference"] = item["materialRef"]
    report.append({"id": item["id"], "asset": name, "boardRect": item.get("boardRect"), **note})

# ------------------------------------------------------------------ occlusion order, read off the master
# Isolates are in place and complete hidden parts, so where two cut-outs overlap, the one whose pixels
# match the master there is the one in front. Recorded as boardItem.occludes (ids it stands in front of).
def placed_layer(item):
    asset = assets.get(item["assetId"])
    if not asset or not asset.get("file") or item.get("cutMode") == "curtain" or item.get("layer") == "background":
        return None
    path_ = os.path.join(root, asset["file"])
    if not os.path.exists(path_):
        return None
    im = Image.open(path_).convert("RGBA")
    b = asset.get("alphaBounds") or [0, 0, 1, 1]
    vis = im.crop((int(b[0] * im.width), int(b[1] * im.height), int((b[0] + b[2]) * im.width), int((b[1] + b[3]) * im.height)))
    x, y, w, h = item["boardRect"]
    full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    full.alpha_composite(vis.resize((max(1, w), max(1, h)), Image.LANCZOS), (x, y))
    arr = np.asarray(full).astype(np.int16)
    return arr[..., :3], arr[..., 3] > 160

board_arr = np.asarray(board).astype(np.int16)
layers_px = {}
for item in spread.get("boardItems", []):
    got = placed_layer(item)
    if got is not None:
        layers_px[item["id"]] = got
occl = {i: [] for i in layers_px}
pairs = []
ids = list(layers_px)
for i, a_id in enumerate(ids):
    for b_id in ids[i + 1:]:
        ov = layers_px[a_id][1] & layers_px[b_id][1]
        n = int(ov.sum())
        if n < 400:
            continue
        da = np.abs(layers_px[a_id][0][ov] - board_arr[ov]).mean()
        db = np.abs(layers_px[b_id][0][ov] - board_arr[ov]).mean()
        if abs(da - db) < 4:
            pairs.append({"a": a_id, "b": b_id, "overlap": n, "verdict": "unclear", "diff": [round(float(da), 1), round(float(db), 1)]})
            continue
        front, back = (a_id, b_id) if da < db else (b_id, a_id)
        occl[front].append(back)
        pairs.append({"front": front, "back": back, "overlap": n, "diff": [round(float(min(da, db)), 1), round(float(max(da, db)), 1)]})
for item in spread.get("boardItems", []):
    if item["id"] in occl and not item.get("occludesLocked"):
        item["occludes"] = sorted(occl[item["id"]])
spread.setdefault("depthEvidence", {})["occlusion"] = pairs

json.dump(book, open(book_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(book_file, "a").write("\n")

# ------------------------------------------------------------------ QA sheets
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except Exception:
    font = ImageFont.load_default()
done = [r for r in report if r.get("asset")]
items_by_asset = {i["assetId"]: i for i in spread.get("boardItems", [])}
if done:
    CELL, GAP, COLS = 240, 14, 5
    rows = (len(done) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (CELL + GAP) + GAP, 2 * rows * (CELL + 24 + GAP) + GAP + 20), (250, 247, 240))
    d = ImageDraw.Draw(sheet)
    for half, paper in enumerate([(238, 230, 212), (40, 34, 30)]):
        for i, r in enumerate(done):
            im = Image.open(os.path.join(root, assets[r["asset"]]["file"]))
            c = Image.new("RGB", (CELL, CELL), paper)
            s = min((CELL - 12) / im.width, (CELL - 12) / im.height)
            t = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
            c.paste(t, ((CELL - t.width) // 2, (CELL - t.height) // 2), t)
            row, col = divmod(i, COLS)
            x = GAP + col * (CELL + GAP)
            y = 10 + (half * rows + row) * (CELL + 24 + GAP)
            sheet.paste(c, (x, y))
            d.text((x, y + CELL + 4), f"{r['asset']} · {r.get('alpha', '')}"[:40], fill=(70, 60, 50), font=font)
    sheet.save(os.path.join(root, f"docs/qa/{spread['id']}-standees.png"))

    # recompose: cutouts pasted back into their board rects, back to front
    recon = Image.blend(board, Image.new("RGB", (W, H), (255, 255, 255)), 0.72).convert("RGBA")
    order = sorted(done, key=lambda r: (LAYER_ORDER.get(items_by_asset[r["asset"]].get("layer"), 1),
                                         sum(items_by_asset[r["asset"]]["boardRect"][1::2])))
    for r in order:
        it = items_by_asset[r["asset"]]
        x, y, w, h = it["boardRect"]
        im = Image.open(os.path.join(root, assets[r["asset"]]["file"])).convert("RGBA")
        b = assets[r["asset"]]["alphaBounds"]
        vis = im.crop((int(b[0] * im.width), int(b[1] * im.height), int((b[0] + b[2]) * im.width), int((b[1] + b[3]) * im.height)))
        recon.alpha_composite(vis.resize((w, h), Image.LANCZOS), (x, y))
    pair = Image.new("RGB", (W * 2 + 20, H), (255, 255, 255))
    pair.paste(board, (0, 0))
    pair.paste(recon.convert("RGB"), (W + 20, 0))
    pair.thumbnail((2400, 2400))
    pair.save(os.path.join(root, f"docs/qa/{spread['id']}-recompose.png"))

print(json.dumps({"ok": not any("error" in r for r in report), "spread": spread["id"], "items": report, "occlusion": pairs,
                  "contact": f"docs/qa/{spread['id']}-standees.png", "recompose": f"docs/qa/{spread['id']}-recompose.png"},
                 ensure_ascii=False))
if any("error" in r for r in report):
    sys.exit(1)
