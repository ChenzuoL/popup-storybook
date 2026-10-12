# Theming — dress the book from its world

The runtime is shared; the **object and its chrome are not**. Every book carries a `theme` block, and
production validation rejects the template palette. Two books from two worlds should be
recognisably different before anyone reads a word: a Hogwarts letter in oxblood leather with a gilt
edge on a dark desk, a Touhou shrine tale in pale linen with a kai-script margin, a seaside picture
book in sun-faded cloth on bleached wood.

## Where the theme comes from

1. **The approved masters.** `python3 scripts/palette.py assets/boards/*.png` proposes
   `paper / paperDeep / ink / inkSoft / accent / cloth / table` from the art itself.
2. **The world.** `worldConfig.genre`, `tone`, `era`, `visualStyle`, the world cover, faction colours,
   signature materials (a house scarf, a shrine's vermilion, a ship's brass).
3. **The Step 1 answers.** Printed medium and reading chrome.

Write what you used in `theme.derivedFrom` (one sentence). Adjust any palette role whose contrast
fails: body text `ink` on `paper` needs ≥ 4.5:1; `accent` buttons carry `paper` text.

## The block

```json
"theme": {
  "derivedFrom": "palette.py on the 4 masters; Gryffindor scarlet + gold for cloth and foil; candle-lit castle → candle light",
  "palette": { "paper": "#efe4d2", "paperDeep": "#cbbba6", "ink": "#2a2320", "inkSoft": "#6f625a",
               "accent": "#8c2f22", "cloth": "#5b1f1a", "table": "#4a3a2c" },
  "typography": { "display": "song", "body": "song", "fontCss": null },
  "chrome": "sidebar",
  "readerSide": "right",
  "surface": "grain",
  "shape": "soft",
  "bar": "floating",
  "labels": { "open": "Open this letter" },
  "book": { "background": "#cbbba6" }
}
```

| Key | Options | Pick by |
| --- | --- | --- |
| `typography.display/body` | `song` `kai` `hei` `fangsong` `mincho` `latin-serif` `latin-display` `typewriter` `rounded`, or a CSS font stack | language + era: kai/fangsong for classical Chinese settings, mincho for Japanese, typewriter for noir/archives, rounded for children's books |
| `typography.fontCss` | https stylesheet URL or null | only when the system stacks cannot carry the voice |
| `chrome` | `sidebar` (paper panel beside the book), `footer` (text band in columns under the book), `margin` (almost none — marginalia on the stage colour) | the Step 1 reading-chrome answer |
| `readerSide` | `right` `left` | vertical/right-to-left traditions or a composition that leans right |
| `surface` | `grain` `ruled` `linen` `plain` `dark` | reader panel paper |
| `shape` | `square` `soft` `round` | austere/archival → square; storybook → soft; children → round |
| `bar` | `floating` `flush` `ink` | the bottom bar: card / full-width band / dark cloth strip |
| `labels` | any UI string override (`open`, `resume`, `close`, `index`, …) | give the open button the world's verb ("Open this letter", "Push open the shrine gate") |
| `palette.cloth` | `#rrggbb` | also colours the book's hardcover boards |
| `book.background` | `#rrggbb` (default `palette.paperDeep`) | the 3D canvas behind the book; match it to the stage so the canvas does not read as a box |

The **book model itself is the original runtime** and is not themed beyond those two colours (see
`engineering.md`). Older manifests may still carry `book.cover`, `pageEdge`, `headband`, `table`,
`light`, `standeeEdge` or `stage`: the runtime ignores them.

## Rules

- **Never ship the template palette.** The validator fails production when five or more palette roles
  still equal the template default.
- The theme dresses the book; it does not touch `manifest.worldConfig.visualStyle`.
- Change at least one thing per world in each UI group — palette, type, chrome/surface/shape/bar,
  labels. Reusing the sidebar chrome is fine; reusing sidebar + song + the same palette for every world
  is the sameness this block exists to prevent.
- Keep the bar in flow. It is the gate before opening and the navigation after; it never floats over
  the canvas. A theme may restyle it, never reposition it over the book.
- After a theme change, rerun `scripts/shoot.mjs` (closed, front, oblique, back, mobile) and look at
  the shots: contrast, legibility, board colour against the stage, cover crop and mobile layout.
