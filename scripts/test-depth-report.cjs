'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const file = path.join(os.tmpdir(), `popup-storybook-depth-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify({
  phase: 'fixed',
  rows: [{ total: 81, occluded: [], maxDifference: 3 }],
  total: 81,
  occluded: 0,
  material: { left: { offset: false, factor: 0 }, right: { polygonOffset: false, polygonOffsetFactor: 0 } },
  errors: []
}));
try {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'verify-depth-report.cjs'), file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `exit ${result.status}`);
  fs.writeFileSync(file, JSON.stringify({ rows: [{ total: 81, occluded: [{}], maxDifference: 12 }], material: { left: { offset: true, factor: 1 } }, errors: [] }));
  const rejected = spawnSync(process.execPath, [path.join(__dirname, 'verify-depth-report.cjs'), file], { encoding: 'utf8' });
  if (rejected.status === 0) throw new Error('occluded/slope-offset report was not rejected');
  console.log('PASS page-depth report verifier rejects occlusion/error regressions and accepts clean samples');
} finally { fs.rmSync(file, { force: true }); }
