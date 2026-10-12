# Book cover — generated for the cover, never cut from a spread

A pop-up book's cover is its own picture. A crop of a spread's composition master repeats the first
page, cuts characters at arbitrary edges and leaves no room for the title. Generate the cover
separately, once per book, after the masters are approved (so it can share their medium and cast).

## Make it

Load the `generate` skill and read the image model's declared parameters first.

- **Aspect**: the page aspect (`pageGeometry.pageWidth : pageHeight`, default 0.888 : 1). With the
  default page use `size=1024x1152`. The runtime centre-crops anything else to the page aspect.
- **Reference**: one approved composition master (local file via `--ref-file`) for medium, palette and
  the look of the cast. Say in the prompt to use it for rendering only, not for layout. Add an atom
  cover as a second reference when a character's identity matters.
- **Prompt recipe** (adapt the scene; keep the structure):
  - "Create the FRONT COVER illustration of a pop-up storybook, portrait book cover."
  - Scene: the book's single most iconic image — usually the protagonist and the place, a moment the
    reader recognises; not a copy of any spread.
  - Composition: one centred image read at a glance; **the top third calm and low-detail, reserved
    for a printed title** (or the bottom third with `titlePlacement: "bottom"`); main subject in the
    other two thirds; nothing important within 6% of an edge.
  - Style: the book's printed medium (`book.style`), in the words used for the masters.
  - Text: **no text, no letters, no title, no logo, no watermark, no frame**.
- Save as `assets/cover.png` (≤ 1400 px long side); keep the generated Work id.

## Title

Image models are not trusted with lettering (least of all CJK). The runtime sets the title on the
cover itself, in the theme's display face, over a soft band in the reserved third:

```json
"covers": {
  "front": "cover-art",
  "title": "Platform Nine and Three-Quarters · Paper Pop-Up Book",
  "subtitle": "",
  "titlePlacement": "top",
  "titleColor": "#f6efdf"
}
```

- `title` defaults to `book.title`; `A · B` splits into a main line and a smaller second line.
- `titlePlacement`: `top` (default), `bottom` or `none` (art already carries its own title).
- `titleColor` defaults to `theme.palette.paper`.

## Record it

```json
{ "id": "cover-art", "type": "cover", "role": "cover", "file": "assets/cover.png",
  "provenance": { "sourceType": "generated", "recipe": "book-cover", "sourceRef": "work_01…",
                  "notes": "dedicated cover, layered cut paper; master used as style reference" } }
```

Production validation requires `provenance.recipe: "book-cover"` and rejects a cover file that is one
of the spreads' composition masters.

## Check it

`shoot.mjs --views=closed` and look: title legible and inside the calm third, nothing important cut by
the board edges, the art matches the book's medium, no stray lettering from the model.
