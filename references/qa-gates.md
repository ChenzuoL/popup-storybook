# Incremental QA Gates

QA is part of production, not a final ceremony. Run the smallest relevant gate immediately after each kind of change. A failed gate blocks expansion to more spreads until fixed or explicitly accepted as a documented limitation.

## Gate 0: Baseline Capture

**When:** before editing an existing book.

- Record current spread order, ids, chapter boundaries, passage/audio paths and bookmark schema version.
- Capture representative front/back/mobile screenshots and run the project's existing smoke tests.
- Note unrelated pre-existing failures. Do not attribute them to the new change or erase user work.

**Exit:** the pre-change contract and known failures are recorded.

## Gate 0b: World Binding

**When:** before storyboarding, and again whenever chapters, cast or events change.

- Run `node scripts/world-survey.cjs --world=<world root>` and record the state verdict and the
  materials actually present.
- Resolve the book's binding: `node scripts/world-survey.cjs --world=<world root> --binding=<data/book.json>`.
  Every bound name must be an atom of the right type; every chapter must have an entry.
- Confirm identity references: each character used has a ready atom cover. A character with no cover
  has no identity reference, which is exactly how the same character drifts between spreads.
- Empty or sparse world: confirm the book's `authored[]` lists what it creates, and that created
  materials are written back as atoms.

**Exit:** the binding resolves, or every unresolved name is recorded as intentionally authored.

## Gate 1: Storyboard and Data

**When:** after storyboarding, before generating a batch of assets; rerun whenever ids, text, page ownership or spread order changes.

- Run the matching validator on the production manifest. New page-first books use `scripts/validate-book-v3.cjs`; existing schema v2 books use `scripts/validate-book-v2.cjs`; legacy schema v1 books use `scripts/validate-book.cjs`.
- Confirm the `worldBinding` block from Gate 0b is present and each chapter names the materials it draws on.
- Check chapter order, reveal timing, stable spread/passage ids, one clear focal subject per spread, page-turn reason and assigned foreground/midground/background.
- For schema v2, confirm `surfacePolicy: ground-only`, alpha masks/bounds, explicit mechanism/reveal fields, and `scenePolicy.requiredLayers`.
- Confirm every passage appears once in causal order and each chapter has one or more ordered spreads.
- Confirm rights/adaptation wording and no printed text requirement.

**Exit:** data validates and a representative chapter/storyboard is approved for large builds.

## Gate 2a: Composition Board

**When:** after the storyboard and before final standee generation; rerun whenever the scene brief,
world references, composition board or visual composition changes.

- Generate one complete board per spread from the bound character/location references and the spread
  event. The board is a layout master, not `pageArt` and not the final flattened scene.
- Confirm the board has the intended aspect, framing, focal subject, relative scale, left/right page
  relationship, foreground crop, midground subject and distant layer.
- Record one stable `compositionBoard.sourceWork`, local file, canvas and approval status per spread.
  A later generated image may not silently replace it.
- Inspect the board for invented or missing elements. Extra petals, clouds or haze become explicit
  atmosphere records or are deliberately excluded; they do not disappear into an unnamed crop.

**Exit:** one board is approved as the sole visual layout source for each changed spread.

## Gate 2b: Board Decomposition

**When:** after each approved board and before producing the corresponding assets.

- Produce `boardItems` for every deliberate character, location, building, tree, prop, background
  curtain and atmosphere element. Each has a stable id, material reference, pixel `boardRect`, role,
  layer, page side, depth band and crop/regenerate decision.
- Confirm every production scene item points to one board item through `boardItemId` and declares
  `placementSource: "board"`. Do not hand-write a replacement anchor after board approval.
- Check the ground rule: horizontal page-ground features remain `pageArt`; vertical structures and
  foreground cutouts become standees. Record intentional overlaps and cross-gutter curtains.
- Run `scripts/validate-book-v3.cjs` without `--production` while the board/reconstruction is still
  being authored. Use `--production` only after Gate 2c. Use `scripts/validate-book-v2.cjs` only for
  an existing asset-first v2 book.

