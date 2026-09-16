'use strict';
const fs = require('node:fs');
const path = require('node:path');

const bookFile = process.argv[2];
const production = process.argv.includes('--production');
const outFile = process.argv.find(arg => arg.startsWith('--out='))?.slice(6);
if (!bookFile) {
  console.error('Usage: node audit-assets.cjs /path/to/book.json [--production] [--out=/path/report.json]');
  process.exit(2);
}
const book = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
const root = path.resolve(process.argv.find(arg => arg.startsWith('--root='))?.slice(7) || path.dirname(bookFile));
const errors = [];
const warnings = [];
const seenFiles = new Map();
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
function localFile(value, label) {
  if (!text(value) || path.isAbsolute(value) || /^[a-z]+:/i.test(value)) {
    errors.push(`${label}: expected relative local path`);
    return;
  }
  const full = path.resolve(root, value);
  if (!full.startsWith(root + path.sep)) { errors.push(`${label}: path escapes root`); return; }
  try {
    const stat = fs.statSync(full);
    if (!stat.isFile() || stat.size === 0) errors.push(`${label}: empty or non-file`);
    if (seenFiles.has(full)) warnings.push(`${label}: reuses ${seenFiles.get(full)}`);
    else seenFiles.set(full, label);
  } catch { errors.push(`${label}: missing ${value}`); }
}
function bounds(value, label) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) { errors.push(`${label}: alphaBounds must be [x,y,w,h]`); return; }
  const [x, y, width, height] = value;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) errors.push(`${label}: alphaBounds outside [0,1]`);
}
function positivePair(value, label) {
  if (value == null) return;
  if (!Array.isArray(value) || value.length !== 2 || !value.every(item => finite(item) && item > 0)) errors.push(`${label}: expected positive [width,height]`);
}
function crop(value, label) {
  if (value == null) return;
  if (!Array.isArray(value) || value.length !== 4 || !value.every(item => finite(item) && item >= 0)) errors.push(`${label}: cropRect must be nonnegative [x,y,w,h]`);
}
for (const asset of Array.isArray(book.assets) ? book.assets : []) {
  const label = `asset ${asset.id}`;
  localFile(asset.file, label);
  if (!text(asset.role)) errors.push(`${label}: role missing`);
  if (!asset.provenance || !text(asset.provenance.sourceType) || !text(asset.provenance.sourceRef)) {
    if (production) errors.push(`${label}: provenance sourceType/sourceRef missing`);
    else warnings.push(`${label}: provenance missing`);
  }
  positivePair(asset.sourceImageSize, `${label}.sourceImageSize`);
  positivePair(asset.finalImageSize, `${label}.finalImageSize`);
  crop(asset.cropRect, `${label}.cropRect`);
  if (asset.type === 'standee') {
    localFile(asset.maskFile, `${label}.maskFile`);
    bounds(asset.alphaBounds, label);
    if (!text(asset.identityReference)) errors.push(`${label}: identityReference missing`);
    if (!(asset.maxWorldWidth > 0) || !(asset.maxWorldHeight > 0)) warnings.push(`${label}: maxWorldWidth/maxWorldHeight not recorded`);
  }
}
const report = { pass: errors.length === 0, assets: book.assets?.length || 0, errors, warnings };
if (outFile) fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
