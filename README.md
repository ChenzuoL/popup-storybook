# Pop-Up Storybook

An agent skill for building browser-based 3D paper pop-up storybooks with continuous page turns, page-owned cut-paper standees and deterministic production QA.

A chapter holds multiple spreads. A spread is an open left/right page pair. Printed page art supplies ground and low detail; independent transparent standees supply distant scenery, subjects and foreground props. A turn is one continuously transforming leaf, not a jump between duplicate books.

## What it covers

- **World reconnaissance first**: inventory this world's characters, locations and events, bind every chapter to them, and take character and location covers as identity references.
- **Page-first composition**: approve a full-spread composition board, decompose it into board regions, produce/crop assets without moving those regions, reconstruct in 2D, then map into Three.js.
- **Versioned book contract**: schema v3 for new page-first books, with schema v2/v1 compatibility for existing books.
- **Neutral page-turn state starter**: ordered spread navigation, forward/backward page ownership, input lock and deterministic turn seeking without story-specific Three.js geometry.
- **Scene composition contract**: ground-only page surfaces plus explicit background, midground and foreground standees, with documented sparse-scene exceptions.
- **Asset intake**: masks, normalized alpha bounds, provenance, identity references, light/dark inspection and physical scale intent.
- **Paper engineering**: separate boards, page blocks, spine, static surfaces, moving leaf, folds, supports, paper backs and contact shadows.
- **Runtime QA contract**: adjacent turns in both directions, backward texture ownership, synchronized mechanisms, endpoint continuity and sampled collision checks.
- **Page-depth QA**: paper-only comparison renders that catch page-block/spine occlusion and unsafe slope-based polygon offsets.
- **Reading and audio**: bounded prose, ended-event advancement, manual cancellation, silent bookmark restore and versioned persistence.
- **Incremental gates**: baseline, storyboard, assets, representative spread, changed state, chapter, page depth and full-book regression.

## Layout

```text
SKILL.md                              production workflow and blocking requirements
references/world-recon.md             Step 0: read the world, bind chapters, source identity references
references/board-first.md              composition board, decomposition, 2D proof and one-shot rules
references/engineering.md              rendering, navigation, composition and failure patterns
references/runtime-contract.md         deterministic renderer adapter and ownership rules
references/asset-pipeline.md           cutout, mask, bounds and provenance pipeline
references/expansion-and-release.md    chapter expansion and live-publication checks
references/qa-gates.md                 incremental QA gates and evidence requirements
scripts/scaffold.mjs                   schema v3 book, proof placeholders and runtime scaffold
scripts/world-survey.cjs               world inventory, state verdict and binding resolution
scripts/validate-book-v3.cjs           schema v3 board-first production validator
scripts/validate-book-v2.cjs           schema v2 asset-first production validator
scripts/validate-book.cjs              schema v1 validator and v2/v3 dispatcher
scripts/audit-assets.cjs               asset path, mask, bounds and provenance audit
scripts/reconstruct-board.mjs          2D board overlay and placement proof
scripts/runtime-contract-check.cjs     turn ownership, synchrony, collision and endpoint checks
scripts/verify-depth-report.cjs        page-interior occlusion report verifier
scripts/test-skill.cjs                 complete reusable skill self-test
templates/book-v3.json                 schema v3 page-first contract
templates/runtime/                    page-turn, board mapping and Three.js runtime
templates/book-v2.json                 existing schema v2 contract
templates/book.json                   legacy schema v1 contract
```

## Step 0 — read the world before designing in it

A storybook is a work *about* a world. Find out what already exists, then bind the book to it:

```bash
node scripts/world-survey.cjs --world=/path/to/world
node scripts/world-survey.cjs --world=/path/to/world --binding=/path/to/data/book.json
```

The first command inventories the world's atoms by type, reports which have a ready cover, lists the
works already made from them, and returns a `populated` / `sparse` / `empty` verdict. The second
resolves a book's `worldBinding` block against that inventory: every chapter must name materials that
really exist, and every character should have a cover, because that cover is its identity reference.

A **populated** world is consumed: bind chapters to its characters, locations and events. A **sparse**
world is partly consumed and partly extended. An **empty** world reverses the direction — the book
creates the world's materials, lists them in `authored[]`, and writes them back as atoms so the next
work inherits them.

## Start a new book

From the skill root:

```bash
node scripts/scaffold.mjs /path/to/book-root
node scripts/validate-book-v3.cjs /path/to/book-root/data/book.json \
  --production \
  --root=/path/to/book-root
node scripts/reconstruct-board.mjs \
  --book=/path/to/book-root/data/book.json --root=/path/to/book-root \
  --spread=chapter-01-spread-01 \
  --out=/path/to/book-root/docs/qa/reconstruction.svg
```

The scaffold includes a runnable Three.js runtime, a neutral page-turn state, board-to-book mapper,
composition-board placeholder and reconstruction proof placeholders. Replace all placeholders with
approved local assets, source boards and visual review records before shipping.

## Validate and audit

New page-first schema v3:

```bash
node scripts/validate-book-v3.cjs data/book.json --production --root=.
node scripts/audit-assets.cjs data/book.json --production --root=.
node scripts/reconstruct-board.mjs --book=data/book.json --root=. --spread=<spread-id> --out=docs/qa/<spread-id>.svg
```

Existing schema v2 and legacy schema v1:

```bash
node scripts/validate-book-v2.cjs data/book.json --production --root=.
node scripts/validate-book.cjs data/book.json --production --root=.
```

The generic validator dispatches schema v2 and v3 manifests to their matching validators. New
production code should invoke `validate-book-v3.cjs` explicitly so board status and reconstruction
requirements are visible. Reconstruction reports distinguish structural pass from pending visual
review; a placeholder or unreviewed proof is not a production pass.

## Runtime and visual QA

A renderer adapter that follows `references/runtime-contract.md` can be tested with:

```bash
node scripts/runtime-contract-check.cjs \
  --adapter=/absolute/path/to/runtime-adapter.cjs \
  --book=/absolute/path/to/data/book.json \
  --out=/absolute/path/to/qa/runtime-report.json
```

Validate a browser-produced page-depth report with:

```bash
node scripts/verify-depth-report.cjs /absolute/path/to/qa/page-depth/report.json
```

These checks complement browser screenshots and human review. Finite collision sampling is not alpha-contour proof, and a nonblank canvas does not prove that the printed page is visible.

## Skill self-test

```bash
node scripts/test-skill.cjs
```

The suite covers legacy, v2 and v3 validators, world reconnaissance across all three world states,
binding resolution, board-to-book mapping, 2D reconstruction, scaffold/runtime files, the neutral
page-turn state, forward/backward runtime ownership, endpoint regression rejection and page-depth
report rejection.

## Notes

- The reusable contract is **ordered spreads + page surfaces + page-owned attachments + passages + optional audio**. It is not tied to a story, visual style, language, page count or id scheme.
- This skill creates a visually simulated paper book, not printable dielines or manufacturing calculations.
- Use a branching narrative/game skill when choices change the path.
- Generated voices must be original and must not be presented as real children. Audit pronunciation and emotion by listening.
- Keep credentials out of manifests and provenance records.
- “One shot” means one user-facing run with internal repair and blocking gates; it does not mean blind image generation or silent manual anchor edits.
