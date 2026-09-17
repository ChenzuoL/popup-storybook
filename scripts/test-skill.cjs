'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scripts = [
  'test-validator.cjs',
  'test-validator-v2.cjs',
  'test-validator-v3.cjs',
  'test-world-survey.cjs',
  'test-board-to-book.mjs',
  'test-reconstruct-board.cjs',
  'test-scaffold.cjs',
  'test-page-turn-state.mjs',
  'test-runtime-contract.cjs',
  'test-depth-report.cjs'
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`PASS popup-storybook skill (${scripts.length} suites)`);
