# Composition masters — one board per spread, the only layout source

A pop-up spread is built from one **composition master** (构图母版): a single full-spread image that
answers "what does this open page look like?" — framing, who stands where, relative scale, the
distant backdrop, the low foreground. Every standee is later cut **out of it** in place
(`qwen-cutout.md`), so the master must be drawn to be cut.

## Generate the masters

After the Step 1 round and the storyboard, generate one master **for every spread in this run's
scope**, in parallel, with `neta generate image` (load the `generate` skill; check the current model's
declared parameters). Each master is saved as an image Work so the creator sees it on the board.

- aspect: the spread (default 3:2, e.g. 1536×1024); record `canvas` from the actual file;
- references: the atom covers of every character and location on that spread (identity), plus the
  previous approved master of the same book when one exists (medium consistency);
- prompt: the printed medium from Step 1 + the staging recipe below + the spread's scene.

### Staging recipe (put this in every master prompt)

Write it in prose, adapted to the scene:

- a **pop-up paper diorama seen from the front**, one continuous scene across a wide spread;
- **every figure and object stands on a visible floor line**, feet and bases showing — nothing floats,
  nothing is cut by the bottom edge except the deliberate foreground strip;
- **clear air between pieces**: characters do not overlap each other by more than a hand; props sit
  beside, not in front of, faces; a figure may stand partly behind a prop only when the story needs it
  (the model will complete the hidden part when cutting);
- **three depth bands**: a distant backdrop (architecture/landscape) across the top two-thirds, a
  midground row of subjects, a low foreground strip or props along the bottom;
- **a plain floor band** across the bottom fifth — this becomes the printed page ground;
- **no text, no captions, no speech bubbles, no frame, no gutter line**;
- keep important faces and hands away from the vertical centre line (the gutter).

### Cast discipline

Only the characters the spread's beat calls for, in causal order — no later characters brought
forward for decoration. Each named character appears once.

## Record the master

```json
"compositionBoard": {
  "sourceWork": "work_01…",
  "url": "https://…/board.png",
  "file": "assets/boards/chapter-01-spread-01.png",
  "canvas": [1536, 1024],
  "coordinateSpace": "full-spread",
  "status": "review"
}
```

`url` is required: qwen edit mode only accepts URLs. `file` is the local copy (download it next to the
book). `status` is `draft` while generating, `review` while the creator looks, `approved` only after
they say so.

## The one board halt

Hand all masters of this run over at once (interaction-components, one card per board Work), then ask
**one** question in the creator's language and stop:

> 这几张构图母版定下来就开始扣图上书 / 重画其中几张（说哪几张、改什么）/ 整体换个方向

- "approve" → set every `status: "approved"` and run the rest of the pipeline in the next turn without
  stopping again.
- "redraw spread 2: Ron further right" → regenerate only those masters, hand only those over, ask again.
- Agent inspection is not approval. Never cut a `review` master.

For a long run (more than ~10 spreads) generate and approve chapter by chapter; say so in the round.

## After approval: decomposition

For every deliberate element on each master, write a `boardItem` (see `qwen-cutout.md` for the
fields). Name every element the model added that you intend to keep; an added cloud or extra lamp is
either a board item or explicitly ignored atmosphere — never silently dropped by a crop. Typical spread:
1 backdrop curtain, 2–5 midground subjects, 1–4 foreground props/strips.

Horizontal ground (floor, path, rug, water) stays in `pageArt`. Vertical things (walls, trees,
railings, people, vehicles, signposts) are standees.

## Proof before 3D

After cutting and `place-scene.mjs`:

```bash
node scripts/reconstruct-board.mjs --book=data/book.json --root=. --spread=<id> --out=docs/qa/<id>-reconstruction.svg
```

It fails on missing/duplicate items, asset mismatches, anchors not derived from the board rule, and
shared depth. Look at it and at `matte.py`'s `<spread>-recompose.png`; when both read as the master,
record `reconstruction.status: "approved"` and the report's `visualReview.status: "approved"` with a
one-line note of what you compared. This is your QA, not a creator halt.
