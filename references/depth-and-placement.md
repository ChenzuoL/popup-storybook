# Depth and placement — every standee stands on its own z

A pop-up spread is a row of paper planes standing at different distances from the reader. When two
standees share one depth they occupy one plane, and wherever they overlap in x they cut through each
other (穿模). The first production book shipped exactly this: a trunk, a case, a letter and a
rail strip all on `foreground = 0.82`. **No two standees on a spread may share a z.**

## The rule (implemented in `templates/runtime/board-to-book.mjs`)

`anchor[1]` of a scene item is its fold-line depth: 0 = back edge of the page, 1 = front edge.

1. **Layers keep their order.** Each layer owns a window; windows never overlap:

   | layer | default window |
   | --- | --- |
   | background | 0.10 – 0.34 |
   | midground | 0.40 – 0.70 |
   | foreground | 0.75 – 0.97 |

   Override per book with `boardToBook.depthWindows`.
2. **Inside a layer, the board baseline decides.** Baseline = `boardRect.y + boardRect.height`, where
   the piece meets the floor on the master. Lower on the board = closer to the reader = larger z.
   Ties: taller piece further back, then left to right. (Centre-y is wrong: a tall figure and a short
   prop at the same spot have different centres but stand on the same floor line.)
3. **Proportional, then separated.** z is proportional to the baseline inside the window, then swept
   so neighbours are at least `boardToBook.minDepthGap` apart (default 0.02 of page depth). If the
   sweep overflows the window, the layer is spread evenly. A layer that cannot fit its pieces at the
   minimum gap is an error — split it or widen the window; never collapse them.
4. **Manual calibration lives on the board item.** `boardItem.depth` pins one piece (recorded,
   reviewable, must stay inside its window) and still obeys uniqueness. Never hand-edit
   `scene[].anchor`.

`scripts/place-scene.mjs` applies the rule to every spread, keeps scene ids/mechanisms, records
`spread.depthCalibration.order`, and refuses to write a spread with shared depth.
`scripts/validate-book-v3.cjs` rejects shared depth and layer inversions (draft and production);
`scripts/reconstruct-board.mjs` rejects any anchor that is not the rule's output.

## What the renderer adds

- **Rear struts stop short of the piece behind.** Each standee's support strut runs back from 60% of
  its height to the page. Its reach is cut to 80% of the gap to the nearest x-overlapping standee
  behind it (and never past the page's back edge), so a strut cannot pierce a neighbour.
- **Folded cards stack by rank.** While folding flat, each piece lifts by `rank × 0.0008` so flat cards
  lie front-on-top, the way paper closes, instead of z-fighting. Upright pieces stand on the page.
- `window.__neta.depthAudit(minGap)` lists fold lines closer than `minGap` (book units);
  `standeeStates` reports each piece's `z`, `rank` and `strutReach`; `collisions` now also samples
  standee edges against the other standees of the same spread.

## Placement beyond depth

- x and size come from the board rect: page-local for left/right pieces, full-spread for
  `pageSide: "spread"` (curtains, low strips) with `crossGutter: true`.
- Board y is never raw Three.js z. It feeds only the baseline ordering.
- A spread whose recomposition matches the master but looks wrong in 3D needs a recorded
  calibration (`boardItem.depth`, or a different `depthWindows`), then a rerun of place-scene,
  reconstruction and the 3D shots — not a silent anchor edit.
