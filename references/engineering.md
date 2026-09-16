# Engineering and QA Reference

## Structural Model

Use distinct objects for back board, hinged front board, cloth spine/joints, left and right page blocks, gutter, static page surfaces and the deforming leaf. Anchor every standee and its supports in the owning spread's page coordinates. A page surface is not a decorative rectangular card containing another scene.

Keep page block heights stable unless the brief requires physically changing stacks. Hard cover motion and leaf motion are separate. Let the book open into a legible, close, front-biased perspective; constrain camera framing to the available canvas below/above UI rather than the total window.

Map printed textures to page aspect correctly. Crop/contain with intent, never stretch faces or distort circular features. Split imagery at the gutter; keep important details away from the seam. Never mirror lettering or duplicate upright characters into the floor texture.

## Navigation Contract

A schema v2 neutral model is provided in `../templates/book-v2.json`; `../templates/book.json` remains the legacy schema v1 model. Prefer string ids such as `chapter-02-spread-03`, with an explicit `spreadOrder` array. Use `spreadOrder.indexOf(id)` for neighbors, not `id + 1`, chapter number comparisons or sorting ids. A book may contain a cover/frontispiece without treating it as chapter zero.

Minimum renderer adapter:

- `current()` returns spread id, chapter id, passage id/index, ready/turning and final state.
- `turn(direction)` validates neighbor and locks input until complete.
- `goTo(spreadId, passageId)` restores a deterministic scene and cancels stale playback.
- `advanceNarration()` advances passages; only their final ended event requests the next spread.
- `seekTurn(progress)` freezes an active turn at normalized progress for deterministic QA; it must not persist a bookmark or fire completion/audio callbacks.
- `pageSurfaceAudit()` reports low/high ownership, static-page visibility, moving-leaf visibility, render order and depth settings.
- `attachmentSnapshot()` reports every visible attachment's world transform, fold amount, support visibility and owner spread.

Keep manual commands and automatic advancement separate. A UI arrow must not sometimes mean next sentence and sometimes mean next page. Keep whole-spread prose available even when the audio cursor advances.

For migration, map old chapter/line tuples to new spread/passage ids. Reject invalid storage safely. Save only settled states, and do not persist playing=true as a command to make sound on reload.

## Page-Turn Pipeline

1. Validate source/destination and snapshot ownership.
2. Bind low/high (reading order, not numeric id) page textures.
3. Compute continuous curl and page frames from normalized turn progress.
4. Derive fold/reveal values for outgoing and incoming standees.
5. Update poses, dimensions, creases and supports before applying carrier frames.
6. Apply one page-frame transform to each attachment; do not compound it every frame.
7. Update shadow geometry and render.
8. On completion return attachments to static page parents, hide outgoing spread, remove stale carriers, restore depth visibility and publish settled reading state.

Before reapplying a carrier transform restore the attachment's local transform; otherwise drift accumulates. Avoid coincident page surfaces near endpoints through explicit visibility/depth handling, not arbitrary large offsets. Keep alpha-cutout shadow maps synchronized when swapping textures.

At the forward/backward endpoints, the carrier frame and the settled page frame must be numerically identical within a declared tolerance. Do not reset the whole scene at completion; release only the two neighboring spread groups. A page surface must sit above its page block in world space. Broad slope-based polygon offsets are forbidden on printed page surfaces because oblique cameras can push artwork behind the block and expose blank paper or the spine.

## Paper Appearance

Use front illustration color with alpha-tested silhouette. On back-facing fragments replace color with neutral paper but retain the same alpha contour. Tinting the original illustration is not a plain paper back. Avoid a rectangular backing plane visible outside the asset contour. Treat page-surface art as a ground-only material: it may contain ground, path, rug, water or low-detail haze, but not the main architecture or characters when those are intended as standees.

A subtle alpha-neighbor edge shader can suggest cut edges; label it as shading, not actual thickness. If physical thickness is required, derive/extrude the alpha contour with a tested tracing/triangulation library, simplify it, and verify holes and disconnected islands. Do not extrude the enclosing rectangle.

Supports fold behind the standee. Their attachment point and width depend on the current pose height and hinge location. Remove detached support objects when replacing scenes. Hide creases when the corresponding actor is absent. Set lighting, paper grain and contact shadow opacity conservatively; do not bleach the printed artwork.

## Asset Manifest Extras

The minimal template is intentionally small. Extend assets with `sourceUrl`, `sourceImageSize`, `cropRect`, `alphaBounds`, `role`, `identityReference`, `maxWorldWidth`, `maxWorldHeight` and licensing/provenance notes when production needs them. Never place tokens in manifests.

