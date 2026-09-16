---
name: popup-storybook
description: "Build or refine a browser-based 3D paper pop-up storybook with real page turns, chapter-to-spread storyboarding, independent silhouette standees, illustrated page surfaces, and optional synchronized narration. Triggers: 立体书, 纸雕绘本, 翻页关键帧, pop-up book, paper storybook. Not a branching adventure, static PDF, or manufacturing-ready paper engineering plan."
---

# Pop-Up Storybook

Create an actual readable Three.js book, not a slideshow inside a book-shaped frame. This skill is a production workflow, data contract, neutral page-turn state starter, and QA guide; it does not include a complete standalone Three.js renderer or licensed story assets.

Resolve paths below relative to this SKILL.md. Read `references/world-recon.md`, `references/engineering.md`, `references/runtime-contract.md`, `references/asset-pipeline.md`, `references/expansion-and-release.md` and `references/qa-gates.md` before implementation. Use `templates/book-v2.json` for new production books; use `templates/book.json` only for legacy schema v1 compatibility. Run the matching validator against actual book data. After changing the skill, run the complete self-test with `node scripts/test-skill.cjs`.

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

- **Schema v2 is the production contract for new books.** It requires a `worldBinding` block from Step 0, `sceneContractVersion: 1`, page-art `surfacePolicy: ground-only`, explicit `maskFile` and `alphaBounds` for standees, `mechanism`, `reveal`, and `scenePolicy.requiredLayers` containing background, midground and foreground.
- **Schema v1 remains readable for legacy Works** but is not the target for new production. Do not silently rewrite old ids or manifests; migrate deliberately.
- New renderers expose the runtime surface in `references/runtime-contract.md`: deterministic `seekTurn`, ownership snapshots, page-surface audits and collision samples. Start from `templates/runtime/page-turn-state.mjs` or run `node scripts/scaffold.mjs <book-root>`; the starter owns state/ownership only, leaving Three.js geometry and materials to the Work.

## Defaults

User preferences override these defaults. Existing application contracts take priority over a new architecture.

- A chapter contains multiple spreads. A spread is an open left/right page pair; it counts as two interior pages.
- One UI right-arrow click turns exactly one spread; left reverses one spread. Ignore further turn requests during a turn.
- No on-book arrows, floating triangular corners, or click-to-turn standees. Canvas drag rotates the book. Keep auto narration separate from manual navigation.
- One spread contains one key scene and one or several speaker-attributed passages. Never force a page turn after every sentence.
- For narration-led editions, keep prose out of printed page artwork and put chapter labels, narration and dialogue in the reading UI. For educational, facsimile or user-requested text-on-page editions, printed text is allowed only when legibility, gutter safety, localization and accessibility are explicitly designed and tested.
- Printed page art supplies ground, paths, rugs, soil, and low detail. Independent transparent standees supply characters, vegetation and important props.
- A production spread normally has all three depth layers: a background curtain or distant silhouette, one or more midground subjects/architecture, and a low foreground prop. A deliberately sparse spread must declare `scenePolicy.sparseIntent` and a reason.
- Opening and closing paper mechanisms are the default motion. Add independent character/object animation only when the brief calls for it and it does not undermine the paper construction; test it as a separate state system.
- Preserve plain paper backs, fine contour-edge shading, rear supports, folds, and restrained contact shadows. Do not add exposed front feet.
- Treat page blocks and static paper surfaces as separate depth surfaces. Never use a broad slope-based polygon offset to push printed pages behind page blocks; verify oblique views with the page-depth gate.
- Reading UI never covers the book canvas. Inspection mode may collapse prose but must retain playback and a visible way back.

## QA Cadence

Load `references/qa-gates.md` and treat its exit criteria as blocking checkpoints. Do not postpone all QA until delivery.

1. Capture an existing-book baseline before edits.
2. Run the storyboard/data gate before asset batches.
3. Run asset intake QA immediately after every generation, crop, sheet split or background-removal batch.
4. Build and approve one representative spread before multiplying a new visual or mechanical pattern.
5. Run state, ownership and adjacent-turn QA after every changed spread; batch only truly mechanical equivalents.
6. Run chapter QA before moving to the next chapter when working chapter by chapter.
7. Run full regression after shared renderer/navigation/audio changes and before final publication.

