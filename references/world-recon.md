# World reconnaissance — Step 0

A storybook is a work *about a world*, not a standalone artifact. Before any storyboard or asset is
made, find out what this world already holds: who and what already exists, what they look like, what
has already been made from them. This step feeds two things that nothing later can repair — **content
provenance** (the book must not contradict or silently duplicate canon) and **identity consistency**
(a character must look the same on every spread).

Do this before Step 1. Its output is a `worldBinding` block in the book manifest.

## Read list

Read these, in order. Use `scripts/world-survey.cjs` to do the inventory in one pass.

| Read | Fields that matter |
| --- | --- |
| `manifest.json` → `worldConfig` | `name`, `genre`, `tone`, `era`, `language`, `visualStyle`, `coreConflict`, `rules` |
| `manifest.json` → `atoms[]` | `id`, `type`, `name`, `description`, `path` |
| `manifest.json` → `works[]` | `id`, `type`, `title`, `path` — what already exists |
| `manifest.json` → `phase` | whether the world is still being authored |
| `materials/<type>/<atomId>.json` | `name`, `type`, `description`, `content`, `tags`, `coverArtifactPath` |
| `artifacts/covers/<atomId>.json` | `status`, `url` — the atom's own cover |
| `works/webs/*`, `works/images/*` | sibling works: reuse art before regenerating it |

Atom types are not fixed across worlds. Expect at least `character`, `location`, `event`; a world may
also carry `factions`, `races`, `item`, `lore`. Enumerate what is actually there rather than assuming.

## Produce: the binding table

Add a `worldBinding` block to the book manifest:

```json
"worldBinding": {
  "worldId": "world_01...",
  "state": "populated",
  "chapters": [
    {
      "chapterId": "chapter-01",
      "characters": ["博丽灵梦", "雾雨魔理沙"],
      "locations": ["博丽神社"],
      "events": ["红雾异变"]
    }
  ],
  "authored": []
}
```

- Every name must match an atom `name` of the right type in this world.
- `state` is `populated`, `sparse` or `empty` (below).
- `authored` lists materials this book created because the world did not have them.
- One chapter may bind several characters and locations but should name exactly one driving event
  unless the chapter deliberately merges two.

Validate the shape with the book validator; resolve the names against the live world with:

```bash
node scripts/world-survey.cjs --world=/path/to/world --binding=/path/to/data/book.json
```

## Identity references

An atom's own cover is the identity reference. This is the mechanism that keeps a character looking
the same across spreads, and it is why reconnaissance is not optional:

- Prefer the generator's native atom reference syntax when it exists (`@CharacterName`), which
  resolves to that atom's cover.
- Otherwise read `coverArtifactPath`, follow it to `url`, and pass the cover as a reference image
  with the medium/identity split stated in the prompt: *one reference supplies the printing medium
  only; this one supplies the character's identity and costume.*
- Record the atom id on the asset as `identityReference`, separately from pixel provenance.

Do not invent an identity description when an atom already carries the character. Do not overwrite,
re-crop or re-generate a world cover as part of the book.

## Three world states

### populated

The world has characters, locations and events. Bind every chapter to them. Use covers as identity
references. Do not create parallel materials for anything the world already holds.

### sparse

Some chapters have a cast; others do not. Bind what exists and list the rest in `authored`. Before
producing assets for an authored material, write it back to the world so later works can reuse it:

```bash
node /mods/neta/neta atom add < new-materials.jsonl
```

### empty — the reverse case

A blank world has nothing to bind. The direction reverses: **the book creates the world's materials**
instead of consuming them.

- Set `"state": "empty"`.
- `chapters[].characters/locations/events` may be empty.
- `authored` must be non-empty — every named character, location and event the book invents is listed.
- Write those materials back to the world as atoms as they are settled, so the world grows and the
  next work inherits them. A book that invents canon and leaves it only inside its own manifest has
  produced a private world, not a contribution to this one.

Do not treat `empty` as a failure state. It changes which direction the material flows, not whether
the step is required.

## Boundaries

- **Reading `visualStyle` is not obeying it.** It describes the world's rendering form for world-level
  materials. A book may keep its own printed medium (for example a woodblock print while the world
  renders in flat cel shading). Record that decision as the book's own style and leave
  `manifest.worldConfig.visualStyle` unchanged unless the user asks otherwise.
- **Language and tone do travel.** Prose, narration and reader-facing labels follow
  `worldConfig.language`; the book's register follows `tone` and `genre` unless the user overrides.
- **Reuse before regenerating.** If a sibling work already produced art for this same story beat,
  reuse it rather than generating a parallel set.
- **Never rename, retag or delete an existing atom**, and never copy another world's atoms in as if
  they were this one's.
- **Gaps are recorded, not hidden.** If a chapter needs a location that does not exist, that is an
  `authored` entry, not an omission.
