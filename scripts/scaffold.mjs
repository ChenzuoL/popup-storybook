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
  ['templates/book-v2.json', 'data/book.json'],
  ['templates/runtime/page-turn-state.mjs', 'js/page-turn-state.mjs'],
  ['templates/placeholders/page-ground.txt', 'assets/page-ground.txt'],
  ['templates/placeholders/subject-standee.txt', 'assets/subject-standee.txt'],
  ['templates/placeholders/subject-standee-mask.txt', 'assets/subject-standee-mask.txt']
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
await writeFile(bookPath, `${JSON.stringify(book, null, 2)}\n`);
console.log(`Created schema v2 book contract and neutral page-turn state in ${target}`);
