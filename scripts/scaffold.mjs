import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv[2];
if (!targetArg || targetArg.startsWith('-')) {
  console.error('Usage: node scripts/scaffold.mjs /absolute/or/relative/book-root [--force]');
  process.exit(2);
}
const target = path.resolve(targetArg);
const force = process.argv.includes('--force');
const outputs = [
  ['templates/book-v3.json', 'data/book.json'],
  ['templates/runtime/page-turn-state.mjs', 'js/page-turn-state.mjs'],
  ['templates/runtime/board-to-book.mjs', 'js/board-to-book.mjs'],
  ['templates/runtime/book3d.js', 'js/book3d.js'],
  ['templates/runtime/app.js', 'js/app.js'],
  ['templates/runtime/audio.js', 'js/audio.js'],
  ['templates/runtime/store.js', 'js/store.js'],
  ['templates/runtime/index.html', 'index.html'],
  ['templates/runtime/style.css', 'style.css'],
  ['templates/runtime/vendor/three.module.min.js', 'vendor/three.module.min.js'],
  ['templates/runtime/vendor/three.core.min.js', 'vendor/three.core.min.js'],
  ['templates/placeholders/page-ground.txt', 'assets/page-ground.txt'],
  ['templates/placeholders/subject-standee.txt', 'assets/subject-standee.txt'],
  ['templates/placeholders/subject-standee-mask.txt', 'assets/subject-standee-mask.txt'],
  ['templates/placeholders/composition-board.svg', 'assets/boards/composition-board.svg'],
  ['templates/placeholders/reconstruction.svg', 'docs/qa/reconstruction.svg'],
  ['templates/placeholders/reconstruction-report.json', 'docs/qa/reconstruction-report.json']
];
await mkdir(target, { recursive: true });
for (const [sourceRel, targetRel] of outputs) {
  const destination = path.join(target, targetRel);
  try {
    if (!force) await readFile(destination);
    if (!force) throw new Error(`${targetRel} already exists; rerun with --force to replace scaffold files`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(skill, sourceRel), destination, { force });
}
const bookPath = path.join(target, 'data/book.json');
const book = JSON.parse(await readFile(bookPath, 'utf8'));
for (const asset of book.assets) {
  if (asset.file?.startsWith('templates/placeholders/')) asset.file = `assets/${path.basename(asset.file)}`;
  if (asset.maskFile?.startsWith('templates/placeholders/')) asset.maskFile = `assets/${path.basename(asset.maskFile)}`;
}
for (const spread of book.spreads || []) {
  if (spread.compositionBoard?.file?.startsWith('templates/placeholders/')) spread.compositionBoard.file = `assets/boards/${path.basename(spread.compositionBoard.file)}`;
  if (spread.reconstruction?.sourceBoard?.startsWith('templates/placeholders/')) spread.reconstruction.sourceBoard = `assets/boards/${path.basename(spread.reconstruction.sourceBoard)}`;
  if (spread.reconstruction?.file?.startsWith('templates/placeholders/')) spread.reconstruction.file = `docs/qa/${path.basename(spread.reconstruction.file)}`;
  if (spread.reconstruction?.report?.startsWith('templates/placeholders/')) spread.reconstruction.report = `docs/qa/${path.basename(spread.reconstruction.report)}`;
}
await writeFile(bookPath, `${JSON.stringify(book, null, 2)}\n`);
console.log(`Created schema v3 board-first contract, 2D reconstruction proof, Three.js runtime and board-to-book mapper in ${target}`);
