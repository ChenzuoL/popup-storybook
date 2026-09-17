'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-scaffold-'));
const skill = path.resolve(__dirname, '..');
const scaffold = path.join(__dirname, 'scaffold.mjs');
const validator = path.join(__dirname, 'validate-book-v3.cjs');
try {
  const created = spawnSync(process.execPath, [scaffold, root], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr || created.stdout);
  for (const file of [
    'data/book.json', 'index.html', 'style.css', 'vendor/three.module.min.js', 'vendor/three.core.min.js',
    'js/book3d.js', 'js/app.js', 'js/audio.js', 'js/store.js', 'js/page-turn-state.mjs', 'js/board-to-book.mjs',
    'assets/boards/composition-board.svg', 'docs/qa/reconstruction.svg', 'docs/qa/reconstruction-report.json'
  ]) assert.ok(fs.statSync(path.join(root, file)).size > 0, `missing scaffold file ${file}`);
  const valid = spawnSync(process.execPath, [validator, path.join(root, 'data/book.json'), '--production', `--root=${root}`], { encoding: 'utf8' });
  assert.notEqual(valid.status, 0, 'unreviewed scaffold must fail production');
  const duplicate = spawnSync(process.execPath, [scaffold, root], { encoding: 'utf8' });
  assert.notEqual(duplicate.status, 0, 'scaffold silently overwrote an existing book');
  console.log('PASS scaffold emits v3 board-first data, 2D proof placeholders and a runnable Three.js runtime');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
