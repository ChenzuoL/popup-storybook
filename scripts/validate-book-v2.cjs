'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validate(book, root, options = {}) {
  const errors = [];
  const warnings = [];
  const production = !!options.production;
  const strict = options.strict !== false;
  const fail = message => errors.push(message);
  const warn = message => warnings.push(message);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const assetTypes = new Set(['page-art', 'standee', 'audio', 'cover', 'mask']);
  const layers = new Set(['background', 'midground', 'foreground']);
  const mechanisms = new Set(['hinge', 'rise', 'accordion', 'static']);
  const provenanceTypes = new Set(['generated', 'imported', 'edited', 'reference']);
  const rootAbs = path.resolve(root);

  function records(value, label) {
    if (!Array.isArray(value)) { fail(`${label} must be an array`); return []; }
    const seen = new Set();
    return value.filter((record, index) => {
      if (!record || typeof record !== 'object' || !text(record.id)) {
        fail(`${label}[${index}] needs an id`);
        return false;
      }
      if (seen.has(record.id)) fail(`${label}: duplicate id ${record.id}`);
      seen.add(record.id);
      return true;
    });
  }

  function localFile(value, label, required = true) {
    if (value == null && !required) return;
    if (!text(value) || path.isAbsolute(value) || /^[a-z]+:/i.test(value)) {
      fail(`${label}: expected relative local path`);
      return;
    }
    const full = path.resolve(rootAbs, value);
    if (!full.startsWith(rootAbs + path.sep)) {
      fail(`${label}: path escapes book root`);
      return;
    }
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile() || stat.size === 0) fail(`${label}: empty or non-file path`);
    } catch {
      fail(`${label}: missing ${value}`);
    }
  }

  function normalizedBounds(value, label) {
    if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) {
      fail(`${label}: alphaBounds must be [x,y,w,h]`);
      return;
    }
    const [x, y, w, h] = value;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) {
      fail(`${label}: alphaBounds must stay within [0,1]`);
    }
  }

  if (!book || typeof book !== 'object') return { errors: ['Book must be an object'], warnings };
  if (book.schemaVersion !== 2) fail('Unsupported schemaVersion: expected 2');
  if (!text(book.title)) fail('Book title is required');
  if (book.sceneContractVersion !== 1) fail('sceneContractVersion must be 1');

  const chapterIdList = Array.isArray(book.chapters) ? book.chapters.map(chapter => chapter?.id).filter(text) : [];
  const binding = book.worldBinding;
  const bindingStates = new Set(['populated', 'sparse', 'empty']);
  if (!binding || typeof binding !== 'object') {
    fail('worldBinding is required: run Step 0 world reconnaissance (references/world-recon.md)');
  } else {
    if (!text(binding.worldId)) fail('worldBinding.worldId is required');
    if (!bindingStates.has(binding.state)) fail('worldBinding.state must be populated, sparse or empty');
    if (!Array.isArray(binding.authored) || !binding.authored.every(text)) fail('worldBinding.authored must be an array of names');
    const entries = Array.isArray(binding.chapters) ? binding.chapters : null;
    if (!entries) fail('worldBinding.chapters must be an array');
    else {
      const seenBinding = new Set();
      let bound = 0;
      for (const [index, entry] of entries.entries()) {
        if (!entry || !text(entry.chapterId)) { fail(`worldBinding.chapters[${index}] needs a chapterId`); continue; }
        if (!chapterIdList.includes(entry.chapterId)) fail(`worldBinding entry ${entry.chapterId}: no such chapter in this book`);
        if (seenBinding.has(entry.chapterId)) fail(`worldBinding: duplicate chapter ${entry.chapterId}`);
        seenBinding.add(entry.chapterId);
        let local = 0;
        for (const field of ['characters', 'locations', 'events']) {
          const value = entry[field];
          if (value == null) continue;
          if (!Array.isArray(value) || !value.every(text)) { fail(`worldBinding ${entry.chapterId}.${field} must be an array of names`); continue; }
          local += value.length;
        }
        bound += local;
        if (!local) warn(`${entry.chapterId}: binds no character, location or event — confirm that is deliberate`);
      }
      for (const id of chapterIdList) if (!seenBinding.has(id)) fail(`worldBinding: chapter ${id} has no entry`);
      if (binding.state === 'empty') {
        if (!binding.authored.length) fail('worldBinding.state "empty": authored[] must list the materials this book creates');
      } else if (production && !bound) {
        fail(`worldBinding: state "${binding.state}" but no chapter binds any material`);
      }
    }
  }

  const chapters = records(book.chapters, 'chapters');
  const assets = records(book.assets, 'assets');
  const spreads = records(book.spreads, 'spreads');
  const chapterIds = new Set(chapters.map(chapter => chapter.id));
  const assetMap = new Map(assets.map(asset => [asset.id, asset]));
  const spreadIds = new Set(spreads.map(spread => spread.id));
  const order = Array.isArray(book.spreadOrder) ? book.spreadOrder : [];
  if (!order.length) fail('spreadOrder must be nonempty');
  if (order.length !== spreadIds.size || new Set(order).size !== order.length || order.some(id => !spreadIds.has(id))) {
    fail('spreadOrder must contain every spread exactly once');
  }

  for (const asset of assets) {
    if (!assetTypes.has(asset.type)) fail(`asset ${asset.id}: unsupported type`);
    if (!text(asset.role)) fail(`asset ${asset.id}: role is required`);
    localFile(asset.file, `asset ${asset.id}`);
    if (!asset.provenance || typeof asset.provenance !== 'object' || !provenanceTypes.has(asset.provenance.sourceType) || !text(asset.provenance.sourceRef)) {
      if (production) fail(`asset ${asset.id}: provenance.sourceType and provenance.sourceRef are required`);
      else warn(`asset ${asset.id}: provenance is recommended`);
    }
    if (asset.maskFile != null) localFile(asset.maskFile, `asset ${asset.id} maskFile`);
    if (asset.type === 'page-art' && asset.surfacePolicy !== 'ground-only') {
      fail(`asset ${asset.id}: page-art must declare surfacePolicy ground-only`);
    }
    if (asset.type === 'standee') {
      if (!text(asset.maskFile)) fail(`asset ${asset.id}: standee maskFile required`);
      normalizedBounds(asset.alphaBounds, `asset ${asset.id}`);
      if (production && !text(asset.identityReference)) fail(`asset ${asset.id}: identityReference is required`);
    }
  }

  const passageIds = new Set();
  const sceneIds = new Set();
  const spreadCountByChapter = new Map(chapters.map(chapter => [chapter.id, 0]));
  for (const spread of spreads) {
    if (!chapterIds.has(spread.chapterId)) fail(`${spread.id}: unknown chapterId`);
    else spreadCountByChapter.set(spread.chapterId, spreadCountByChapter.get(spread.chapterId) + 1);
    if (!text(spread.title)) fail(`${spread.id}: missing title`);
    if (production && !text(spread.focalSubject)) fail(`${spread.id}: focalSubject required for production`);
    if (!Array.isArray(spread.scaleHierarchy) || !spread.scaleHierarchy.length) fail(`${spread.id}: scaleHierarchy required`);

    const pageArt = spread.pageArt;
    for (const side of ['left', 'right']) {
      if (!pageArt || !assetMap.has(pageArt[side])) fail(`${spread.id}: ${side} pageArt asset is missing or unknown`);
      else if (assetMap.get(pageArt[side]).surfacePolicy !== 'ground-only') fail(`${spread.id}: ${side} pageArt must be ground-only`);
    }

    const scene = Array.isArray(spread.scene) ? spread.scene : [];
    if (!Array.isArray(spread.scene)) fail(`${spread.id}: scene must be an array`);
    const layerCounts = { background: 0, midground: 0, foreground: 0 };
    const sceneAssetIds = new Set();
    for (const [index, item] of scene.entries()) {
      if (!item || !text(item.id)) fail(`${spread.id} scene ${index}: stable id required`);
      else if (sceneIds.has(item.id)) fail(`Duplicate scene item across spreads: ${item.id}`);
      else sceneIds.add(item.id);
      if (!item || !assetMap.has(item.assetId)) fail(`${spread.id} scene ${index}: unknown asset`);
      else {
        const asset = assetMap.get(item.assetId);
        sceneAssetIds.add(asset.id);
        if (asset.type !== 'standee') fail(`${spread.id} scene ${index}: scene asset must be a standee`);
      }
      if (!layers.has(item?.layer)) fail(`${spread.id} scene ${index}: invalid layer`);
      else layerCounts[item.layer] += 1;
      if (!Array.isArray(item?.anchor) || item.anchor.length !== 2 || !item.anchor.every(finite)) {
        fail(`${spread.id} scene ${index}: anchor must be [x,z]`);
      } else if (item.anchor[0] < 0 || item.anchor[0] > 1 || item.anchor[1] < 0 || item.anchor[1] > 1) {
        fail(`${spread.id} scene ${index}: anchor must stay within page bounds`);
      }
      if (!(item?.maxWidth > 0 && finite(item.maxWidth) && item?.maxHeight > 0 && finite(item.maxHeight))) {
        fail(`${spread.id} scene ${index}: positive dimensions required`);
      }
      if (!mechanisms.has(item?.mechanism)) fail(`${spread.id} scene ${index}: invalid mechanism`);
      if (item?.reveal != null) {
        if (typeof item.reveal !== 'object' || !finite(item.reveal.start) || !finite(item.reveal.end) || item.reveal.start < 0 || item.reveal.end > 1 || item.reveal.start >= item.reveal.end) {
          fail(`${spread.id} scene ${index}: reveal must be {start,end} within 0..1`);
        }
      }
    }
    if (production && spread.scenePolicy?.sparseIntent !== true) {
      for (const layer of layers) if (!layerCounts[layer]) fail(`${spread.id}: production scene needs a ${layer} standee`);
    }
    if (production && !sceneAssetIds.has(spread.focalSubject)) fail(`${spread.id}: focalSubject must be present in scene`);
    const requiredLayers = ['background', 'midground', 'foreground'];
    if (!spread.scenePolicy || typeof spread.scenePolicy !== 'object' || !Array.isArray(spread.scenePolicy.requiredLayers)) {
      if (production) fail(`${spread.id}: scenePolicy.requiredLayers is required for production`);
      else warn(`${spread.id}: scenePolicy.requiredLayers is recommended`);
    } else if (requiredLayers.some(layer => !spread.scenePolicy.requiredLayers.includes(layer))) {
      fail(`${spread.id}: scenePolicy.requiredLayers must include background, midground and foreground`);
    }
    if (spread.scenePolicy?.sparseIntent === true && !text(spread.scenePolicy.reason)) {
      fail(`${spread.id}: sparseIntent requires a reason`);
    }
    for (const id of spread.scaleHierarchy) if (!assetMap.has(id)) warn(`${spread.id}: scaleHierarchy references unknown asset ${id}`);

    const passages = records(spread.passages, `${spread.id} passages`);
    if (!passages.length) fail(`${spread.id}: at least one passage required`);
    for (const passage of passages) {
      if (passageIds.has(passage.id)) fail(`Duplicate passage across spreads: ${passage.id}`);
      passageIds.add(passage.id);
      if (!text(passage.speaker) || !text(passage.text)) fail(`${passage.id}: speaker and text required`);
      if (passage.audio != null) localFile(passage.audio, `${passage.id} audio`);
    }
  }
  for (const [chapterId, count] of spreadCountByChapter) if (!count) fail(`${chapterId}: chapter has no spread`);
  if (book.bookmarks?.schemaVersion !== 1) fail('bookmarks.schemaVersion must be 1');
  if (strict && production && warnings.length) {
    errors.push(...warnings.map(message => `Strict production warning: ${message}`));
    warnings.length = 0;
  }
  return { errors, warnings };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node validate-book-v2.cjs book.json [--production] [--root=/path/to/book] [--no-strict]');
    process.exitCode = 2;
  } else try {
    const rootArg = process.argv.find(arg => arg.startsWith('--root='));
    const result = validate(JSON.parse(fs.readFileSync(file, 'utf8')), rootArg ? rootArg.slice(7) : path.dirname(path.resolve(file)), {
      production: process.argv.includes('--production'),
      strict: !process.argv.includes('--no-strict')
    });
    if (result.warnings.length) console.error(result.warnings.map(warning => `WARN ${warning}`).join('\n'));
    if (result.errors.length) {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    } else console.log(`PASS schema v2 structure and referenced local files${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}. Browser, visual, motion and audio QA still required.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validate };
