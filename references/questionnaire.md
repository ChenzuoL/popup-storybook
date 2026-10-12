# The Step 1 round — style, chapters, and what the book is

The pop-up book asks **one** questionnaire round, before any image. It settles what the brief left
open; a brief that already names everything skips it. Load the `questionnaire` skill for the call and
result handling. This file fixes *what* to ask and in what order.

Before writing it: run world reconnaissance (`scripts/world-survey.cjs`), and check speech models with
`cohub models ls --model-type multimodal` (look for `tts` / speech entries) so the narration question
only offers what can be delivered.

## Questions, most important first

1. **风格 / printed medium** — `tiles` with images. First option: "沿用这个世界的画风" (the world's
   `visualStyle`, named in words). Then 3–5 paper-friendly styles from the style library chosen for this
   world's genre and tone. Read `/mods/neta/.agents/skills/generate/references/image/style-library/styles/index.json`;
   candidates that suit pop-ups: `layered-cut-paper`, `folded-paper-sculpture`,
   `layered-paper-puppet-game-illustration`, `transparent-watercolor`, `crayon-watercolor`,
   `wax-crayon`, `colored-pencil`, `aged-paper-painting`, `copperplate-engraving`, `ukiyo-e-woodblock`,
   `needle-felt-miniature`, `painted-wood-carving`, `monochrome-ink-wash`, `cyanotype-print`. Use each
   entry's `thumbnail` as `imageUrl` **only after you have opened it and confirmed it shows the
   style**; otherwise text-only options.
2. **做多少章** — `cards`: 1 章（先把一章做透）/ 2–3 章 / 整本（name the count you would split the
   world's events into, e.g. "整本 · 按世界里的 6 个事件分 6 章"). Each option says roughly how long.
3. **每章几个跨页** — `pills`: 2 / 3–4 / 5–6 / 随剧情定. (A spread is one open left+right page pair.)
4. **讲哪段故事** — `cards`, `multi` when several chapters: the world's real events, legends and
   arcs by name, in causal order; one option per candidate chapter. Skip when the brief named it.
5. **阅读界面** — `cards`: 纸页侧栏（文字在书旁）/ 书下字幕带（文字分栏排在书下方）/ 几乎没有（只留翻页和合书）.
6. **朗读** — `pills`, only options that exist now: 配音朗读（TTS model available）/
   浏览器朗读（会标注）/ 不要朗读，只有纸声.
7. *(only if it changes the prose)* 视角 / 读者年龄.

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

## Example spec (zh, a Harry Potter world)

```json
{
  "title": "立体书开工前，定几件事",
  "questions": [
    { "id": "style", "label": "这本立体书用什么画风？", "variant": "tiles",
      "options": [
        { "value": "world", "label": "沿用世界画风 · 层叠剪纸" },
        { "value": "folded-paper-sculpture", "label": "立体折纸", "imageUrl": "https://…/folded-paper-sculpture/thumbnail.webp" },
        { "value": "aged-paper-painting", "label": "仿古纸绘画", "imageUrl": "https://…/aged-paper-painting/thumbnail.webp" },
        { "value": "copperplate-engraving", "label": "铜版雕刻", "imageUrl": "https://…/copperplate-engraving/thumbnail.webp" }
      ] },
    { "id": "chapters", "label": "做多少章？", "variant": "cards",
      "options": [
        { "value": "1", "label": "1 章", "description": "先把「霍格沃茨入学通知书」做透" },
        { "value": "3", "label": "3 章", "description": "入学信 → 九又四分之三站台 → 分院" },
        { "value": "all", "label": "整本 · 6 章", "description": "按世界里的 6 个事件各成一章" }
      ] },
    { "id": "spreads", "label": "每章几个跨页？", "variant": "pills",
      "options": [ { "value": "2", "label": "2 个" }, { "value": "3-4", "label": "3–4 个" }, { "value": "5-6", "label": "5–6 个" }, { "value": "story", "label": "随剧情定" } ] },
    { "id": "chrome", "label": "文字放在哪？", "variant": "cards",
      "options": [
        { "value": "sidebar", "label": "纸页侧栏", "description": "书在左，正文在右侧暖纸栏" },
        { "value": "footer", "label": "书下字幕带", "description": "正文分栏排在书下方，书更大" },
        { "value": "margin", "label": "几乎没有", "description": "只留翻页、目录和合书" }
      ] },
    { "id": "voice", "label": "要朗读吗？", "variant": "pills",
      "options": [ { "value": "tts", "label": "配音朗读" }, { "value": "browser", "label": "浏览器朗读（会标注）" }, { "value": "none", "label": "不要，只听纸声" } ] }
  ]
}
```
