#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { deriveBoardPlacement } from '../templates/runtime/board-to-book.mjs';

function args(argv) {
  const out = {};
  for (const value of argv) {
    if (!value.startsWith('--')) continue;
    const [key, ...rest] = value.slice(2).split('=');
    out[key] = rest.join('=') || true;
  }
  return out;
}
function fail(message) { throw new Error(message); }
function local(root, file, label) {
  if (typeof file !== 'string' || path.isAbsolute(file) || /^[a-z]+:/i.test(file)) fail(`${label}: expected a relative local path`);
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep)) fail(`${label}: path escapes book root`);
  return full;
}
function safeHref(file, outputDir) {
  return encodeURI(path.relative(outputDir, file).split(path.sep).join('/'));
}
function rect(value, label, width, height) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) return `${label}: boardRect must be [x,y,width,height]`;
  const [x, y, w, h] = value;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) return `${label}: boardRect is outside the board canvas`;
  return null;
}
function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const options = args(process.argv.slice(2));
if (!options.book || !options.spread || !options.out) {
  console.error('Usage: node scripts/reconstruct-board.mjs --book=/path/book.json --spread=spread-id --out=/path/reconstruction.svg [--report=/path/report.json]');
  process.exit(2);
}
const bookFile = path.resolve(options.book);
const root = path.resolve(options.root || path.dirname(bookFile));
const book = JSON.parse(await readFile(bookFile, 'utf8'));
const spread = (book.spreads || []).find(item => item.id === options.spread);
if (!spread) fail(`unknown spread ${options.spread}`);
const board = spread.compositionBoard;
if (!board || !Array.isArray(board.canvas) || board.canvas.length !== 2) fail(`${spread.id}: compositionBoard.canvas is required`);
const [width, height] = board.canvas;
if (!(width > 0 && height > 0)) fail(`${spread.id}: compositionBoard.canvas must be positive`);
const output = path.resolve(options.out);
const outputDir = path.dirname(output);
await mkdir(outputDir, { recursive: true });
const errors = [];
const warnings = [];
let boardFile;
try { boardFile = local(root, board.file, `${spread.id} compositionBoard.file`); } catch (error) { errors.push(error.message); }
const scenes = new Map((spread.scene || []).map(item => [item.boardItemId, item]));
const seen = new Set();
const layers = { background: '#5d7f9c', midground: '#b17b43', foreground: '#9a5364' };
const markup = [];
if (boardFile) await readFile(boardFile);
if (boardFile) markup.push(`<image href="${safeHref(boardFile, outputDir)}" x="0" y="0" width="${width}" height="${height}" opacity="0.20" preserveAspectRatio="none"/>`);
for (const item of spread.boardItems || []) {
  if (seen.has(item.id)) errors.push(`${spread.id}: duplicate boardItemId ${item.id}`);
  seen.add(item.id);
  const badRect = rect(item.boardRect, `${spread.id} boardItem ${item.id}`, width, height);
  if (badRect) { errors.push(badRect); continue; }
  const [x, y, w, h] = item.boardRect;
  const scene = scenes.get(item.id);
  if (!scene) {
    if (item.required !== false) errors.push(`${spread.id} boardItem ${item.id}: no scene item points to this board item`);
    continue;
  }
  if (scene.assetId !== item.assetId) errors.push(`${spread.id} boardItem ${item.id}: scene assetId ${scene.assetId} differs from board assetId ${item.assetId}`);
  if (scene.placementSource !== 'board') errors.push(`${spread.id} scene ${scene.id}: placementSource must be board`);
  try {
    const derived = deriveBoardPlacement(item, board, { depthBands: book.boardToBook?.depthBands });
    const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.0005;
    if (!Array.isArray(scene.anchor) || !close(scene.anchor[0], derived.anchor[0]) || !close(scene.anchor[1], derived.anchor[1])) errors.push(`${spread.id} scene ${scene.id}: anchor is not derived from boardRect`);
    if (!close(scene.maxWidth, derived.maxWidth) || !close(scene.maxHeight, derived.maxHeight)) errors.push(`${spread.id} scene ${scene.id}: dimensions are not derived from boardRect`);
    if (scene.side !== derived.side || scene.coordinateSpace !== derived.coordinateSpace) errors.push(`${spread.id} scene ${scene.id}: side/coordinateSpace do not match board mapping`);
  } catch (error) { errors.push(`${spread.id} scene ${scene.id}: ${error.message}`); }
  let assetFile;
  try { assetFile = local(root, book.assets.find(asset => asset.id === item.assetId)?.file, `${spread.id} asset ${item.assetId}`); }
  catch (error) { errors.push(error.message); }
  if (assetFile) await readFile(assetFile);
  const color = layers[item.layer] || '#777';
  markup.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.06" stroke="${color}" stroke-width="3"/>`);
  if (assetFile) markup.push(`<image href="${safeHref(assetFile, outputDir)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/>`);
  markup.push(`<text x="${x + 8}" y="${Math.max(18, y + 20)}" fill="${color}" font-family="sans-serif" font-size="16">${esc(item.id)} · ${esc(item.layer)} · ${esc(item.cutMode)}</text>`);
}
for (const scene of spread.scene || []) if (!seen.has(scene.boardItemId)) errors.push(`${spread.id} scene ${scene.id}: boardItemId ${scene.boardItemId || '(missing)'} has no board item`);
if (spread.reconstruction?.sourceBoard && spread.reconstruction.sourceBoard !== board.file) warnings.push(`${spread.id}: reconstruction.sourceBoard differs from compositionBoard.file`);
const report = {
  structuralStatus: errors.length ? 'fail' : 'pass',
  visualReview: { status: 'pending', note: 'Structure and preview only; inspect images before approval.' },
  version: 1,
  spreadId: spread.id,
  sourceBoard: board.file,
  canvas: board.canvas,
  itemCount: seen.size,
  sceneCount: spread.scene?.length || 0,
  errors,
  warnings,
  status: errors.length ? 'fail' : 'needs-visual-review'
};
const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/>${markup.join('')}</svg>\n`;
await writeFile(output, svg);
const reportFile = options.report ? path.resolve(options.report) : output.replace(/\.svg$/i, '.json');
await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, report: reportFile, status: report.status, errors: report.errors.length, warnings: report.warnings.length }));
if (errors.length) process.exitCode = 1;
