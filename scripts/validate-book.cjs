'use strict';
const fs = require('node:fs');
const path = require('node:path');
function validate(book, root, production = false) {
  if (book?.schemaVersion === 2) return require('./validate-book-v2.cjs').validate(book, root, { production }).errors;
  const errors = [];
  const fail = message => errors.push(message);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  function records(value, label) {
    if (!Array.isArray(value)) { fail(`${label} must be an array`); return []; }
    const seen = new Set();
    return value.filter((r, i) => {
      if (!r || typeof r !== 'object' || !text(r.id)) { fail(`${label}[${i}] needs an id`); return false; }
      if (seen.has(r.id)) fail(`${label}: duplicate id ${r.id}`);
      seen.add(r.id); return true;
    });
  }
  function localFile(value, label) {
    if (!text(value) || path.isAbsolute(value) || /^[a-z]+:/i.test(value)) { fail(`${label}: expected relative local path`); return; }
    const full = path.resolve(root, value);
    if (!full.startsWith(path.resolve(root) + path.sep)) { fail(`${label}: path escapes book root`); return; }
    try { if (!fs.statSync(full).isFile() || fs.statSync(full).size === 0) fail(`${label}: empty or non-file path`); }
    catch { fail(`${label}: missing ${value}`); }
  }
  if (!book || typeof book !== 'object') return ['Book must be an object'];
  if (book.schemaVersion !== 1) fail('Unsupported schemaVersion');
  if (!text(book.title)) fail('Book title is required');
  const chapters = records(book.chapters, 'chapters');
  const assets = records(book.assets, 'assets');
  const spreads = records(book.spreads, 'spreads');
  const chapterIds = new Set(chapters.map(c => c.id));
  const assetIds = new Set(assets.map(a => a.id));
  const spreadIds = new Set(spreads.map(s => s.id));
  const order = Array.isArray(book.spreadOrder) ? book.spreadOrder : [];
  if (!order.length) fail('spreadOrder must be nonempty');
  if (order.length !== spreadIds.size || new Set(order).size !== order.length || order.some(id => !spreadIds.has(id))) fail('spreadOrder must contain every spread exactly once');
  for (const a of assets) localFile(a.file, `asset ${a.id}`);
  const passageIds = new Set();
  const sceneIds = new Set();
  const spreadsPerChapter = new Map(chapters.map(c => [c.id, 0]));
  for (const s of spreads) {
    if (!chapterIds.has(s.chapterId)) fail(`${s.id}: unknown chapterId`);
    else spreadsPerChapter.set(s.chapterId, spreadsPerChapter.get(s.chapterId) + 1);
    if (!text(s.title)) fail(`${s.id}: missing title`);
    if (production && !text(s.focalSubject)) fail(`${s.id}: focalSubject required for production`);
    if (production && (!Array.isArray(s.scaleHierarchy) || !s.scaleHierarchy.length)) fail(`${s.id}: scaleHierarchy required for production`);
    for (const side of ['left', 'right']) {
      const a = s.pageArt?.[side];
      if (a != null && !assetIds.has(a)) fail(`${s.id}: unknown ${side} pageArt asset`);
      if (production && a == null) fail(`${s.id}: ${side} pageArt required for production`);
    }
    if (!Array.isArray(s.scene)) fail(`${s.id}: scene must be an array`);
    else {
      if (production && !s.scene.length) fail(`${s.id}: empty production scene`);
      for (const [i, item] of s.scene.entries()) {
        if (!item || !text(item.id)) fail(`${s.id} scene ${i}: stable id required`);
        else if (sceneIds.has(item.id)) fail(`Duplicate scene item across spreads: ${item.id}`);
        else sceneIds.add(item.id);
        if (!item || !assetIds.has(item.assetId)) fail(`${s.id} scene ${i}: unknown asset`);
        if (!['left', 'right'].includes(item?.side)) fail(`${s.id} scene ${i}: invalid side`);
        if (item?.layer != null && !['background', 'midground', 'foreground'].includes(item.layer)) fail(`${s.id} scene ${i}: invalid layer`);
        if (!Array.isArray(item?.anchor) || item.anchor.length !== 2 || !item.anchor.every(Number.isFinite)) fail(`${s.id} scene ${i}: anchor must be [x,z]`);
        if (!(item?.maxWidth > 0 && Number.isFinite(item.maxWidth) && item?.maxHeight > 0 && Number.isFinite(item.maxHeight))) fail(`${s.id} scene ${i}: positive dimensions required`);
      }
    }
    const passages = records(s.passages, `${s.id} passages`);
    if (!passages.length) fail(`${s.id}: at least one passage required`);
    for (const p of passages) {
      if (passageIds.has(p.id)) fail(`Duplicate passage across spreads: ${p.id}`);
      passageIds.add(p.id);
      if (!text(p.speaker) || !text(p.text)) fail(`${p.id}: speaker and text required`);
      if (p.audio != null) localFile(p.audio, `${p.id} audio`);
    }
  }
  for (const [chapterId, count] of spreadsPerChapter) if (!count) fail(`${chapterId}: chapter has no spread`);
  return errors;
}
if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node validate-book.cjs book.json [--production] [--root=/path/to/book]'); process.exitCode = 2; }
  else try {
    const rootArg = process.argv.find(a => a.startsWith('--root='));
    const errors = validate(JSON.parse(fs.readFileSync(file, 'utf8')), rootArg ? rootArg.slice(7) : path.dirname(path.resolve(file)), process.argv.includes('--production'));
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('PASS book structure and referenced local files. Browser, visual and audio QA still required.');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { validate };