For audio, store model/voice reference provenance plus a text hash and verified duration. Changes to punctuation/text may require new audio. A decodable file does not prove pronunciation, emotion, or faithful words: audit listening separately. Do not silently replace an expressive childlike requested voice with pitched-up browser speech.

## Portability Checklist

Before carrying the skill into another world, confirm the destination has:

- this complete skill folder and a matching AGENTS.md registration;
- current platform web/media skills, supported CLI and a local static/runtime strategy;
- its own visualStyle, rights-safe source text, identity references and generated assets;
- an explicit book manifest or an adapter exposing equivalent chapters, ordered spreads, assets, scene items and passages;
- locally stored reproducible QA scripts and verification evidence.

Do not assume the originating world's paths, numeric ids, Three.js version, Chinese copy, viewport height, audio model/reference, publishing id, palette, page dimensions or chapter count. Feature-detect browser APIs such as dialog, audio and WebGL; provide accessible fallbacks where the target audience requires them. Do not copy placeholders as production assets.

## Scene Composition Contract

For a normal production spread, declare and render all three depth layers:

- **background**: distant silhouette, mountain, skyline, forest wall, cloud bank or architectural backdrop;
- **midground**: main building, landmark, character or readable scene subject;
- **foreground**: low prop, plant, stone, table, grass or other grounding detail.

The page surface is the ground plane, not a substitute for a background layer. Reuse is allowed, but a whole chapter must not become a row of the same empty ground with one character swapped in. If a spread intentionally breaks the three-layer rule, set `scenePolicy.sparseIntent: true` and record why.

## Test Matrix

| Surface | Minimum evidence |
| --- | --- |
| Data | Unique ids, complete order, chapter links, valid scene asset links, attributed text, valid local files |
| Controls | Actual clicks forward/back, ignored repeated clicks in turn, start/end boundaries, canvas does not turn |
| Ownership | Settled state shows current spread only; transition shows only its neighboring pair |
| Assets | Front/back/light/dark checks; no clipped extremities, rectangular alpha residue, mirrored back art or stretched poses |
| Scene composition | Every changed spread and pose, legible focal subject, scale hierarchy, page contact, depth separation |
| Motion | Both directions, endpoints and multiple intermediate progress values, no flashes or accumulating drift |
| Endpoint handoff | Attachment world transforms at 0.99, 0.999, 1.0; no jump, stale carrier or whole-book reset |
| Page depth | Low/normal/side cameras; page-only pixel comparison with blocks/props hidden; no block or spine occlusion |
| Audio | Real playback and ended events; same-spread sequence, auto turn, manual cancellation, error/retry, hidden-tab pause |
| Persistence | Version migration, corrupt storage, settings restore, silent start |
| Layout | Desktop, mobile, short landscape; prose overflow bounded, control access, canvas not covered |
| Rendering | No runtime/shader errors; nonblank pixel checks plus screenshots, not pixel checks alone |
| Publication | Returned ready state, correct unchanged Work, final thumbnails match current scenes |

Apply this matrix through the timed gates in `qa-gates.md`; it is not a final-only checklist.

For visual depth QA, sample page interior points rather than only the canvas standard deviation. A nonblank render can still have its printed page hidden by a page block.

For collision sampling, intersect visible mesh triangle edges against the visible page surfaces. Require sign change across the hit plane, reject coplanar contacts with an explicit tolerance, and exclude detached meshes not descending from the scene root. Log spread pair, direction, normalized time, asset id, support id and hit surface. A sampled pass says nothing definitive about transparency outlines or unsampled times.

## Known Failure Patterns

- A backing material with the same color map still shows a reversed drawing.
- Applying a standing-width cap to seated characters makes them tiny.
- Cropping a sheet after an external service reframed it cuts bodies at old grid boundaries.
- Broad artwork near a gutter intersects the turning leaf even when the settled page looks fine.
- Old hidden gameplay/accordion/canvas-click handlers continue to change narrative state.
- New spread ids point audio to nonexistent files when paths are built from chapter indices.
- Growing a numeric chapters array with extra spread ids changes its length and silently changes the last chapter.
- Swapping only the front texture leaves the old shadow, support height, or crease position behind.
- An orphan mesh outside the rendered scene creates false collision results.
- Directory thumbnails retain deleted corner markers or old scene layouts.
- Test output says PASS before a timed-out browser shutdown; retain the distinction in verification notes.