A failed gate stops downstream expansion until fixed or explicitly documented and accepted. Record unrun checks and limitations. Evidence becomes stale whenever the related layout, asset, audio or behavior changes.

## Production Workflow

### 0. World Reconnaissance

Before the storyboard. Find out what this world already holds, then bind the book to it. Read
`references/world-recon.md`.

- Inventory the world with `node scripts/world-survey.cjs --world=/path/to/world`: the atom types
  actually present, every character/location/event with its description and whether it has a ready
  cover, the works already made from them, and a `populated` / `sparse` / `empty` verdict.
- Bind each chapter to existing characters, locations and events in `book.worldBinding`. One driving
  event per chapter unless two are deliberately merged.
- Take each character's atom **cover** as its identity reference, so it looks the same on every
  spread. Resolve names against the live world with `--binding=<data/book.json>`.
- **Empty world — the direction reverses.** The book creates the world's materials instead of
  consuming them: set `state: "empty"`, list every invented character/location/event in `authored`,
  and write them back as atoms so this world grows and the next work inherits them.
- Reconcile after any chapter, cast or event change, and re-run the binding check.
- Reading `visualStyle` is not obeying it. A book may keep its own printed medium while the world
  renders differently; record that as the book's own style and leave the world config alone.

### 1. Establish Scope

For a clear brief, proceed. For a broad brief with multiple open direction choices, use the questionnaire skill once. For one missing scope decision, ask one chat question and stop. Ask what should be made, not which library to use.

Confirm source story/adaptation rights, audience, chapter range, visual style, and whether narration is required. Avoid verbatim copying of protected translations or publisher-specific illustrations without authorization. Mark adaptations as adaptations.

### 2. Storyboard Before Assets

Prepare a table: chapter, stable spread id, title, key event, passage ids, flat page art, foreground/midground/background, dominant subject, required poses, assets missing, and narrative reason to turn.

Keep causal order and key dialogue. Do not bring later characters or reveals forward for decoration. A revealing interior picture must not appear before the reveal. A symbolic scene and a literal scene need visibly different staging.

Choose spread count from story beats, not a fixed pages-per-chapter quota. Distinguish 6 spreads from 6 individual pages. For a large book, approve one representative chapter before broad rollout; report exactly which chapters are complete. Follow `references/expansion-and-release.md` when adding chapters or publishing an existing Work.

### 3. Lock Scale and Composition

For each spread declare a focal subject and scale hierarchy. Trees exceed people in a literal forest; low grass does not exceed the main animal; props relate to the hands or setting that use them. Enlarged drawing exhibits are explicitly nonliteral.

Measure opaque/visible bounds, not the texture canvas. Preserve aspect ratio using `scale = min(maxWidth / visibleWidth, maxHeight / visibleHeight)`. Set pose-specific limits: a seated or wide-scarf pose cannot inherit narrow standing width blindly.

Design rear silhouettes, midground actors and low foreground. Avoid a row of identical trees, a trunk growing from a character's head, feet detached from the page, or a giant foreground prop hiding faces. Richness is coherent environmental detail, not a fixed standee count. Deliberate empty space still belongs to a complete scene.

### 4. Produce and Audit Assets

Run QA Gate 2 after each asset batch; do not wait until all chapters are populated. Run `scripts/audit-assets.cjs` for every schema v2 production manifest.

Reuse approved identity references. Generate missing characters/poses and environmental elements in a unified medium. Generate low-contrast, unlettered page-surface textures separately from upright assets.

Inspect alpha over light and dark backgrounds; complete hair, hands, tails, scarves and roots must survive cropping. Preserve good original alpha. Background-removal success does not guarantee preserved dimensions or limbs. Split sheets using observed cell bounds, not guessed equal cells after a service has cropped them.

Record source URLs, crop rectangles, alpha bounds, final sizes, intended physical scale, and generation provenance. Keep identity references separate from pixel provenance. Do not include secrets or claim generated voices are real children.

### 5. Implement the Book

