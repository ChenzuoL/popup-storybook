#!/usr/bin/env node
// place-scene.mjs — derive every spread's scene[] from its boardItems with the production mapper:
// x and size from boardRect, a UNIQUE z per standee (see board-to-book.mjs), page side and gutter.
//
//   node scripts/place-scene.mjs --book=data/book.json [--spread=<id>] [--check]
//
// Existing scene ids, mechanisms and reveal windows are kept (matched by boardItemId). Hand-edited
// anchors are overwritten on purpose: placement comes from the board, depth from the rule. A manual
// depth belongs on boardItem.depth (recorded calibration), never on scene[].anchor.
// --check: do not write; exit 1 if the stored scene differs from the derived one.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { deriveSpreadPlacements, depthProblems, DEFAULT_DEPTH_WINDOWS, DEFAULT_MIN_GAP } = await import(pathToFileURL(path.join(here, '../templates/runtime/board-to-book.mjs')));

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
if (!args.book) { console.error('Usage: node scripts/place-scene.mjs --book=data/book.json [--spread=<id>] [--check]'); process.exit(2); }
const bookFile = path.resolve(args.book);
const book = JSON.parse(await readFile(bookFile, 'utf8'));
const opts = {
  depthWindows: book.boardToBook?.depthWindows || DEFAULT_DEPTH_WINDOWS,
  minGap: book.boardToBook?.minDepthGap ?? DEFAULT_MIN_GAP
};
const same = (a, b) => Math.abs(a - b) <= 0.0005;
const summary = [];
let drift = 0;
for (const spread of book.spreads || []) {
  if (args.spread && spread.id !== args.spread) continue;
  const conflicts = [];
  const boardItems = spread.boardItems.map(item => ({ ...item, occludes: item.occludes ?? item.measured?.occludes }));
  const placements = deriveSpreadPlacements({ ...spread, boardItems }, { ...opts, conflictsOut: conflicts });
  const old = new Map((spread.scene || []).map(s => [s.boardItemId, s]));
  const scene = placements.map((p, i) => {
    const item = spread.boardItems[i];
    const prev = old.get(item.id) || {};
    if (prev.anchor && (!same(prev.anchor[0], p.anchor[0]) || !same(prev.anchor[1], p.anchor[1]) || !same(prev.maxWidth ?? -1, p.maxWidth) || !same(prev.maxHeight ?? -1, p.maxHeight))) drift++;
    return {
      id: prev.id || `${spread.id}-${item.id}`,
      assetId: item.assetId,
      boardItemId: item.id,
      placementSource: 'board',
      coordinateSpace: p.coordinateSpace,
      ...(p.crossGutter ? { crossGutter: true } : {}),
      side: p.side,
      layer: item.layer,
      anchor: p.anchor,
      depthRank: p.depthRank,
      maxWidth: p.maxWidth,
      maxHeight: p.maxHeight,
      mechanism: prev.mechanism || 'hinge',
      reveal: prev.reveal || { start: 0.45, end: 0.95 }
    };
  });
  const occludesBy = new Map(boardItems.map(item => [item.id, item.occludes]));
  const sceneForCheck = scene.map(s => ({ ...s, id: s.boardItemId, occludes: occludesBy.get(s.boardItemId) }));
  const problems = [...depthProblems(sceneForCheck, opts), ...conflicts.map(c => `occlusion: ${c}`)];
  if (problems.length) throw new Error(`${spread.id}: ${problems.join('; ')}`);
  if (!args.check) {
    spread.scene = scene;
    spread.depthCalibration = {
      rule: 'unique z per standee: layer windows back-to-front, baseline (y+h) order inside a layer, minimum gap enforced',
      windows: opts.depthWindows,
      minGap: opts.minGap,
      order: [...scene].sort((a, b) => a.anchor[1] - b.anchor[1]).map(s => ({ id: s.id, assetId: s.assetId, z: s.anchor[1] })),
      occlusion: (spread.depthEvidence?.occlusion || []).filter(e => e.front)
    };
  }
  summary.push({ spread: spread.id, standees: scene.length, depths: [...scene].sort((a, b) => a.anchor[1] - b.anchor[1]).map(s => `${s.assetId}@${s.anchor[1]}`) });
}
// physical size records for the asset audit
for (const asset of book.assets || []) {
  if (asset.type !== 'standee') continue;
  let mw = 0, mh = 0;
  for (const spread of book.spreads || []) for (const s of spread.scene || []) if (s.assetId === asset.id) {
    mw = Math.max(mw, s.maxWidth * (book.pageGeometry?.pageWidth || 0.888)); mh = Math.max(mh, s.maxHeight * (book.pageGeometry?.pageHeight || 1));
  }
  if (mw && !args.check) { asset.maxWorldWidth = Number(mw.toFixed(4)); asset.maxWorldHeight = Number(mh.toFixed(4)); }
}
if (args.check) {
  console.log(JSON.stringify({ ok: drift === 0, drift, spreads: summary }));
  if (drift) process.exitCode = 1;
} else {
  await writeFile(bookFile, JSON.stringify(book, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, spreads: summary }));
}
