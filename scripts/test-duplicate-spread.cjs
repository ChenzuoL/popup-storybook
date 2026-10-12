'use strict';
// duplicate-spread.mjs on the demo-shaped fixture: copies validate, and --remove restores the book.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-spread-'));
const file = path.join(dir, 'book.json');
const book = {
  language: 'zh-CN',
  chapters: [{ id: 'chapter-01', title: 'One' }],
  worldBinding: { chapters: [{ chapterId: 'chapter-01', characters: ['A'] }] },
  spreads: [{
    id: 'chapter-01-spread-01', chapterId: 'chapter-01', title: 'Platform',
    boardItems: [{ id: 'bg' }, { id: 'ron', occludes: ['train'] }, { id: 'train' }],
    scene: [{ id: 'chapter-01-spread-01-bg', boardItemId: 'bg', assetId: 'bg-s1' }],
    depthEvidence: { occlusion: [{ front: 'ron', back: 'train' }] },
    passages: [{ id: 'p1', speaker: 'N', text: 'Hello', audio: 'a.mp3' }]
  }],
  spreadOrder: ['chapter-01-spread-01']
};
fs.writeFileSync(file, JSON.stringify(book));
const run = (...a) => spawnSync(process.execPath, [path.join(__dirname, 'duplicate-spread.mjs'), `--book=${file}`, ...a], { encoding: 'utf8' });
let r = run('--copies=2', '--new-chapter-from=3');
assert.equal(r.status, 0, r.stderr);
let b = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(b.spreads.length, 3);
assert.deepEqual(b.spreadOrder, b.spreads.map(s => s.id));
const ids = b.spreads.flatMap(s => s.boardItems.map(i => i.id));
assert.equal(new Set(ids).size, ids.length, 'boardItem ids unique across spreads');
assert.equal(new Set(b.spreads.flatMap(s => s.scene.map(i => i.id))).size, 3, 'scene ids unique');
assert.equal(b.spreads[2].chapterId, 'chapter-02', 'third spread opens a new chapter');
assert.ok(b.worldBinding.chapters.find(c => c.chapterId === 'chapter-02'), 'new chapter is bound');
assert.deepEqual(b.spreads[1].boardItems[1].occludes, ['train-c2'], 'occlusion refs renamed');
assert.equal(b.spreads[1].depthEvidence.occlusion[0].front, 'ron-c2');
assert.equal(b.spreads[1].scene[0].assetId, 'bg-s1', 'assets are reused, not regenerated');
assert.equal(b.spreads[1].passages[0].audio, null, 'copies do not point at the source audio');
assert.ok(b.spreads[1].testCopyOf && /测试复制页/.test(b.spreads[1].title));
r = run('--remove');
assert.equal(r.status, 0, r.stderr);
b = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(b.spreads.length, 1);
assert.equal(b.chapters.length, 1);
assert.equal(b.worldBinding.chapters.length, 1);
fs.rmSync(dir, { recursive: true, force: true });
console.log('PASS duplicate-spread copies are unique, reuse assets, and --remove restores the book');