Pass QA Gate 3 on one representative spread, then Gate 4 after each changed spread/state. If page-turn or shared renderer code changes, schedule Gate 6.

Use the structural guidance in `references/engineering.md` and the runtime contract in `references/runtime-contract.md`. Keep chapter identity, spread identity, ordered navigation, passage identity, scene ownership, and audio identity separate. Inserted spreads must not rename old audio or break bookmarks.

Create every spread as its own scene. A turn is a continuous leaf transformation, not an invisible jump between duplicate books. Page texture and standees must follow the same page frame. Use fixed page-block heights unless requested otherwise.

When dialogue-driven changes are wanted, describe deterministic target states. Fold the old actor fully before changing geometry, pose or position; then raise the replacement. No sliding actors across paper. Synchronize mesh, alpha shadows, back/edge material, dimensions, crease and rear supports. Reverse reading and restored bookmarks must produce the same state.

### 6. Reading and Audio

Run the audio and persistence portions of QA Gate 5 as soon as the first narrated multipassage spread works; repeat at chapter completion.

Show all current-spread passages in a bounded reading region. Highlight the actually playing passage; do not fake word-level alignment without timestamps.

Use ended events to advance to the next passage, then after a deliberate pause turn the page. Never use estimated text durations when real audio exists. Initial playback requires a user action. Manual page navigation cancels old audio; backgrounding pauses; failures stop with retry rather than silently skipping. Include pause/resume, replay and speed control.

Keep explicit audio paths on passages. Reuse unchanged recordings after splitting spreads. Persist versioned bookmark/settings locally and migrate earlier ids/offsets. Restore silently. Do not promise cross-device storage without an implemented backend.

### 7. Verify and Deliver

Complete Gate 5 for every changed chapter and Gate 6 at publication scope. Run the data validator, then actual browser QA. Data validation is not visual QA. Do not rerun only the final list while skipping the earlier asset and representative-spread gates.

- Click actual UI arrows forward/back through every changed spread and chapter boundary; test rapid clicks, directory jumps, bookends, and old bookmarks.
- Play real audio: multiple passages on one spread, end-to-turn, pause/resume, manual cancellation, errors, replay and final stop.
- Inspect front, back, oblique view and intermediate turn screenshots. Test at least desktop and 390x844 mobile. Canvas-pixel variance must be nonzero, assets loaded, UI separate, text readable.
- Run the page-depth gate: compare full-book and paper-only renders at low, normal and side camera angles. Confirm printed page pixels are not hidden by page blocks or spine; record the sample grid and threshold.
- Sample both turn directions across every affected adjacent pair, including unchanged neighbors. Filter out detached/hidden legacy meshes. Check noncoplanar paper/support edges against page surfaces and the moving leaf; report pair, direction, progress, asset/support id, hit surface, sample count, failures and limitations. Never call finite sampling a proof of no intersection.
- Freeze at endpoint and near-endpoint progress values. Assert no attachment position/orientation jump and no whole-book scene reset.
- Check every pose and reveal state when used, including reverse and restored states. Regenerate affected directory thumbnails after final layout changes.
- Finish/close test browser sessions; record shutdown errors as errors, not clean test completion. Store reproducible tests with the project, not only in temporary files.
- For an adapter exposing the runtime contract, run `scripts/runtime-contract-check.cjs` across every adjacent pair in both directions. Validate any browser-produced page-depth report with `scripts/verify-depth-report.cjs`.
- Re-run `scripts/world-survey.cjs --binding=<data/book.json>` so every bound name still resolves to an atom in this world. A chapter that invents canon without an `authored` entry is an error, not a gap.
- Publish, verify returned ready state, and summarize implemented scope versus deliberate simplifications. Hand over the Work using interaction-components; use next-steps for creative follow-on choices.

## Reference Implementation

In the originating world, `works/webs/little-prince-pop-up-sample` demonstrates the approach. Treat it as a case study, not a portable dependency: it contains story-specific assets, legacy numeric ids and hidden historical code. Read it only when available; never copy the whole application and claim it is a neutral template. Do not copy its story, generated assets or audio into another project without checking the intended reuse rights.
