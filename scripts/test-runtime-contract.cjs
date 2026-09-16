'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const skill = path.resolve(__dirname, '..');
const book = JSON.parse(fs.readFileSync(path.join(skill, 'templates/book-v2.json'), 'utf8'));
const second = structuredClone(book.spreads[0]);
second.id = 'chapter-01-spread-02';
second.title = 'A Second Glimpse';
second.focalSubject = 'foreground-standee';
second.scene = second.scene.map((item, index) => ({ ...item, id: `${item.id}-02`, side: index === 2 ? 'right' : 'left' }));
second.passages = [{ id: 'passage-002', speaker: 'Narrator', text: 'Second sample.' }];
book.spreads.push(second);
book.spreadOrder.push(second.id);
const file = path.join(os.tmpdir(), `popup-storybook-runtime-${process.pid}.json`);
const out = path.join(os.tmpdir(), `popup-storybook-runtime-${process.pid}.report.json`);
fs.writeFileSync(file, JSON.stringify(book));
const result = spawnSync(process.execPath, [
  path.join(__dirname, 'runtime-contract-check.cjs'),
  `--adapter=${path.join(__dirname, 'fixtures/runtime-adapter.cjs')}`,
  `--book=${file}`,
  `--out=${out}`
], { encoding: 'utf8' });
try {
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `exit ${result.status}`);
  const report = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (report.summary?.pairs !== 2 || report.summary?.pass !== true) throw new Error(`unexpected report: ${JSON.stringify(report.summary)}`);
  const rejected = spawnSync(process.execPath, [
    path.join(__dirname, 'runtime-contract-check.cjs'),
    `--adapter=${path.join(__dirname, 'fixtures/runtime-adapter.cjs')}`,
    `--book=${file}`,
    '--tolerance=0.000000000001'
  ], { encoding: 'utf8' });
  if (rejected.status === 0) throw new Error('endpoint delta above configured tolerance was not rejected');
  console.log('PASS runtime contract checker exercises both directions and rejects endpoint regressions');
} finally {
  fs.rmSync(file, { force: true });
  fs.rmSync(out, { force: true });
}
