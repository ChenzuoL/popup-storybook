# Cutting standees out of the composition master with qwen-image-2.1

The approved composition board (the **master**) is the only layout source. Every standee is cut out
of it, not redrawn beside it. The tool is `qwen-image-2.1` in **edit mode**: the master is the
reference image, and each call keeps exactly one element and paints everything else pure white —
**in place**, at the element's exact board position and size.

In place is what makes this reliable:

- the element's white-key bounding box, scaled to the board canvas, **is** its `boardRect` — nobody
  eyeballs or hand-types pixel rectangles;
- the cut keeps the board's own pose, lighting and paper rendering, so pieces match each other;
- parts hidden behind another element are completed by the model (Ron behind his trunk, a foot
  behind a rail), so every piece is whole when it stands alone in 3D.

```text
approved master (https URL)
  └─ per boardItem: qwen-image-2.1 edit, master as image 1 [+ atom cover as image 2]
       └─ white-ground isolate, same canvas framing
            ├─ isolate      -> BiRefNet alpha fitted back into the isolate bbox
            ├─ isolate-key  -> white flood-key from the canvas border
            └─ curtain      -> opaque plate cropped to the authored boardRect
  └─ matte.py: boardRect from bbox, cutout + mask + alphaBounds, contact sheet, recomposition
```

## boardItem fields for cutting

```json
{
  "id": "ron",
  "assetId": "ron-s1",
  "materialRef": "character:罗恩·韦斯莱",
  "role": "character", "layer": "midground", "depthBand": "midground", "pageSide": "right",
  "cutMode": "isolate",
  "subject": "the red-haired boy in the grey robe standing behind the big brass-cornered trunk, one hand on its handle",
  "identityRef": "https://…/ron-cover.png",
  "boardRect": [0, 0, 10, 10],
  "required": true
}
```

- `subject` — English, concrete, **as the master shows it**: hair, clothes, what they hold, where they
  stand ("on the far left", "behind the trunk"). Position words disambiguate look-alikes. Do not
  describe canon the master does not show — that invites the model to redraw.
- `identityRef` — the atom cover (https). Sent only on a retry with `--identity` or when
  `identityLock: true`. Use it when an isolate drifts toward a neighbour (Ron borrowing Harry's round
  glasses is the classic case). The prompt tells the model to take identity from image 2 but pose,
  position and size only from image 1.
- `boardRect` — placeholder until `matte.py` measures it. Set `rectLocked: true` only when the rect is
  authored on purpose (curtains, direct crops, a deliberate correction).
- `remove` (curtain only) — the list of things to take out of the scenery.

## Choosing a cutMode

| Element | cutMode | Why |
| --- | --- | --- |
| character, creature, vehicle, landmark, tall prop | `isolate` | BiRefNet gives soft, clean edges on a salient subject |
| low flat prop, envelope, rug edge, rail/sleeper strip, platform lip | `isolate-key` | BiRefNet finds no salient subject and returns empty or partial alpha; the white key keeps it whole |
| distant architecture / landscape behind everything | `curtain` | opaque plate; the model removes every subject and continues the scenery; author `boardRect` to the band you keep (drop the painted floor so it never fights the page ground) |
| region already isolated on white in the master | `crop` | no model call |
| legacy re-drawn asset | `regenerate` | existing books only |
| hand-made / external file | `manual` + `reason` | documented exception |

Wide strips that span the gutter (`pageSide: "spread"`) are fine for curtains and low foreground
bands. Characters always belong to one page.

## Run it

```bash
# 1. cut (async + poll; concurrency 4–5; skips items already cut unless --force)
node scripts/qwen-isolate.mjs --book=data/book.json --spread=<spread-id>
# retry named items with their atom cover as identity reference
node scripts/qwen-isolate.mjs --book=data/book.json --spread=<spread-id> --items=ron --identity --force

# 2. matte + measure (Pillow + numpy: pip install --user --break-system-packages pillow numpy)
python3 scripts/matte.py --book=data/book.json --spread=<spread-id>
```

`qwen-isolate.mjs` writes `assets/isolate/<assetId>.*` and `data/cut-log.json` (prompt, task id, output
URL per attempt). `matte.py` writes `assets/cutout/<assetId>.png`, `assets/masks/<assetId>.png`, updates
`boardItems[].boardRect` / `measured` and the asset records, and renders:

- `docs/qa/<spread>-standees.png` — every cutout on light and on dark paper;
- `docs/qa/<spread>-recompose.png` — the master beside the cutouts pasted back into their measured
  rects, back to front.

**Look at both images** before placing anything. The recomposition must read as the master: same
positions, same sizes, nobody missing, nobody doubled.

## Intake checklist (per cutout)

- one subject only — no neighbour's arm, no second figure, no floor patch, no cast shadow;
- identity intact — compare with the atom cover (glasses, hair colour, house colours, scars);
- whole silhouette — no clipped hands, feet, tails, steam, wheel arches; hidden parts completed;
- no white halo on dark paper, no rectangular residue, no text or watermark;
- `measured.boardRect` lands where the master has it (recomposition) — a wildly different rect means
  the model moved or rescaled the subject: retry with a firmer `subject` or `--identity`;
- `alpha` note: `white-key (birefnet missing or too small)` on a character means BiRefNet failed —
  check its edges closely.

## Failure handling

- **Synchronous `cohub generate` can hang for minutes.** The script always uses `--async` and polls
  `cohub tasks get`.
- **Content filter rejections** are nondeterministic and cached per exact prompt. The script retries
  with varied wording and a new seed (4 attempts). If an element keeps failing, rephrase `subject`
  more neutrally (describe clothes and pose, not age or story role).
- **Drift** (identity borrowed from a neighbour, extra prop, wrong pose): retry that item with
  `--identity --force`. Do not accept a drifted cut "for now".
- **Moved or rescaled** subject (rare): retry; if it persists, set `rectLocked: true` with the rect
  read from the master and note it in `measured`.
- **Empty isolate**: the subject text did not match anything; describe what the master actually shows.
- A failed cut is an asset failure. It never licenses moving the element, redrawing the master, or
  dropping the element silently.

## Where the other pixels come from

- **Page ground** (`pageArt`, ground-only) and the **cover** are not cut from the master; generate them
  with `generate` in the book's printed medium, using the master as a style reference: ground = the
  floor/terrain the master stands on, no figures, no standing architecture; cover = the book's title
  image (leave quiet space if the cover art mode is `inset-plate`).
- Never flatten a cut element into the ground to save a standee.