**Exit:** every deliberate board element has a named, typed and traceable decomposition record.

## Gate 2: Asset Intake

**When:** after every generation/crop/background-removal batch, before placing the assets.

- Inspect source and processed asset over light/dark backgrounds.
- Check alpha, full silhouette, no clipped hair/hands/feet/tails/roots, no words/watermarks, no rectangular residue, no duplicate/malformed anatomy.
- Record visible/alpha bounds and intended scale. Compare at least one asset against an in-scene scale reference.
- If a processing service crops/reframes output, recalibrate cell coordinates; never reuse source-sheet cell coordinates blindly.

**Exit:** each accepted asset has a stable id, local file, role, dimensions/provenance and scale intent. Reject or repair failures now.

## Gate 2c: 2D Reconstruction

**When:** after the assets for a spread exist and before any Three.js placement is accepted.

- Run `scripts/reconstruct-board.mjs` for every changed spread and store its SVG and JSON report.
- Confirm no required board item is missing, duplicated or mapped to the wrong asset. Confirm asset ids,
  source board, regions, page side, layer and intended overlap agree.
- Compare the reconstructed board: direct crops can use pixel/alpha comparison; regenerated assets use
  region, silhouette, identity, scale and relative-order checks. Do not demand pixel equality from a
  deliberate re-generation.
- If this gate fails, repair the region annotation or the asset branch. Do not move the board item to
  make a bad asset appear correct.

**Exit:** the accepted assets recompose into the approved board within the declared comparison mode.
Only then may the spread enter 3D.

## Gate 3: Representative Spread

**When:** after the first complete spread in a new visual/mechanical style, before repeating it.

- Render desktop, 390x844 mobile, front, oblique and back views.
- Verify focal subject, page-art/standee separation, physical scale, depth, contact, rear supports, plain paper backs, cut-edge treatment and readable UI.
- Compare the canonical front/oblique render against the 2D reconstruction; relative x, scale and layer
  order must survive the board-to-book mapping. Board y is not raw Three.js z.
- Turn into and out of the spread in both directions at endpoints and intermediate progress.
- Use canvas-pixel checks only as a blank-render guard; inspect screenshots as well.

**Exit:** composition and paper mechanics are approved. Propagate this pattern only after the gate passes.

## Gate 4: Changed Spread or State

**When:** after each spread layout, pose, reveal, material, support or page-texture change. Batch only mechanically identical low-risk changes.

- Verify settled ownership: current spread only.
- Exercise every dialogue/pose/reveal state forward, backward and by direct restore.
- Check actor swaps fold old paper flat first and update geometry, shadow alpha, backing/edge, support height and crease position.
- Sample both adjacent turn pairs, including unchanged neighbors.
- If the approved board or a board item changed, invalidate and rerun Gates 2a–2c before this gate.
- Freeze turns at 0.99, 0.999 and 1.0. Compare attachment transforms and fold/support state; the endpoint handoff must be continuous within the declared tolerance and must not reset unrelated spreads.
- Inspect screenshot and collision output. If composition changes after screenshot approval, invalidate and refresh that evidence.

**Exit:** no new runtime/shader errors, clipping, wrong ownership, stale state, incoherent overlap or reported noncoplanar crossing.

## Gate 5: Chapter

**When:** after all spreads in one chapter are assembled, before starting the next chapter in a chapter-by-chapter workflow.

- Click actual UI arrows through the chapter and over both boundaries.
- Confirm one click means exactly one spread and repeated clicks during the turn are ignored.
- Read all current-spread passages in the UI. If audio exists, play real files through same-spread passages and across a page turn.
- Check directory jumps, chapter labels, thumbnails, mobile/desktop layout and silent bookmark restoration.
- Review a contact sheet for rhythm, distinct composition, scale consistency and accidental repeated pose/layout.

**Exit:** chapter status is recorded as passed, passed with named limitations, or blocked. Do not call the whole book complete.

