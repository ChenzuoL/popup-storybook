---
name: popup-storybook
description: "Build or refine a browser-based 3D paper pop-up storybook with real page turns, chapter-to-spread storyboarding, independent silhouette standees, illustrated page surfaces, and optional synchronized narration. Triggers: 立体书, 纸雕绘本, 翻页关键帧, pop-up book, paper storybook. Not a branching adventure, static PDF, or manufacturing-ready paper engineering plan."
---

# Pop-Up Storybook

Create an actual readable Three.js book, not a slideshow inside a book-shaped frame. This skill includes a production workflow, board-first contract, Three.js runtime source and QA tools. The scaffold contains draft placeholders; replace and verify assets before delivering a book. It contains no licensed story assets.

Resolve paths below relative to this SKILL.md. Read `references/world-recon.md`, `references/board-first.md`, `references/engineering.md`, `references/runtime-contract.md`, `references/asset-pipeline.md`, `references/expansion-and-release.md` and `references/qa-gates.md` before implementation. Use `templates/book-v3.json` for new page-first production books; use `templates/book-v2.json` for existing v2 books and `templates/book.json` only for legacy schema v1 compatibility. Run the matching validator and board reconstruction against actual book data. After changing the skill, run the complete self-test with `node scripts/test-skill.cjs`.

## Reuse Boundary

This skill applies to fiction, nonfiction, education, exhibition catalogues and other linear illustrated books. Its reusable contract is **ordered spreads + page surfaces + page-owned attachments + passages + optional audio**, not a particular story, art style, language, page count, or numeric id scheme.

Use a simpler web page when no physical book or page-turn behavior is required. Use a branching narrative/game skill when choices change the path. This skill creates a visually simulated paper book, not printable dielines, structural load calculations, or manufacturing instructions. Three.js is the default for a new browser implementation; an existing capable renderer may be retained instead of rewritten.

## Routing and Prerequisites

- For Studio web creation, editing, or publishing, load `create-web-work` and follow its lifecycle. Do not create a new Work when updating an existing book.
- Load `generate` before making images or audio; inspect current model declarations. Never assume an old model or voice parameter remains available.
- Use the applicable asset-sheet skill for reference-guided deterministic sheets. Use background removal only when source alpha is unsuitable; inspect before and after.
- Read this world before designing anything in it: run Step 0 world reconnaissance. Preserve original demos and unrelated content. Set visualStyle before creating materials requiring covers.
- Publish through the supported CLI. Do not hand-edit deployment metadata or embed credentials in browser code.
- This local skill must be installed in another world before it is discoverable there; copy its entire folder, register it in that world's AGENTS.md, and resolve relative paths from that copied SKILL.md. Do not claim account-wide installation.

## Versioned contracts

- **Schema v3 is the production contract for new page-first books.** It requires the v2 world binding and scene contract plus one approved `compositionBoard`, explicit `boardItems`, board-linked scene placements, a passing `reconstruction` proof and a `boardToBook` depth profile.
- **Schema v2 remains readable for existing Works** and is the legacy asset-first contract. Do not silently rewrite old ids or manifests; migrate deliberately.
- **Schema v1 remains readable for legacy Works** but is not the target for new production.
- New renderers expose the runtime surface in `references/runtime-contract.md`: deterministic `seekTurn`, ownership snapshots, page-surface audits and collision samples. Start from `templates/runtime/page-turn-state.mjs`, `templates/runtime/board-to-book.mjs` or run `node scripts/scaffold.mjs <book-root>`; the starter owns state/placement derivation, leaving Three.js materials and story content to the Work.

## Defaults

User preferences override these defaults. Existing application contracts take priority over a new architecture.

