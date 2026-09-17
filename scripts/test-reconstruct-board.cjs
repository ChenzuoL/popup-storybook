'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-reconstruct-'));
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const shape = color => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/></svg>`;
write(path.join(root, 'board.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><rect width="1000" height="500" fill="white"/></svg>');
write(path.join(root, 'asset-a.svg'), shape('red'));
write(path.join(root, 'asset-b.svg'), shape('blue'));
const book = {
  spreads: [{
    id: 's-01',
    compositionBoard: { file: 'board.svg', sourceWork: 'fixture', canvas: [1000, 500], coordinateSpace: 'full-spread' },
    boardItems: [
      { id: 'board-a', assetId: 'a', boardRect: [100, 100, 200, 250], role: 'character', layer: 'midground', pageSide: 'left', depthBand: 'midground', cutMode: 'crop', required: true },
      { id: 'board-b', assetId: 'b', boardRect: [600, 120, 250, 220], role: 'foreground', layer: 'foreground', pageSide: 'right', depthBand: 'foreground', cutMode: 'regenerate', required: true }
    ],
    scene: [
      { id: 'scene-a', assetId: 'a', boardItemId: 'board-a', placementSource: 'board', coordinateSpace: 'page', side: 'left', anchor: [0.6, 0.55], maxWidth: 0.4, maxHeight: 0.5 },
      { id: 'scene-b', assetId: 'b', boardItemId: 'board-b', placementSource: 'board', coordinateSpace: 'page', side: 'right', anchor: [0.45, 0.82], maxWidth: 0.5, maxHeight: 0.44 }
    ]
  }],
  assets: [
    { id: 'a', type: 'standee', file: 'asset-a.svg' },
    { id: 'b', type: 'standee', file: 'asset-b.svg' }
  ]
};
const bookFile = path.join(root, 'book.json');
const output = path.join(root, 'qa', 's-01-reconstruction.svg');
write(bookFile, JSON.stringify(book));
const script = path.resolve(__dirname, 'reconstruct-board.mjs');
try {
  const good = spawnSync(process.execPath, [script, `--book=${bookFile}`, '--spread=s-01', `--out=${output}`], { encoding: 'utf8' });
  if (good.status !== 0) throw new Error(good.stderr || good.stdout || `good run exit ${good.status}`);
  const report = JSON.parse(fs.readFileSync(output.replace(/\.svg$/, '.json'), 'utf8'));
  if (report.structuralStatus !== 'pass' || report.status !== 'needs-visual-review' || !fs.readFileSync(output, 'utf8').includes('<image')) throw new Error(`unexpected reconstruction report ${JSON.stringify(report)}`);
  book.spreads[0].scene[1].assetId = 'a';
  write(bookFile, JSON.stringify(book));
  const bad = spawnSync(process.execPath, [script, `--book=${bookFile}`, '--spread=s-01', `--out=${output}`], { encoding: 'utf8' });
  if (bad.status === 0) throw new Error('asset mismatch did not fail reconstruction');
  console.log('PASS 2D reconstruction proof emits board overlay and rejects scene/board mismatches');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
