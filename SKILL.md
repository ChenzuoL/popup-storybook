---
name: popup-storybook
description: "Build or refine a browser-based 3D paper pop-up storybook: one questionnaire for style and chapter count, one composition master per spread, every standee cut out of its master in place with qwen-image-2.1, each standee on its own depth, assembled into a world-themed Three.js book with real page turns. Triggers: 立体书, 纸雕绘本, 翻页立体书, pop-up book, paper storybook. Not a branching adventure, static PDF, or manufacturing-ready paper engineering plan."
---

# Pop-Up Storybook

Make an actual readable Three.js book — hardcover boards, page blocks, a curling leaf, paper standees
that rise off the page — dressed for the world it comes from. The pipeline is:

```text
world recon → ONE questionnaire (style, chapters, spreads, story, chrome, narration)
→ storyboard → one composition master per spread → ONE board halt
→ qwen-image-2.1 in-place cut-outs → matte + measure → unique-depth placement → 2D proof
→ world theme → assemble the book → headless QA shots → publish
```

Resolve paths below relative to this SKILL.md. Before building, read `references/questionnaire.md`,
`references/composition-masters.md`, `references/qwen-cutout.md`, `references/depth-and-placement.md`,
`references/book-cover.md`,
`references/theming.md` and `references/engineering.md`; consult `world-recon.md`, `asset-pipeline.md`,
`runtime-contract.md`, `qa-gates.md` and `expansion-and-release.md` when their step comes up. After
changing this skill, run `node scripts/test-skill.cjs`.

## Routing

- Studio web creation, editing and publishing go through `create-web-work`. Updating an existing book
  never creates a new Work.
- Load `generate` before making masters, page grounds, covers or narration audio; read the current
  model declarations rather than assuming parameters.
- The questionnaire call goes through `questionnaire` (this skill fixes what to ask; that skill fixes
  how). Hand-overs go through `interaction-components`; the closing through `next-steps`.
- Set `visualStyle` before creating materials that need covers. Never write the book's printed medium
  into `worldConfig.visualStyle`.
- This local skill must be copied (whole folder) and registered in another world's AGENTS.md before
  it exists there.

## Creator halts — exactly two

1. **Step 1 questionnaire** — style, chapters, spreads per chapter, story, reading chrome, narration.
   Skip only when the brief already names all of them; one missing item is a chat question.
2. **Board halt** — all composition masters of this run handed over together; one question:
   approve and build / redraw named spreads / change direction. Stop the turn.

Everything after board approval — cutting, matting, depth, proof, theme, assembly, QA, publish —
runs in one go. Problems found on the way (a drifted cut, a clipped strut, a failed shot) are repaired
inside the run, not turned into new questions. The only extra stop is a hard block (no credits, a
model gone, a narration file that cannot be produced after the creator chose recorded voice).

## Production workflow

### 0. World reconnaissance

`node scripts/world-survey.cjs --world=<world root>`: atom types, every character/location/event with
cover status, existing works, `populated` / `sparse` / `empty`. Bind chapters to real atoms in
`book.worldBinding`; take each character's and location's **cover URL** as its identity reference
(`boardItem.identityRef`). Empty world: the book authors the atoms and writes them back
(`world-recon.md`). Also check speech models (`cohub models ls --model-type multimodal`) so the
narration question only offers what exists.

### 1. The questionnaire

One round, most important first (`references/questionnaire.md` has the full spec and an example):

1. **风格** — tiles: the world's own style first, then 3–5 paper-friendly style-library styles with
   their (inspected) thumbnails;
2. **做多少章** — cards grounded in the world's events;
3. **每章几个跨页**;
4. **讲哪段故事** — the world's real events by name (skip if the brief named it);
5. **阅读界面** — paper sidebar / text band under the book / almost none;
6. **朗读** — only the options available now.

No image before the round returns. Carry answers into `book.style`, storyboard size,
`worldBinding`, `theme.chrome` and `narration.mode`.

### 2. Storyboard

A table: chapter, stable spread id (`chapter-02-spread-03`), title, key beat, passages, cast on the
spread, backdrop / midground / foreground, page ground, reason to turn. Spread count follows the beats
and the Step 1 answer. Keep causal order; never bring later characters or reveals forward.
Passages are original adaptations; mark them as such.

### 3. Composition masters — then the board halt

Generate **one master per spread in this run's scope**, in parallel, as image Works, using the staging
recipe in `composition-masters.md` (pop-up diorama from the front, everything standing on a visible
floor line, air between pieces, three depth bands, a plain floor band, no text) plus the printed
medium and the cast's atom covers as references. Record each as `spread.compositionBoard` with
`url`, local `file`, `canvas`, `status: "review"`.