- A chapter contains multiple spreads. A spread is an open left/right page pair; it counts as two interior pages.
- One UI right-arrow click turns exactly one spread; left reverses one spread. Ignore further turn requests during a turn.
- Provide a close-book control that animates the binding frame back to the closed state from any spread, cancels active narration, and persists the current bookmark. On reopening, prepare the bookmarked spread's textures before animation starts to avoid flashing through the first page.
- No on-book arrows, floating triangular corners, or click-to-turn standees. Canvas drag is **grab-the-object**: the point under the pointer follows the pointer (the inverse of a camera-slide). Yaw must be wide enough to walk around to the back of the book; pitch stays above the table, from almost top-down to almost table-level; the wheel zooms with conventional scroll-up-in. Keep auto narration separate from manual navigation.
- One spread contains one key scene and one or several speaker-attributed passages. Never force a page turn after every sentence.
- For narration-led editions, keep prose out of printed page artwork and put chapter labels, narration and dialogue in the reading UI. For educational, facsimile or user-requested text-on-page editions, printed text is allowed only when legibility, gutter safety, localization and accessibility are explicitly designed and tested.
- Printed page art supplies ground, paths, rugs, soil, and low detail. Independent transparent standees supply characters, vegetation and important props.
- A production spread normally has all three depth layers: a background curtain or distant silhouette, one or more midground subjects/architecture, and a low foreground prop. A deliberately sparse spread must declare `scenePolicy.sparseIntent` and a reason.
- New spreads are page-first: the **creator** approves one composition board, then the agent decomposes it into board regions, produce/crop assets without changing those regions, pass 2D reconstruction, then map into the 3D book. Agent inspection is not creator approval. The board is never silently replaced by hand-tuned anchors.
- Opening and closing paper mechanisms are the default motion. Add independent character/object animation only when the brief calls for it and it does not undermine the paper construction; test it as a separate state system.
- Preserve plain paper backs, fine contour-edge shading, rear supports, folds, and restrained contact shadows. Do not add exposed front feet.
- Treat page blocks and static paper surfaces as separate depth surfaces. Never use a broad slope-based polygon offset to push printed pages behind page blocks; verify oblique views with the page-depth gate.
- Reading UI never covers the book canvas. Inspection mode may collapse prose but must retain playback and a visible way back. The chrome of that UI (paper sidebar, catalogue, or almost none) is a creator choice asked at Step 1, not an implementation leftover.

## QA Cadence

Load `references/qa-gates.md` and treat its exit criteria as blocking checkpoints. Do not postpone all QA until delivery.

1. Run world reconnaissance and bind the book to this world before storyboarding (Step 0, Gate 0b).
2. Capture an existing-book baseline before edits.
3. Run the storyboard/data gate before composition boards.
4. Generate one representative composition board, hand it to the creator, and wait. Do not expand a visual pattern or produce standees until they approve it (Gate 2a).
5. Annotate boardItems and run the decomposition contract before producing assets (Gate 2b).
6. Run asset intake QA immediately after every crop, re-generation, sheet split or background-removal batch.
7. Reconstruct the spread in 2D and block 3D work until the board proof passes (Gate 2c).
8. Build one representative 3D spread, hand it to the creator, and wait. Do not multiply the renderer pattern until they confirm drag, chrome and paper mechanics (Gate 3).
9. Run state, ownership and adjacent-turn QA after every changed spread; batch only truly mechanical equivalents.
10. Run chapter QA, then ask the creator before starting the next chapter (Gate 5).
11. Run page-depth QA whenever page blocks, surfaces, spine, camera or render order change.
12. Run full regression after shared renderer/navigation/audio changes and before final publication.

A failed gate stops downstream expansion until fixed or explicitly documented and accepted. Record unrun checks and limitations. Evidence becomes stale whenever the related layout, asset, audio or behavior changes.

## Creator halt points

The questionnaire skill is used **once**, at Step 1. Every later stop is one question in the creator's language, then the turn ends. Do not fold these into a second questionnaire.

1. **Step 1 — direction.** World reconnaissance, then one questionnaire: story, scope, printed medium, reading chrome, narration, and POV/audience only if they change the prose. No image until it returns.
2. **Gate 2a — composition board.** Representative board at `review`. Hand it over. Ask: keep this board and start cutting / redraw it / change these named things. Stop. Repeat for later boards unless they already said the approved pattern may roll forward.
3. **Gate 3 — first playable 3D spread.** After the first spread can open, turn and be orbited: hand the Work over. Ask: hand feel is fine, continue the remaining pages / change drag or reading chrome first / stop on this page. Do not generate remaining spreads' 3D in the same turn.
4. **Narration fallback.** As soon as they chose voiced narration and this environment has no speech model, or audio generation fails: ask browser voice, labeled as such / silent this page / wait for files. Do not silently switch to browser speech or omit the label.
5. **Gate 5 — chapter complete.** After chapter QA: keep this chapter as it is / open the next (name the region or legend). Do not start the next chapter in the same turn.

