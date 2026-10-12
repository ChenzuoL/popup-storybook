# The Step 1 round — style, chapters, and what the book is

The pop-up book asks **one** questionnaire round, before any image. It settles what the brief left
open; a brief that already names everything skips it. Load the `questionnaire` skill for the call and
result handling. This file fixes *what* to ask and in what order.

Before writing it: run world reconnaissance (`scripts/world-survey.cjs`), and check speech models with
`cohub models ls --model-type multimodal` (look for `tts` / speech entries) so the narration question
only offers what can be delivered.

## Questions, most important first

1. **Style / printed medium** — `tiles` with images. First option: "Follow this world's art style" (the world's
   `visualStyle`, named in words). Then 3–5 paper-friendly styles from the style library chosen for this
   world's genre and tone. Read `/mods/neta/.agents/skills/generate/references/image/style-library/styles/index.json`;
   candidates that suit pop-ups: `layered-cut-paper`, `folded-paper-sculpture`,
   `layered-paper-puppet-game-illustration`, `transparent-watercolor`, `crayon-watercolor`,
   `wax-crayon`, `colored-pencil`, `aged-paper-painting`, `copperplate-engraving`, `ukiyo-e-woodblock`,
   `needle-felt-miniature`, `painted-wood-carving`, `monochrome-ink-wash`, `cyanotype-print`. Use each
   entry's `thumbnail` as `imageUrl` **only after you have opened it and confirmed it shows the
   style**; otherwise text-only options.
2. **Chapter count** — `cards`: 1 chapter (get one chapter fully done first) / 2–3 chapters / the whole
   book (name the count you would split the world's events into, e.g. "the whole book · one chapter
   per the world's 6 events"). Each option says roughly how long.
3. **Spreads per chapter** — `pills`: 2 / 3–4 / 5–6 / as the story needs. (A spread is one open
   left+right page pair.)
4. **Which story** — `cards`, `multi` when several chapters: the world's real events, legends and
   arcs by name, in causal order; one option per candidate chapter. Skip when the brief named it.
5. **Reading chrome** — `cards`: paper sidebar (text beside the book) / caption band under the book
   (text set in columns below) / almost none (only page turns and closing).
6. **Narration** — `pills`, only options that exist now: recorded narration (TTS model available) /
   browser voice (labelled) / no narration, paper sound only.
7. *(only if it changes the prose)* point of view / reader age.

Keep it to 4–6 questions in practice; drop any the brief already answered. Write in the creator's
language. Do not ask about renderer, libraries, the cutting model, depth, or whether they want to see
the boards (they always see them).

## Carry the answers

| Answer | Goes to |
| --- | --- |
| printed medium | `book.style.medium` / `book.style.styleId`; every master prompt; ground and cover prompts. Never `worldConfig.visualStyle` |
| chapters × spreads | storyboard size; how many masters this run generates |
| story | `worldBinding.chapters[]`, chapter titles, passage sources |
| reading interface | `theme.chrome` (`sidebar` / `footer` / `margin`) |
| narration | `narration.mode` (`files` / `browser` / `none`); `browser` shows its label in the reader |

"Decide for me" on any question: make the call from the world (genre → medium, number of events →
chapters) and name it in one clause when you hand over the masters.

## Example spec (a Harry Potter world)

```json
{
  "title": "Settle a few things before the pop-up book starts",
  "questions": [
    { "id": "style", "label": "What art style should this pop-up book use?", "variant": "tiles",
      "options": [
        { "value": "world", "label": "Follow the world's style · layered paper cut" },
        { "value": "folded-paper-sculpture", "label": "Folded-paper sculpture", "imageUrl": "https://…/folded-paper-sculpture/thumbnail.webp" },
        { "value": "aged-paper-painting", "label": "Aged-paper painting", "imageUrl": "https://…/aged-paper-painting/thumbnail.webp" },
        { "value": "copperplate-engraving", "label": "Copperplate engraving", "imageUrl": "https://…/copperplate-engraving/thumbnail.webp" }
      ] },
    { "id": "chapters", "label": "How many chapters?", "variant": "cards",
      "options": [
        { "value": "1", "label": "1 chapter", "description": "Get the Hogwarts acceptance letter fully right first" },
        { "value": "3", "label": "3 chapters", "description": "The letter → Platform Nine and Three-Quarters → the Sorting" },
        { "value": "all", "label": "Whole book · 6 chapters", "description": "One chapter per the world's 6 events" }
      ] },
    { "id": "spreads", "label": "How many spreads per chapter?", "variant": "pills",
      "options": [ { "value": "2", "label": "2" }, { "value": "3-4", "label": "3–4" }, { "value": "5-6", "label": "5–6" }, { "value": "story", "label": "As the story needs" } ] },
    { "id": "chrome", "label": "Where does the text sit?", "variant": "cards",
      "options": [
        { "value": "sidebar", "label": "Paper sidebar", "description": "Book on the left, prose in a warm-paper column on the right" },
        { "value": "footer", "label": "Caption band under the book", "description": "Prose set in columns below the book, the book larger" },
        { "value": "margin", "label": "Almost none", "description": "Only page turns, contents and closing" }
      ] },
    { "id": "voice", "label": "Narration?", "variant": "pills",
      "options": [ { "value": "tts", "label": "Recorded narration" }, { "value": "browser", "label": "Browser voice (labelled)" }, { "value": "none", "label": "None, paper sound only" } ] }
  ]
}
```