Hand all masters over at once and ask the one board question. Stop. On approval set
`status: "approved"`; on "redraw spread N" regenerate only those and ask again. Agent inspection is
never approval; nothing is cut from a `review` master.

### 4. Cut every standee out of its master — qwen-image-2.1, in place

For each master write `boardItems`: one per deliberate element (`composition-masters.md`), each with
`subject` (what the master shows, in English), `label` (short name), a rough `hint` box, `cutMode`
(`isolate` / `isolate-key` / `curtain`), `identityRef`, layer and page side. Read hint boxes off a
grid: `python3 scripts/lib/hint_mask.py <board> 0,0,0,0 grid.png --grid`.

```bash
node scripts/qwen-isolate.mjs --book=data/book.json --spread=<id>      # async + poll, retries, log
python3 scripts/matte.py      --book=data/book.json --spread=<id>      # alpha, boardRect, QA sheets
```

`qwen-isolate` paints everything outside the hint white, names the overlapping neighbours for removal
and asks qwen to keep the one element **at its exact position and size**; isolates go through BiRefNet
(`isolate`) or a white key (`isolate-key`); curtains stay opaque. `matte.py` measures each
`boardRect` from the isolate itself, writes cutouts/masks/alpha bounds into the manifest and renders
`docs/qa/<spread>-standees.png` (light/dark paper) and `<spread>-recompose.png` (master beside the
cutouts pasted back). **Open both.** Re-cut drifted or contaminated items with
`--items=<id> --identity --force`; never accept a drifted cut, never move an element to hide a bad one.
Full recipe and failure handling: `references/qwen-cutout.md`.

Page grounds (ground-only) are generated separately in the book's medium, with the master as a style
reference.

### 4b. Generate the book cover

The cover is its own picture, never a crop of a spread master. Generate it once per book after the
masters are approved: page aspect (`1024x1152` for the default page), one master as style/cast
reference, the book's single most iconic image, **the top third kept calm for the title**, and no
lettering in the art. The runtime sets the title (`covers.title`, default `book.title`) on the cover in
the theme's display face. Record the asset with `provenance.recipe: "book-cover"`. Recipe and checks:
`references/book-cover.md`.

### 5. Every standee on its own z

```bash
node scripts/place-scene.mjs --book=data/book.json
node scripts/reconstruct-board.mjs --book=data/book.json --root=. --spread=<id> --out=docs/qa/<id>-reconstruction.svg
```

`place-scene` derives every `scene[]` item from its board item: x and size from `boardRect`, and a
**unique depth** — layers back to front (background < midground < foreground windows), inside a layer
ordered by the board baseline (y + height), at least `minDepthGap` apart. Shared depth is how props
cut through each other; the validator, the reconstruction and the mapper all reject it. A deliberate
correction goes on `boardItem.depth` (recorded), never on `scene[].anchor`. The renderer also stops
each rear strut short of the standee behind it and stacks folded cards by rank
(`references/depth-and-placement.md`). Approve the reconstruction (structural pass + your visual
comparison with the recomposition) before 3D.

### 6. Dress the book from its world

`python3 scripts/palette.py assets/boards/*.png` proposes the palette from the approved art. Combine it
with the world's genre, era, tone and signature materials into `book.theme`: palette, typography,
chrome (Step 1 answer), reader surface, bar style, labels, and the two colours the book object takes
(board cloth, canvas background). Record `theme.derivedFrom`. Production rejects the template palette.
Spec and rules: `references/theming.md`.

### 7. Assemble the book

`node scripts/scaffold.mjs <book-root>` for a new book (runtime, vendor Three.js, v3 manifest). The
runtime reads everything from `data/book.json`:

- **book object**: the original popup-storybook model — hardcover boards, two page blocks, a curling
  page-turn leaf, original materials, light and camera — opened by **one hinge** (front cover + left
  half of the block turn together up and over the spine; nothing fans out or slides). The closed book
  is drawn at once and textures bind behind it (`references/engineering.md` → Book Object);
- **paper standees**: printed front, plain paper back, rear prop, crease, contact shadow, folding and
  rising with the paper — each on its own depth, **the whole scene on one curve driven by the page
  angle** (no batches, no stagger); left-page pieces are glued to the left page and turn with it;
- **chrome**: a bottom bar in its own row under the canvas — before opening it is the gate (title +
  open button), after opening it is the navigation (prev / next / contents / narration / sound /
  close). Nothing overlays the book. Reader as sidebar, footer band or margin, per theme.