## Production Workflow

### 0. World Reconnaissance

Before the storyboard. Find out what this world already holds, then bind the book to it. Read
`references/world-recon.md`.

- Inventory the world with `node scripts/world-survey.cjs --world=/path/to/world`: the atom types
  actually present, every character/location/event with its description and whether it has a ready
  cover, the works already made from them, and a `populated` / `sparse` / `empty` verdict.
- Bind each chapter to existing characters, locations and events in `book.worldBinding`. One driving
  event per chapter unless two are deliberately merged.
- Take each character's and each location's atom **cover** as its identity reference — a character
  cover becomes a character standee, a location cover becomes a landmark standee — so a subject looks
  the same on every spread and matches how this world already draws it. Resolve names against the
  live world with `--binding=<data/book.json>`.
- **Empty world — the direction reverses.** The book creates the world's materials instead of
  consuming them: set `state: "empty"`, list every invented character/location/event in `authored`,
  and write them back as atoms so this world grows and the next work inherits them.
- Reconcile after any chapter, cast or event change, and re-run the binding check.
- Reading `visualStyle` is not obeying it. A book may keep its own printed medium while the world
  renders differently; record that as the book's own style and leave the world config alone.

### 1. Establish Scope

World reconnaissance first, then one questionnaire round, then any image. The round names real atoms this world already holds. Do not generate a composition board, a standee or a cover until the round has returned.

For a clear brief that already names story, scope, printed medium, reading chrome and narration, skip the round. For a broad brief, use the questionnaire skill once. For one missing scope decision, ask one chat question and stop. Ask what should be made, not which library to use.

A new-book round must cover, in this order, every item the brief left open:

1. **Which story / which chapter** — options grounded in this world's characters, locations, events or legends.
2. **How far this run** — one spread to nail the craft / one complete chapter / a multi-chapter book. Cards, not a slider.
3. **Printed medium of this book** — follow the world's `visualStyle` / watercolor paper-cut / vintage print. Record the answer as the book's own style. Do not write it into `manifest.worldConfig.visualStyle`.
4. **Reading chrome** — paper sidebar (warm stock, titles and passages beside the book) / catalogue (dark, entry-like) / almost none (arrows, close-book, nothing else). This is a creator choice, not a default the agent keeps.
5. **Narration** — recorded or browser-voiced passages, or silent turning.
6. **Point of view and audience** only when they would change the prose.

Do not ask whether the creator wants to review composition boards. They always do. Do not ask which renderer to use. Later stops (board, first 3D, missing voice, next chapter) are one-question halts, not a second questionnaire.

Confirm source story/adaptation rights. Avoid verbatim copying of protected translations or publisher-specific illustrations without authorization. Mark adaptations as adaptations.

### 2. Storyboard Before Assets

Prepare a table: chapter, stable spread id, title, key event, passage ids, flat page art, foreground/midground/background, dominant subject, required poses, assets missing, and narrative reason to turn.

Keep causal order and key dialogue. Do not bring later characters or reveals forward for decoration. A revealing interior picture must not appear before the reveal. A symbolic scene and a literal scene need visibly different staging.

Choose spread count from story beats, not a fixed pages-per-chapter quota. Distinguish 6 spreads from 6 individual pages. For a large book, approve one representative chapter before broad rollout; report exactly which chapters are complete. Follow `references/expansion-and-release.md` when adding chapters or publishing an existing Work.

### 3. Generate and Approve the Composition Board

For the representative spread first — not the whole book — generate one complete composition board
from the storyboard and the bound world references. The board answers “what does this page look
like?”: framing, relative scale, left/right placement, foreground crop, midground subjects, distant
scenery and the intended visual path.

Record it as `spread.compositionBoard` with a stable source Work, local file, canvas,
`coordinateSpace: "full-spread"` and `status: "review"`. This is the spread's layout master. It is
not `pageArt`, not the published background and not a license to flatten the whole scene into one
texture. Page art remains a low-detail ground surface; characters, landmarks, trees and important
props remain independent standees.

