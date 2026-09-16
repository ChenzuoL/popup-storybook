'use strict';
const fs = require('node:fs');
const path = require('node:path');

const file = process.argv[2];
const threshold = Number(process.argv.find(arg => arg.startsWith('--threshold='))?.slice(12) || 8);
if (!file) {
  console.error('Usage: node verify-depth-report.cjs /path/to/page-depth/report.json [--threshold=8]');
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const errors = [];
const rows = Array.isArray(report.rows) ? report.rows : [];
if (!rows.length) errors.push('report.rows must be nonempty');
if (report.errors?.length) errors.push(`browser/runtime errors: ${report.errors.join('; ')}`);
for (const [index, row] of rows.entries()) {
  if (!(row.total > 0)) errors.push(`row ${index} has no sampled pixels`);
  const occlusionCount = Array.isArray(row.occluded) ? row.occluded.length : Number(row.occluded || 0);
  const namedOcclusions = Array.isArray(row.occlusions) ? row.occlusions.length : 0;
  if (occlusionCount > 0) errors.push(`row ${index} has ${occlusionCount} occluded page samples`);
  if (namedOcclusions > 0) errors.push(`row ${index} has ${namedOcclusions} named occlusions`);
  if (Number.isFinite(row.maxDifference) && row.maxDifference > threshold) errors.push(`row ${index} maxDifference ${row.maxDifference} exceeds ${threshold}`);
}
const surfaces = report.material || {};
for (const [name, material] of Object.entries(surfaces)) {
  const enabled = material?.polygonOffset ?? material?.offset ?? false;
  const factor = Number(material?.polygonOffsetFactor ?? material?.factor ?? 0);
  if (enabled === true && Math.abs(factor) > 0) errors.push(`${name} uses slope-based polygonOffsetFactor ${factor}`);
}
const result = {
  pass: errors.length === 0,
  phase: report.phase || null,
  rows: rows.length,
  totalSamples: Number(report.total || rows.reduce((sum, row) => sum + Number(row.total || 0), 0)),
  occluded: Number(report.occluded || rows.reduce((sum, row) => sum + (Array.isArray(row.occluded) ? row.occluded.length : Number(row.occluded || 0)), 0)),
  threshold,
  errors
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
