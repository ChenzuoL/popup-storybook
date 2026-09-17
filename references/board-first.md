# Board-first composition pipeline

A pop-up book has two different products in the same spread:

1. the **composition board**: the art-directed answer to “what does this page look like?”;
2. the **3D scene**: independent cut-paper pieces placed on a page and raised at different depths.

The board is the source of layout intent. It is not the final `pageArt`, and it must never be silently
replaced by a hand-written collection of new coordinates after approval.

## One source of truth

Every production spread records one approved `compositionBoard`:

```json
"compositionBoard": {
  "sourceWork": "work_01...",
  "file": "assets/boards/chapter-01-spread-01.png",
  "canvas": [1536, 1024],
  "coordinateSpace": "full-spread",
  "status": "approved"
}
```

A textured, complete scene board is valid as an art-direction source. A pure-white board is easier to
segment. Do not confuse the two:

- use the complete board to preserve the composition, framing, relative scale and visual hierarchy;
- use a white cut-safe board, explicit region masks, or isolated re-generation to obtain clean assets;
- if an isolated asset must be regenerated, its board region and size remain unchanged.

The board is a design master. It is never placed as one large page texture in a production book.
`pageArt` remains a low-detail ground surface; buildings, characters, trees and important props stay
independent standees.

## Board decomposition

After the board is approved, the agent writes `boardItems` for every deliberate visual element:

```json
{
  "id": "board-yuyuko",
  "assetId": "yuyuko-board-01",
  "materialRef": "character:西行寺幽幽子",
  "boardRect": [650, 150, 390, 870],
  "role": "character",
  "layer": "midground",
  "pageSide": "right",
  "depthBand": "midground",
  "cutMode": "regenerate",
  "required": true
}
```

`boardRect` is `[x, y, width, height]` in the board's pixel coordinate system. The table must also
name atmospheric elements the model added. An extra cloud, petal group or mist strip is not silently
ignored: mark it as `atmosphere` or deliberately exclude it in the record.

Use these roles consistently:

- `background`: distant forest, skyline, mountain, mist, wide atmosphere;
- `midground`: character, building, landmark or readable scene subject;
- `foreground`: tree branch, railing, stone, plant or framing prop;
- `atmosphere`: optional low-priority petals, haze or particles;
- `ground`: only when documenting a board element that will be transferred to page ground, not an
  upright standee.

The board item is the stable identity of a visual element. `scene[].boardItemId` points back to it;
`scene[].placementSource` must be `board` in a production book.

## Asset branch: crop or regenerate

Use `cutMode: crop` when the board region has a clean, usable silhouette. Preserve original alpha when
an automatic remover damages an otherwise good asset; record the decision.

Use `cutMode: regenerate` when elements touch, share paper texture, contain baked shadows, or need a
higher-resolution isolated pose. Pass both the relevant world atom cover and the composition board:

- the atom cover locks identity (character or location);
- the board locks pose, relative rendering and lighting;
- the prompt says to reproduce the board pose, not to invent a new placement.

The regenerated file may have new pixels, but it may not change `boardRect`, layer, page side or scale
class. A failed crop is an asset failure, not permission to redesign the spread.

## 2D reconstruction before 3D

Rebuild a 2D proof from the accepted assets and their board rectangles before opening Three.js:

```bash
node scripts/reconstruct-board.mjs \
  --book=/path/to/data/book.json --root=/path/to \
  --spread=chapter-01-spread-01 \
  --out=/path/to/qa/chapter-01-spread-01-reconstruction.svg
```

The script places each accepted asset back into its board rectangle, overlays the source board, and
writes a machine-readable report. A direct crop can be pixel-compared against its board region. A
regenerated asset cannot be expected to match pixels exactly, so compare its region, silhouette,
identity, scale and role instead.

The proof must show:

- no missing or duplicate required item;
- every scene item maps to one board item and the asset ids agree;
- board regions are valid and every source board is the recorded board;
- page-side and layer decisions are explicit;
- intended overlap is recorded, never accidental;
- the original left/right order, relative scale and framing survive.

A failed 2D proof blocks 3D implementation. Do not “fix” it by hand-editing `anchor` values. Repair
the region annotation, the crop/regenerated asset, or the board-to-book calibration.

## Board to book mapping

Use `templates/runtime/board-to-book.mjs` or an equivalent implementation. It keeps board x and size,
then applies a declared depth profile:

```text
board x / width -> page or full-spread x / maxWidth
board y         -> ordering and visual reference, not raw Three.js z
background      -> boardToBook.depthBands.background
midground       -> boardToBook.depthBands.midground
foreground      -> boardToBook.depthBands.foreground
```

Do not treat image y as world z. The board is a 2D art direction surface; the book's z is a physical
page-depth decision. Wide background curtains may use `coordinateSpace: "spread"` and
`crossGutter: true` only when declared. All other pieces obey the gutter and page-side contract.

## One-shot meaning

“One shot” means one user-facing production run, not blind image generation. The agent may repair a
failed asset internally, but it must preserve the approved board and rerun the blocked gate. The
user should not have to hand-tune dozens of coordinates.

The run is complete only when:

```text
world binding -> board -> boardItems -> crop/regenerate -> 2D proof
-> board-to-book mapping -> representative 3D spread -> runtime QA -> publish QA
```

The Little Prince case study shows why the final runtime is worth reusing: its scene recipes separate
paper ground, standees and special paper mechanisms, and its `bookQA` surface can freeze reading,
folds and turns. It is a runtime reference, not a source of story-specific coordinates.

## Evidence boundary and calibration

The reconstruction script emits a structural check and a visual proof with review pending. It does
not recognize identities, assess beauty, or establish image similarity automatically. Inspect the
rendered proof beside the exact source Work before recording visual approval. Placeholder files and
unreviewed reports must fail production validation.

The board-to-book mapper is an initial placement, not an inverse perspective solver. A fixed depth
band cannot guarantee the approved screen-space composition. Freeze a canonical camera, project
standee bounds back to the screen, and compare named landmarks, subject centers, relative sizes and
occlusion order. Refine physical x/z/scale under those constraints, record the adjustment and rerun
both visual and turn QA. Never silently change the design board to excuse the renderer.

Cross-gutter pieces need a declared attachment mechanism and forward/backward tests; a boolean flag
alone does not prove foldability. Prefer splitting distant curtains into page-owned pieces. Real
transparency, hidden silhouettes and missing occluded pixels require visual inspection or isolated
asset generation. Counting connected components does not identify objects.
