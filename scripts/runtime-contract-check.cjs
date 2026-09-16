'use strict';
const fs = require('node:fs');
const path = require('node:path');

const args = new Map(process.argv.slice(2).filter(arg => arg.startsWith('--')).map(arg => {
  const [key, ...rest] = arg.slice(2).split('=');
  return [key, rest.join('=') || 'true'];
}));
const adapterFile = args.get('adapter');
const bookFile = args.get('book');
const outFile = args.get('out');
const tolerance = Number(args.get('tolerance') || 1e-4);
const syncTolerance = Number(args.get('sync-tolerance') || 0.02);
const progressSamples = [0.05, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999];

if (!adapterFile || !bookFile) {
  console.error('Usage: node runtime-contract-check.cjs --adapter=/path/adapter.cjs --book=/path/book.json [--out=/path/report.json] [--tolerance=0.0001] [--sync-tolerance=0.02]');
  process.exit(2);
}

function loadJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fail(message) { throw new Error(message); }
function asArray(value, label) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  fail(`${label} must be an array or {items}`);
}
function settled(adapter) {
  return adapter.settled() === true && adapter.current()?.turning !== true;
}
function numericDelta(a, b) {
  if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return Math.max(0, ...a.map((value, index) => numericDelta(value, b[index])));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return Math.max(0, ...keys.map(key => numericDelta(a[key], b[key])));
  }
  return 0;
}
function itemMap(snapshot) {
  return new Map(asArray(snapshot, 'attachmentSnapshot').filter(item => item && item.id).map(item => [item.id, item]));
}
function snapshotDelta(a, b, ownerSpread) {
  const filter = snapshot => asArray(snapshot, 'attachmentSnapshot').filter(item => !ownerSpread || item.ownerSpread === ownerSpread);
  const left = itemMap(filter(a));
  const right = itemMap(filter(b));
  if (left.size !== right.size) return Infinity;
  return Math.max(0, ...[...left.entries()].map(([id, item]) => right.has(id) ? numericDelta(item, right.get(id)) : Infinity));
}
function foldSpread(snapshot) {
  const groups = new Map();
  for (const item of asArray(snapshot, 'attachmentSnapshot')) {
    if (!Number.isFinite(item.fold)) continue;
    const values = groups.get(item.ownerSpread) || [];
    values.push(item.fold);
    groups.set(item.ownerSpread, values);
  }
  return Math.max(0, ...[...groups.values()].map(values => Math.max(...values) - Math.min(...values)));
}
function checkAudit(audit, low, high, direction, progress) {
  if (!audit || typeof audit !== 'object') fail(`pageSurfaceAudit missing at ${direction} ${progress}`);
  if (audit.lowId !== low.id || audit.highId !== high.id) fail(`ownership range mismatch at ${direction} ${progress}`);
  if (audit.coplanarVisible === true) fail(`coplanar page surfaces visible at ${direction} ${progress}`);
  if (audit.occluded === true || (Array.isArray(audit.occlusions) && audit.occlusions.length)) fail(`page surface occlusion at ${direction} ${progress}`);
  const leaf = audit.leaf || {};
  const expected = direction === 'next'
    ? [low.pageArt?.right, high.pageArt?.left]
    : [high.pageArt?.left, low.pageArt?.right];
  if (leaf.frontAssetId !== expected[0] || leaf.backAssetId !== expected[1]) {
    fail(`moving leaf ownership mismatch at ${direction} ${progress}: expected ${expected.join('/')}, got ${leaf.frontAssetId}/${leaf.backAssetId}`);
  }
  if (leaf.visible !== true) fail(`moving leaf hidden during active turn at ${direction} ${progress}`);
  if (direction === 'prev' && progress < 0.999 && audit.static?.right?.assetId !== high.pageArt?.right) {
    fail(`backward turn changed current right-page image early at ${progress}`);
  }
}
async function waitSettled(adapter, timeout = 10000) {
  const started = Date.now();
  while (!settled(adapter)) {
    if (Date.now() - started > timeout) fail(`runtime did not settle within ${timeout}ms`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function createAdapter(book) {
  const loaded = await import(pathToFileURL(path.resolve(adapterFile)));
  const factory = loaded.default || loaded.createAdapter || loaded;
  return typeof factory === 'function' ? factory({ book }) : factory;
}
function pathToFileURL(file) { return require('node:url').pathToFileURL(file).href; }

async function main() {
const book = loadJson(bookFile);
const report = { book: book.title, pairs: [], errors: [], tolerance, syncTolerance, progressSamples };
try {
  const adapter = await createAdapter(book);
  const required = ['current', 'turn', 'seekTurn', 'settled', 'attachmentSnapshot', 'pageSurfaceAudit', 'collisions', 'goTo'];
  for (const method of required) if (typeof adapter?.[method] !== 'function') fail(`adapter missing ${method}()`);
  const spreads = book.spreadOrder.map(id => book.spreads.find(spread => spread.id === id));
  if (spreads.some(spread => !spread)) fail('book spreadOrder contains an unknown spread');

  for (let index = 0; index < spreads.length - 1; index += 1) {
    for (const direction of ['next', 'prev']) {
      const low = spreads[index];
      const high = spreads[index + 1];
      const from = direction === 'next' ? low : high;
      const to = direction === 'next' ? high : low;
      await adapter.goTo(from.id);
      await waitSettled(adapter);
      const samples = [];
      let nearEndSnapshot = null;
      let turnPromise;
      try { turnPromise = Promise.resolve(adapter.turn(direction)); }
      catch (error) { fail(`${direction} turn ${from.id}->${to.id} threw: ${error.message}`); }
      for (const progress of progressSamples) {
        await adapter.seekTurn(progress);
        const audit = await adapter.pageSurfaceAudit();
        checkAudit(audit, low, high, direction, progress);
        const attachments = adapter.attachmentSnapshot();
        if (progress >= 0.999) nearEndSnapshot = attachments;
        const maxFoldSpread = foldSpread(attachments);
        if (maxFoldSpread > syncTolerance) fail(`standee fold spread ${maxFoldSpread} exceeds ${syncTolerance} during ${direction} ${from.id}->${to.id} at ${progress}`);
        const activeIds = new Set(asArray(attachments, 'attachmentSnapshot').map(item => item.ownerSpread).filter(Boolean));
        if (![low.id, high.id].every(id => activeIds.has(id) || activeIds.size === 0)) fail(`unrelated attachment owner during ${direction} ${from.id}->${to.id}`);
        const collisions = await adapter.collisions();
        const hits = asArray(collisions, 'collisions').filter(hit => hit?.hit === true || hit?.intersects === true || hit?.depth > tolerance);
        if (hits.length) fail(`collision sample hit during ${direction} ${from.id}->${to.id} at ${progress}`);
        samples.push({ progress, audit, maxFoldSpread, attachmentCount: asArray(attachments, 'attachmentSnapshot').length, collisionCount: asArray(collisions, 'collisions').length });
      }
      await adapter.seekTurn(1);
      await turnPromise;
      await waitSettled(adapter);
      const atSettled = adapter.attachmentSnapshot();
      const maxEndpointDelta = snapshotDelta(nearEndSnapshot, atSettled, to.id);
      if (!Number.isFinite(maxEndpointDelta)) fail(`non-finite endpoint transform ${direction} ${from.id}->${to.id}`);
      if (maxEndpointDelta > tolerance) fail(`endpoint transform delta ${maxEndpointDelta} exceeds ${tolerance} during ${direction} ${from.id}->${to.id}`);
      const state = adapter.current();
      if (state?.spreadId !== to.id) fail(`turn landed on ${state?.spreadId}, expected ${to.id}`);
      report.pairs.push({ from: from.id, to: to.id, direction, sampleCount: samples.length, maxEndpointDelta, samples });
    }
  }
  report.summary = {
    pairs: report.pairs.length,
    expectedPairs: Math.max(0, spreads.length - 1) * 2,
    maxEndpointDelta: Math.max(0, ...report.pairs.map(pair => pair.maxEndpointDelta)),
    pass: report.pairs.length === Math.max(0, spreads.length - 1) * 2
  };
} catch (error) {
  report.errors.push(error.stack || error.message);
}
if (outFile) fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary || { pass: false, errors: report.errors }, null, 2));
if (report.errors.length || report.summary?.pass !== true) process.exitCode = 1;
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
