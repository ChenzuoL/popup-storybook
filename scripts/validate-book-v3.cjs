'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validate: validateV2 } = require('./validate-book-v2.cjs');

function validate(book, root, options = {}) {
  const errors = [];
  const warnings = [];
  const production = !!options.production;
  const fail = message => errors.push(message);
  const warn = message => warnings.push(message);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const layers = new Set(['background', 'midground', 'foreground']);
  const roles = new Set(['background', 'midground', 'foreground', 'character', 'landmark', 'prop', 'atmosphere', 'ground']);
  const pageSides = new Set(['left', 'right', 'spread']);
  const cutModes = new Set(['crop', 'regenerate', 'manual']);
  const rootAbs = path.resolve(root);
  const localFile = (value, label, required = true) => {
    if (value == null && !required) return;
    if (!text(value) || path.isAbsolute(value) || /^[a-z]+:/i.test(value)) { fail(`${label}: expected relative local path`); return; }
    const full = path.resolve(rootAbs, value);
    if (!full.startsWith(rootAbs + path.sep)) { fail(`${label}: path escapes book root`); return; }
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile() || stat.size === 0) fail(`${label}: empty or non-file path`);
    } catch { fail(`${label}: missing ${value}`); }
  };
  const rect = (value, label, canvas) => {
    if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) { fail(`${label}: boardRect must be [x,y,width,height]`); return; }
    const [x, y, width, height] = value;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > canvas[0] || y + height > canvas[1]) fail(`${label}: boardRect must stay inside compositionBoard.canvas`);
  };
  if (!book || typeof book !== 'object') return { errors: ['Book must be an object'], warnings };
  if (book.schemaVersion !== 3) fail('Unsupported schemaVersion: expected 3');
  if (book.compositionContractVersion !== 1) fail('compositionContractVersion must be 1');
  if (!book.boardToBook || typeof book.boardToBook !== 'object') fail('boardToBook is required for schema v3');
  else {
    if (!text(book.boardToBook.profile)) fail('boardToBook.profile is required');
    if (!text(book.boardToBook.canonicalCamera)) fail('boardToBook.canonicalCamera is required');
    if (!(book.boardToBook.gutter >= 0 && book.boardToBook.gutter < 0.5 && finite(book.boardToBook.gutter))) fail('boardToBook.gutter must be finite in [0,0.5)');
    if (!book.boardToBook.depthBands || typeof book.boardToBook.depthBands !== 'object') fail('boardToBook.depthBands is required');
    else for (const layer of layers) if (!(finite(book.boardToBook.depthBands[layer]) && book.boardToBook.depthBands[layer] >= 0 && book.boardToBook.depthBands[layer] <= 1)) fail(`boardToBook.depthBands.${layer} must be in [0,1]`);
  }
  if (!book.pageGeometry || typeof book.pageGeometry !== 'object' || !(book.pageGeometry.pageWidth > 0) || !(book.pageGeometry.pageHeight > 0)) fail('pageGeometry.pageWidth and pageHeight are required');

  // Reuse the stable v2 data/asset/passages checks without accepting v2 as a production book.
  const baseBook = { ...book, schemaVersion: 2, sceneContractVersion: 1 };
  const base = validateV2(baseBook, rootAbs, { production, strict: options.strict !== false });
  errors.push(...base.errors);
  warnings.push(...base.warnings);

  const chapterIds = new Set((book.chapters || []).map(chapter => chapter.id));
  const assetMap = new Map((book.assets || []).map(asset => [asset.id, asset]));
  const globalBoardItems = new Set();
  for (const spread of Array.isArray(book.spreads) ? book.spreads : []) {
    const board = spread.compositionBoard;
    if (!board || typeof board !== 'object') { fail(`${spread.id}: compositionBoard is required`); continue; }
    if (!Array.isArray(board.canvas) || board.canvas.length !== 2 || !board.canvas.every(finite) || board.canvas.some(value => value <= 0)) fail(`${spread.id}: compositionBoard.canvas must be positive [width,height]`);
    if (board.coordinateSpace !== 'full-spread') fail(`${spread.id}: compositionBoard.coordinateSpace must be full-spread`);
    if (!text(board.sourceWork)) fail(`${spread.id}: compositionBoard.sourceWork is required`);
    if (production && board.status !== 'approved') fail(`${spread.id}: compositionBoard.status must be approved for production`);
    localFile(board.file, `${spread.id} compositionBoard.file`);
    const canvas = Array.isArray(board.canvas) ? board.canvas : [0, 0];

    const boardItems = Array.isArray(spread.boardItems) ? spread.boardItems : null;
    if (!boardItems) { fail(`${spread.id}: boardItems must be an array`); continue; }
    if (production && !boardItems.length) fail(`${spread.id}: production spread needs boardItems`);
    const localIds = new Set();
    const itemMap = new Map();
    for (const [index, item] of boardItems.entries()) {
      if (!item || !text(item.id)) { fail(`${spread.id} boardItems[${index}]: stable id required`); continue; }
      if (localIds.has(item.id)) fail(`${spread.id}: duplicate boardItem ${item.id}`);
      if (globalBoardItems.has(item.id)) fail(`Duplicate boardItem across spreads: ${item.id}`);
      localIds.add(item.id); globalBoardItems.add(item.id); itemMap.set(item.id, item);
      if (!assetMap.has(item.assetId) || assetMap.get(item.assetId).type !== 'standee') fail(`${spread.id} boardItem ${item.id}: assetId must reference a standee`);
      if (!text(item.materialRef)) fail(`${spread.id} boardItem ${item.id}: materialRef is required`);
      rect(item.boardRect, `${spread.id} boardItem ${item.id}`, canvas);
      if (!roles.has(item.role)) fail(`${spread.id} boardItem ${item.id}: invalid role`);
      if (!layers.has(item.layer)) fail(`${spread.id} boardItem ${item.id}: invalid layer`);
      if (!pageSides.has(item.pageSide)) fail(`${spread.id} boardItem ${item.id}: invalid pageSide`);
      if (!layers.has(item.depthBand)) fail(`${spread.id} boardItem ${item.id}: invalid depthBand`);
      if (!cutModes.has(item.cutMode)) fail(`${spread.id} boardItem ${item.id}: invalid cutMode`);
      if (item.cutMode === 'manual' && !text(item.reason)) fail(`${spread.id} boardItem ${item.id}: manual cutMode requires reason`);
      if (item.required != null && typeof item.required !== 'boolean') fail(`${spread.id} boardItem ${item.id}: required must be boolean`);
    }

    const reconstruction = spread.reconstruction;
    if (!reconstruction || typeof reconstruction !== 'object') {
      if (production) fail(`${spread.id}: reconstruction proof is required for production`);
    } else {
      if (production && reconstruction.status !== 'approved') fail(`${spread.id}: reconstruction.status must be approved for production`);
      if (reconstruction.sourceBoard != null && reconstruction.sourceBoard !== board.file) fail(`${spread.id}: reconstruction.sourceBoard must equal compositionBoard.file`);
      localFile(reconstruction.file, `${spread.id} reconstruction.file`, production);
      localFile(reconstruction.report, `${spread.id} reconstruction.report`, production);
      if (production && text(reconstruction.report)) {
        try {
          const report = JSON.parse(fs.readFileSync(path.resolve(rootAbs, reconstruction.report), 'utf8'));
          if (report.structuralStatus !== 'pass' || report.visualReview?.status !== 'approved') fail(`${spread.id}: reconstruction needs structural pass and explicit visual review`);
          if (report.sourceBoard !== board.file) fail(`${spread.id}: reconstruction report references a different board`);
        } catch { fail(`${spread.id}: reconstruction report unreadable`); }
      }
    }

    const sceneByBoard = new Map();
    for (const [index, scene] of (Array.isArray(spread.scene) ? spread.scene : []).entries()) {
      if (!text(scene.boardItemId)) { fail(`${spread.id} scene ${index}: boardItemId is required in schema v3`); continue; }
      if (!itemMap.has(scene.boardItemId)) fail(`${spread.id} scene ${scene.id || index}: unknown boardItemId ${scene.boardItemId}`);
      else {
        const boardItem = itemMap.get(scene.boardItemId);
        if (boardItem.assetId !== scene.assetId) fail(`${spread.id} scene ${scene.id}: assetId differs from its boardItem`);
        if (boardItem.pageSide !== 'spread' && boardItem.pageSide !== scene.side) fail(`${spread.id} scene ${scene.id}: side differs from boardItem.pageSide`);
        if (scene.coordinateSpace !== 'page' && scene.coordinateSpace !== 'spread') fail(`${spread.id} scene ${scene.id}: coordinateSpace must be page or spread`);
        if (scene.placementSource !== 'board') fail(`${spread.id} scene ${scene.id}: placementSource must be board`);
        if (sceneByBoard.has(scene.boardItemId)) fail(`${spread.id}: boardItem ${scene.boardItemId} is placed more than once`);
        sceneByBoard.set(scene.boardItemId, scene);
      }
    }
    for (const item of boardItems) if (item.required !== false && !sceneByBoard.has(item.id)) fail(`${spread.id} boardItem ${item.id}: required item has no scene placement`);
    if (production && !chapterIds.has(spread.chapterId)) fail(`${spread.id}: chapterId must resolve to a book chapter`);
  }
  if (production && !globalBoardItems.size) fail('schema v3 production book has no board items');
  if (options.strict !== false && production && warnings.length) {
    errors.push(...warnings.map(message => `Strict production warning: ${message}`));
    warnings.length = 0;
  }
  return { errors, warnings };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node validate-book-v3.cjs book.json --production --root=/path/to/book'); process.exitCode = 2; }
  else try {
    const rootArg = process.argv.find(arg => arg.startsWith('--root='));
    const result = validate(JSON.parse(fs.readFileSync(file, 'utf8')), rootArg ? rootArg.slice(7) : path.dirname(path.resolve(file)), { production: process.argv.includes('--production'), strict: !process.argv.includes('--no-strict') });
    if (result.warnings.length) console.error(result.warnings.map(warning => `WARN ${warning}`).join('\n'));
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
    else console.log(`PASS schema v3 board-first contract and referenced local files${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}. 2D reconstruction and browser QA still required.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validate };
