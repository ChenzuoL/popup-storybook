<div align="center">
  <a href="https://neta.art">
    <img src="assets/neta-icon.png" alt="Neta Studio" width="112" height="112">
  </a>

  <h1>Pop-Up Storybook</h1>

  <p><em>Make an actual readable Three.js book — hardcover boards, page blocks, a curling leaf, paper standees that rise off the page — dressed for the world it comes from.</em></p>

  <p>
    <a href="https://neta.art"><img alt="Made for Neta Studio" src="https://img.shields.io/badge/MADE%20FOR-Neta%20Studio-111111?style=for-the-badge"></a>
    <a href="SKILL.md"><img alt="Skill" src="https://img.shields.io/badge/type-skill-2858AD?style=for-the-badge"></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-EB7E51?style=for-the-badge"></a>
    <a href="SKILL.md"><img alt="Version" src="https://img.shields.io/badge/0.1.0-2563eb?style=for-the-badge&label=version"></a>
  </p>
</div>



Make an actual readable Three.js book — hardcover boards, page blocks, a curling leaf, paper standees that rise off the page — dressed for the world it comes from. The pipeline is:

## Highlights

- 🎯 **When to pick it** — The user wants an actual readable 3D paper pop-up storybook for a world: one composition master per spread, standees cut out in place and placed on their own depth, assembled into a Three.js book with real page turns and
- 📦 **What you get** — A published, browser-playable Three.js book (schema v3): hardcover boards, real page turns, paper standees rising on their own depth, dressed in the world's theme — handed over through interaction-components.
- 🌍 **Where it runs** — Inside a Neta Studio world, through the skill picker. The agent does not auto-select skills.
- 🚫 **Out of scope** — Branching adventure / choose-your-own-path; a static PDF; manufacturing-ready paper engineering.

## Quick start

This is a **Neta Studio skill**, not a Node app. There is no `npm start`.

1. Open a world in [Neta Studio](https://neta.art).
2. Copy this folder to `.agents/skills/popup-storybook/` so `SKILL.md` sits at that root.
3. Reload. Pick **Pop-Up Storybook** in the skill picker.

```bash
cp -R popup-storybook path/to/world/.agents/skills/popup-storybook
```

> [!NOTE]
> Contract, inputs, stops, and acceptance live in [SKILL.md](SKILL.md). Do not copy branded UI, slogans, or third-party assets.

## License

[MIT](LICENSE) · Built for [Neta Studio](https://neta.art).