**Halt for the creator.** Hand the board Work over with interaction-components. Ask once, in their
language: keep this board and start cutting / redraw it / change these named things. Then stop the
turn. Agent inspection of framing and identity is not approval. `status` stays `review` until the
creator answers. Do not decompose, crop, regenerate standees, build 3D or publish in the same turn
as an unapproved board.

On confirmation, set `status: "approved"` and only then run Step 4. Remaining spreads: generate their
boards and halt again, unless the creator already said the approved pattern may roll forward.

Use a complete textured board for art direction when useful. If direct cutting is desired, generate or
prepare a white cut-safe representation, but do not let a second image silently become a competing
layout. The approved board and its recorded regions are authoritative.

A model-generated board may add atmospheric elements; that is fine, but every deliberate addition
must later be marked as an asset or explicitly recorded as excluded atmosphere.

### 4. Decompose the Board and Produce Assets

After board approval, the agent writes `spread.boardItems`. Each item has a stable id, `boardRect`
in board pixels, material/atom reference, role, layer, page side, depth band and `cutMode` (`crop`,
`regenerate` or documented `manual`). Every production `scene[]` item points back through
`boardItemId` and uses `placementSource: "board"`.

Run `scripts/audit-assets.cjs` after every asset batch. Use `cutMode: crop` only when the board region
has a clean silhouette. If a character or landmark is stuck to scenery, paper texture or another
asset, use `cutMode: regenerate` with both the atom cover and the composition board. Regeneration may
repair pixels, resolution or alpha, but it may not change the approved `boardRect`, page side, layer,
pose intent or scale relationship.

Use the world's character and location covers as identity references. Keep page ground, horizontal
steps and other ground surfaces in `pageArt`; use independent standees for vertical risers, railings,
trees, buildings and foreground framing. Record source board, crop region, alpha bounds, masks, final
size and provenance. A failed crop is an asset failure, not permission to redesign the composition.

### 5. Reconstruct in 2D and Calibrate Placement

Before Three.js, rebuild a 2D proof from the accepted assets and board regions:

```bash
node scripts/reconstruct-board.mjs \
  --book=/path/to/data/book.json --root=/path/to \
  --spread=chapter-01-spread-01 \
  --out=/path/to/qa/chapter-01-spread-01-reconstruction.svg
```

The proof must have no missing or duplicate required items; every scene item must map to one board
item; asset ids must agree; page side, layer and intended overlap must be explicit; and the relative
position, scale and framing of the approved board must survive. Direct crops can be pixel-compared;
regenerated assets are checked by region, silhouette, identity and scale rather than exact pixels.

A failed 2D proof blocks 3D work. Do not fix it by hand-editing anchors. Repair the board annotation,
the asset branch or the source board. Then use `templates/runtime/board-to-book.mjs` to derive x,
size, page side and the declared depth band. Board y is not raw Three.js z: use `boardToBook.depthBands`
and a fixed canonical camera profile. The mapper is an initial placement: verify projected bounds and occlusion against the board, and record any physical calibration adjustments. Wide background curtains may use `coordinateSpace: "spread"`
and `crossGutter: true` only when the board item explicitly permits it.

### 6. Implement the Book

Pass the mechanical checks of Gate 3 only after the board and 2D reconstruction gates pass. Then **halt
for the creator**: publish or preview the first playable spread, hand the Work over, ask whether to
continue remaining pages, change drag or chrome, or stop here. Do not generate the remaining spreads'
3D in that turn. After they confirm, run Gate 4 after each changed spread/state. If page-turn or
shared renderer code changes, schedule Gate 6.

Use `references/engineering.md` and `references/runtime-contract.md`. Keep chapter identity, spread
identity, board identity, passage identity, scene ownership and audio identity separate. Inserted spreads
must not rename old audio or break bookmarks.

Create every spread as its own scene. A turn is a continuous leaf transformation, not an invisible jump
between duplicate books. Page texture and standees must follow the same page frame. Use fixed page-block
heights unless requested otherwise. Start from `templates/runtime/page-turn-state.mjs` and the
parameterized Three.js runtime when appropriate; do not copy story-specific scene recipes from a case
study.

