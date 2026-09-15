# Pop-Up Storybook

An agent skill for building a browser-based 3D paper pop-up storybook with real page turns.

A chapter holds multiple spreads. A spread is an open left/right page pair, and a turn is a continuous leaf transformation rather than a jump between duplicate books. Printed page art supplies ground and low detail; independent transparent standees supply characters, vegetation and important props.

## What it covers

- **Storyboarding before assets** — chapter/spread tables with stable ids, causal order, and a stated narrative reason for each turn.
- **Scale and composition discipline** — focal subject per spread, scale hierarchy, visible-bounds fitting, and pose-specific limits so seated or wide-scarf poses are not forced into a standing width.
- **Asset audit** — alpha inspected over light and dark backgrounds, extremities preserved through cropping, sheet splits driven by observed cell bounds rather than guessed equal cells.
- **Page-turn pipeline** — separate back board, hinged front board, spine, page blocks, gutter, static surfaces and the deforming leaf; attachment transforms restored before reapplication so drift cannot accumulate.
- **Paper appearance** — front illustration with alpha-tested silhouette, neutral paper on back-facing fragments, contour-derived supports and restrained contact shadows.
- **Reading and audio** — bounded prose region, real ended-event driven advancement, user-gesture initial playback, manual navigation cancelling stale audio, and versioned local bookmarks.
- **Timed QA gates** — baseline, storyboard, asset intake, representative spread, per-spread state, chapter, and full regression, with a test matrix covering data, controls, ownership, motion, audio, persistence, layout and rendering.

## Layout

```text
SKILL.md                          workflow, defaults, QA cadence, delivery
references/engineering.md         structural model, navigation contract, page-turn pipeline, failure patterns
references/qa-gates.md            blocking gate definitions and exit criteria
scripts/validate-book.cjs         book-data validator
scripts/test-validator.cjs        validator self-test with negative cases
templates/book.json               neutral starting contract
templates/placeholders/           stand-in page art and standee entries
```

## Usage

Validate book data from the skill root:

```bash
node scripts/validate-book.cjs templates/book.json --root=.
node scripts/validate-book.cjs book.json --production --root=/path/to/book
```

`--root` sets the base that asset paths resolve against. Without it the root defaults to the book file's own directory, so `templates/book.json` must be validated with `--root=.` or its placeholder paths will not resolve.

Check the validator itself after changing it or the template:

```bash
node scripts/test-validator.cjs
```

## Notes

- The contract is **ordered spreads + page surfaces + page-owned attachments + passages + optional audio**. It is not tied to a story, art style, language, page count or id scheme.
- This skill creates a visually simulated paper book. It is not printable dielines, structural load calculations, or manufacturing instructions.
- For a branching narrative where choices change the path, use a branching/game skill instead.
- Generated voices must be original and never presented as real children. A decodable audio file does not prove pronunciation or emotion; audit by listening.
- `templates/book.json` and `templates/placeholders/` are neutral scaffolding, not production content. Replace them before shipping.
- The bundled placeholder entries are text stand-ins, so the validator only confirms that the referenced paths exist. It does not prove that page art or standees are actually supplied or audited.
- This skill was copied verbatim from the Studio world it was authored in, and is preserved here without modification.
