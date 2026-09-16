# Pop-Up Storybook

An agent skill for building browser-based 3D paper pop-up storybooks with continuous page turns, page-owned cut-paper standees and deterministic production QA.

A chapter holds multiple spreads. A spread is an open left/right page pair. Printed page art supplies ground and low detail; independent transparent standees supply distant scenery, subjects and foreground props. A turn is one continuously transforming leaf, not a jump between duplicate books.

## What it covers

- **Versioned book contract**: schema v2 for new production books, with schema v1 compatibility for existing books.
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
references/engineering.md            rendering, navigation, composition and failure patterns
references/runtime-contract.md       deterministic renderer adapter and ownership rules
references/asset-pipeline.md          cutout, mask, bounds and provenance pipeline
references/expansion-and-release.md   chapter expansion and live-publication checks
references/qa-gates.md                incremental QA gates and evidence requirements
scripts/scaffold.mjs                  schema v2 and page-turn state scaffold
scripts/validate-book-v2.cjs          schema v2 production validator
scripts/validate-book.cjs             schema v1 validator and v2 dispatcher
scripts/audit-assets.cjs              asset path, mask, bounds and provenance audit
scripts/runtime-contract-check.cjs    turn ownership, synchrony, collision and endpoint checks
scripts/verify-depth-report.cjs       page-interior occlusion report verifier
scripts/test-skill.cjs                complete reusable skill self-test
templates/book-v2.json                schema v2 neutral contract
templates/runtime/page-turn-state.mjs neutral page-turn ownership state machine
templates/book.json                   legacy schema v1 contract
```

## Start a new book

From the skill root:

```bash
node scripts/scaffold.mjs /path/to/book-root
node scripts/validate-book-v2.cjs /path/to/book-root/data/book.json \
  --production \
  --root=/path/to/book-root
```

The scaffold contains text placeholders and repeated placeholder standees. Replace them with audited local assets before shipping.

## Validate and audit

Schema v2:

```bash
node scripts/validate-book-v2.cjs data/book.json --production --root=.
node scripts/audit-assets.cjs data/book.json --production --root=.
```

Legacy schema v1:

```bash
node scripts/validate-book.cjs data/book.json --production --root=.
```

The legacy validator dispatches schema v2 manifests to the v2 validator, but new production code should invoke `validate-book-v2.cjs` explicitly so warnings and contract version are visible.

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

The suite covers legacy and v2 validators, the neutral page-turn state, forward/backward runtime ownership, endpoint regression rejection and page-depth report rejection.

## Notes

- The reusable contract is **ordered spreads + page surfaces + page-owned attachments + passages + optional audio**. It is not tied to a story, visual style, language, page count or id scheme.
- This skill creates a visually simulated paper book, not printable dielines or manufacturing calculations.
- Use a branching narrative/game skill when choices change the path.
- Generated voices must be original and must not be presented as real children. Audit pronunciation and emotion by listening.
- Keep credentials out of manifests and provenance records.