When dialogue-driven changes are wanted, describe deterministic target states. Fold the old actor fully
before changing geometry, pose or position; then raise the replacement. No sliding actors across paper.
Synchronize mesh, alpha shadows, back/edge material, dimensions, crease and rear supports. Reverse
reading and restored bookmarks must produce the same state.

### 7. Reading and Audio

If Step 1 chose voiced narration, inspect current `generate` speech models before attaching audio.
When no speech model is available, or a narration file fails to generate, **halt**: browser voice,
labeled in the UI / silent this page / wait for files. Do not silently switch. A labeled browser
fallback is allowed only after they pick it.

Run the audio and persistence portions of QA Gate 5 as soon as the first narrated multipassage spread works; repeat at chapter completion.

Show all current-spread passages in a bounded reading region. Highlight the actually playing passage; do not fake word-level alignment without timestamps.

Use ended events to advance to the next passage, then after a deliberate pause turn the page. Never use estimated text durations when real audio exists. Initial playback requires a user action. Manual page navigation cancels old audio; backgrounding pauses; failures stop with retry rather than silently skipping. Include pause/resume, replay and speed control.

Keep explicit audio paths on passages. Reuse unchanged recordings after splitting spreads. Persist versioned bookmark/settings locally and migrate earlier ids/offsets. Restore silently. Do not promise cross-device storage without an implemented backend.

### 8. Verify and Deliver

Complete Gate 5 for every changed chapter. **Halt before the next chapter**: keep this chapter / open
the next, naming the region or legend. Then run Gate 6 at publication scope. Run the data validator, then actual browser QA. Data validation is not visual QA. Do not rerun only the final list while skipping the earlier asset and representative-spread gates.

- Click actual UI arrows forward/back through every changed spread and chapter boundary; test rapid clicks, directory jumps, bookends, and old bookmarks.
- Play real audio: multiple passages on one spread, end-to-turn, pause/resume, manual cancellation, errors, replay and final stop.
- Inspect front, back, oblique view and intermediate turn screenshots. Test at least desktop and 390x844 mobile. Canvas-pixel variance must be nonzero, assets loaded, UI separate, text readable.
- For schema v3, run `scripts/reconstruct-board.mjs` for every changed spread and store its SVG/report. A failed or timed-out reconstruction blocks publication.
- Run the page-depth gate: compare full-book and paper-only renders at low, normal and side camera angles. Confirm printed page pixels are not hidden by page blocks or spine; record the sample grid and threshold.
- Sample both turn directions across every affected adjacent pair, including unchanged neighbors. Filter out detached/hidden legacy meshes. Check noncoplanar paper/support edges against page surfaces and the moving leaf; report pair, direction, progress, asset/support id, hit surface, sample count, failures and limitations. Never call finite sampling a proof of no intersection.
- Freeze at endpoint and near-endpoint progress values. Assert no attachment position/orientation jump and no whole-book scene reset.
- Check every pose and reveal state when used, including reverse and restored states. Regenerate affected directory thumbnails after final layout changes.
- Finish/close test browser sessions; record shutdown errors as errors, not clean test completion. A browser timeout, thumbnail failure or incomplete shutdown is a failed gate, not a warning. Store reproducible tests with the project, not only in temporary files.
- For an adapter exposing the runtime contract, run `scripts/runtime-contract-check.cjs` across every adjacent pair in both directions. Validate any browser-produced page-depth report with `scripts/verify-depth-report.cjs`.
- Re-run `scripts/world-survey.cjs --binding=<data/book.json>` so every bound name still resolves to an atom in this world. A chapter that invents canon without an `authored` entry is an error, not a gap.
- Publish, verify returned ready state, and summarize implemented scope versus deliberate simplifications. Hand over the Work using interaction-components; use next-steps for creative follow-on choices.

## Reference Implementation

In the originating world, `works/webs/little-prince-pop-up-sample` demonstrates the approach. Treat it as a case study, not a portable dependency: it contains story-specific assets, legacy numeric ids and hidden historical code. Read it only when available; never copy the whole application and claim it is a neutral template. Do not copy its story, generated assets or audio into another project without checking the intended reuse rights.
