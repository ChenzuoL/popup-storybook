# Incremental QA Gates

QA is part of production, not a final ceremony. Run the smallest relevant gate immediately after each kind of change. A failed gate blocks expansion to more spreads until fixed or explicitly accepted as a documented limitation.

## Gate 0: Baseline Capture

**When:** before editing an existing book.

- Record current spread order, ids, chapter boundaries, passage/audio paths and bookmark schema version.
- Capture representative front/back/mobile screenshots and run the project's existing smoke tests.
- Note unrelated pre-existing failures. Do not attribute them to the new change or erase user work.

**Exit:** the pre-change contract and known failures are recorded.

## Gate 1: Storyboard and Data

**When:** after storyboarding, before generating a batch of assets; rerun whenever ids, text, page ownership or spread order changes.

- Run `scripts/validate-book.cjs` on the production manifest when the project uses the provided contract.
- Check chapter order, reveal timing, stable spread/passage ids, one clear focal subject per spread, page-turn reason and assigned foreground/midground/background.
- Confirm every passage appears once in causal order and each chapter has one or more ordered spreads.
- Confirm rights/adaptation wording and no printed text requirement.

**Exit:** data validates and a representative chapter/storyboard is approved for large builds.

## Gate 2: Asset Intake

**When:** after every generation/crop/background-removal batch, before placing the assets.

- Inspect source and processed asset over light/dark backgrounds.
- Check alpha, full silhouette, no clipped hair/hands/feet/tails/roots, no words/watermarks, no rectangular residue, no duplicate/malformed anatomy.
- Record visible/alpha bounds and intended scale. Compare at least one asset against an in-scene scale reference.
- If a processing service crops/reframes output, recalibrate cell coordinates; never reuse source-sheet cell coordinates blindly.

**Exit:** each accepted asset has a stable id, local file, role, dimensions/provenance and scale intent. Reject or repair failures now.

## Gate 3: Representative Spread

**When:** after the first complete spread in a new visual/mechanical style, before repeating it.

- Render desktop, 390x844 mobile, front, oblique and back views.
- Verify focal subject, page-art/standee separation, physical scale, depth, contact, rear supports, plain paper backs, cut-edge treatment and readable UI.
- Turn into and out of the spread in both directions at endpoints and intermediate progress.
- Use canvas-pixel checks only as a blank-render guard; inspect screenshots as well.

**Exit:** composition and paper mechanics are approved. Propagate this pattern only after the gate passes.

## Gate 4: Changed Spread or State

**When:** after each spread layout, pose, reveal, material, support or page-texture change. Batch only mechanically identical low-risk changes.

- Verify settled ownership: current spread only.
- Exercise every dialogue/pose/reveal state forward, backward and by direct restore.
- Check actor swaps fold old paper flat first and update geometry, shadow alpha, backing/edge, support height and crease position.
- Sample both adjacent turn pairs, including unchanged neighbors.
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

## Gate 6: Full Book Regression

**When:** after shared renderer/navigation/audio changes and before every final publish. For a narrow isolated asset replacement, rerun affected chapters plus a smoke traversal; state the reduced scope.

- Validate data and every local file.
- Traverse every spread forward/back, start/end boundaries, rapid click lock, directory and all migrations.
- Sample all adjacent turns in both directions. Exercise all dynamic states.
- Play representative audio including first, multipassage, cross-page, error and final clips; check decodability/duration of all files.
- Test desktop, mobile and short landscape; inspect front/back; check nonblank pixels and runtime/network errors.
- Regenerate directory/work thumbnails from final layouts.

**Exit:** reproducible tests are stored with the project, processes close cleanly, publication returns ready, and verification distinguishes measured facts from residual risk.

## Change-to-Gate Matrix

| Change | Required gates |
| --- | --- |
| Story text, split or order | 1, 5, 6 before publish |
| New generated/cropped asset | 2, 4; 3 if new visual form |
| Position, scale, pose or reveal | 4, then 5 at chapter finish |
| Page turn, book structure or carrier transform | 3, 4 for all affected neighbors, 6 |
| Paper material/back/edge/support | 3 front/back, 4, 6 |
| Audio text/file/player | 1, 5 audio, 6 audio |
| UI, responsive layout, directory/bookmark | 5 desktop/mobile, 6 navigation/persistence |
| Thumbnail only | inspect target thumbnail and confirm it represents final scene |

## Evidence Record

For every gate record:

- date/build identifier;
- changed spreads/files;
- viewport(s), direction(s), state(s), sample count;
- command/script path and exit status;
- screenshots/contact sheet paths;
- failures found and fixes made;
- unrun checks and why;
- remaining limitations.

Never write “QA passed” without naming its scope. Never reuse stale screenshots after layout changes. Never let an assertion pass followed by process timeout become a clean pass without noting the timeout.