## Gate 5a: Page Depth and Occlusion

**When:** after page-block, page-surface, spine, material, camera or render-order changes; rerun before publication when any shared renderer code changes.

- Render front, low-angle, normal oblique and side cameras with the full scene.
- Render the same camera set with page blocks, spine and standees hidden so only printed page surfaces remain.
- Sample a grid of interior page pixels and compare color/alpha against the paper-only baseline. Report camera, side, normalized point, threshold and hit class.
- Reject broad slope-based `polygonOffset` on printed pages. Fixed units may be used only with a recorded reason and evidence.
- Check exact turn endpoints for duplicate coplanar static/moving surfaces.

**Exit:** zero unexplained page-interior occlusions, no spine/page-block bleed, and evidence stored with the build.

## Gate 6: Full Book Regression

**When:** after shared renderer/navigation/audio changes and before every final publish. For a narrow isolated asset replacement, rerun affected chapters plus a smoke traversal; state the reduced scope.

- Validate data and every local file. New page-first books use `scripts/validate-book-v3.cjs` and
  `scripts/audit-assets.cjs`; existing v2/v1 books use their matching validators.
- Reconstruct every v3 spread with `scripts/reconstruct-board.mjs`; no failed report may be waived as a
  visual-only issue.
- Traverse every spread forward/back, start/end boundaries, rapid click lock, directory and all migrations.
- Sample all adjacent turns in both directions. Exercise all dynamic states through the runtime contract's deterministic `seekTurn` hook when available.
- Verify backward ownership: the current right-page image remains until the moving leaf lands; outgoing/incoming attachments travel with the leaf and static neighbors do not.
- Run endpoint continuity and page-depth/occlusion checks for shared renderer changes.
- Play representative audio including first, multipassage, cross-page, error and final clips; check decodability/duration of all files.
- Test desktop, mobile and short landscape; inspect front/back; check nonblank pixels and runtime/network errors.
- Regenerate directory/work thumbnails from final layouts. A thumbnail task failure, browser timeout or
  unclean shutdown fails the release; it is not a soft warning.

**Exit:** reproducible tests are stored with the project, every required board/reconstruction report is
clean, processes close cleanly, publication returns ready, and verification distinguishes measured facts
from residual risk.

## Change-to-Gate Matrix

| Change | Required gates |
| --- | --- |
| New chapter, cast or event | 0b, 1, 5, 6 before publish |
| Story text, split or order | 1, 5, 6 before publish |
| Composition board or spread brief | 2a, 2b, 2c, 3, 4, 5, 6 |
| Board region, asset identity or crop mode | 2b, 2, 2c, 3, 4, 5, 6 |
| New generated/cropped asset | 2, 2c, 4; 3 if new visual form |
| Position, scale, pose or reveal | 4, then 5 at chapter finish |
| Page turn, book structure or carrier transform | 3, 4 for all affected neighbors, 5a, 6 |
| Paper material/back/edge/support | 3 front/back, 4, 5a, 6 |
| Camera, depth, render order or page blocks | 3, 5a, 6 |
| Audio text/file/player | 1, 5 audio, 6 audio |
| UI, responsive layout, directory/bookmark | 5 desktop/mobile, 6 navigation/persistence |
| Thumbnail only | inspect target thumbnail and confirm it represents final scene |

## Evidence Record

For every gate record:

- date/build identifier;
- changed spreads/files;
- source board Work/file, board item count and reconstruction report for every changed spread;
- viewport(s), direction(s), state(s), sample count;
- command/script path and exit status;
- screenshots/contact sheet paths;
- failures found and fixes made;
- unrun checks and why;
- remaining limitations.

Never write “QA passed” without naming its scope. Never reuse stale screenshots after layout changes. Never let an assertion pass followed by process timeout become a clean pass without noting the timeout. For page-first books, a board or reconstruction failure is a blocking production failure, not a reason to fall back silently to hand-authored anchors.