Interaction contract: one arrow click = one spread; repeated clicks during a turn are ignored;
multi-spread turning is tested before release (a single-spread book can't prove it — duplicate the
first spread as labelled test copies if the brief has only one; see `references/qa-gates.md`);
close-book animates back from any spread and keeps the bookmark; reopening goes straight to the
bookmarked spread; close is the original opening reversed and ends in the exact initial closed state;
drag is grab-the-object (yaw ±2.55 rad to walk round the back, pitch above the book), scroll-up zooms in.
Gutter-spanning pieces are cut at the gutter into two halves, each glued to its own page. No on-book
arrows or click-to-turn standees.
Narration: real files advance on `ended`, browser voice only when chosen and labelled, manual
navigation cancels audio.

### 8. Verify and deliver

```bash
python3 scripts/pack-assets.py --book=data/book.json --root=.   # WebP standees, JPEG page art/cover, start-up budget
node scripts/validate-book-v3.cjs data/book.json --production --root=.
node scripts/audit-assets.cjs data/book.json --production --root=.
node scripts/shoot.mjs --root=. --spread=0          # closed, reclosed, closedSide/Low/Back(+J), opening10…95, profile20…80, closing30/60, front, oblique, low, back, mid-turn, mobile
node scripts/shoot.mjs --root=. --spread=0 --views=turn20,turn50,turn80,turnBack50   # multi-spread turning, both directions
python3 scripts/flicker-check.py docs/qa/shots/closedSide.png docs/qa/shots/closedSideJ.png   # and closedLow/closedLowJ
```

A book with a single spread cannot prove page turning. Before the turn shots, add labelled test copies
of spread 1 — no new assets, unique ids, the third copy in a new chapter so chapter switching is
exercised — and remove them before the final release unless the creator wants to keep them:

```bash
node scripts/duplicate-spread.mjs --book=data/book.json --copies=2 --new-chapter-from=3
node scripts/duplicate-spread.mjs --book=data/book.json --remove
```

`shoot.mjs` drives the runtime's `#qa=` entry in headless Chrome and writes PNGs plus `report.json`
(failed assets, depth audit, sampled collisions, opening mechanism and console errors). **Look at every
shot**, and read the opening **as a sequence**: the bar does not cover the book; no piece stands on
paper that is not there yet; the whole scene rises **together with the paper, never in batches**
(left-page pieces turning with their page, gutter pieces split at the gutter) and keeps depth
separation; `closing30/60` lie down the same way; nothing cuts through
(zero sampled collisions); `reclosed` matches `closed`; mobile reads.
Repeat for each spread you changed. Then the remaining gates in `qa-gates.md` at the scope you changed
(adjacent turns both directions, endpoints, page depth, bookmarks).

Publish through `create-web-work`, then verify the **published** build, not the local copy:

```bash
node scripts/probe-live.mjs --url=https://neta.art/w/<owner>/<world>/<work>
```

It reads the Work iframe's real CDN URL from the Studio page and reruns the runtime probes there
(settled desktop/mobile + frozen opening frames). Hand the Work over only when it passes; then hand it over with
`interaction-components`, then close with `next-steps` (the next chapter by name leads).

## Versioned contracts

- **Schema v3** is the production contract: world binding, scene contract, one approved
  `compositionBoard` per spread with `url`, `boardItems` with cut fields, board-derived scene with
  unique depth, a passing reconstruction, `theme`, optional `narration`.
- Schema v2 (asset-first) and v1 remain readable for existing Works; migrate deliberately, never
  silently rename ids. `boardToBook.depthBands` is legacy (shared bands); new books use
  `depthWindows` + `minDepthGap`.

## Defaults the creator can override

- A chapter holds several spreads; a spread is one open left/right pair.
- Narration-led editions keep prose out of printed art; chapter labels and passages live in the
  reader. Printed text on pages only when the creator asks and legibility is designed.
- Page art is ground only. Characters, buildings, trees, vehicles and important props are standees.
- Every normal spread has backdrop, midground and foreground; a deliberately sparse spread sets
  `scenePolicy.sparseIntent` with a reason.
- Opening/closing paper mechanics are the motion; character animation only when the brief asks.

## Reference implementation

The 哈利波特（正牌） world's `works/webs/hogwarts-letter-popup` is the case this version was rebuilt
from: qwen isolation from an approved master, BiRefNet alpha, and the per-item depth fix after a
trunk and a rail strip cut through each other on a shared band. Treat it as a case study: its
assets, copy and story are that world's.
