'use strict';
const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = new Map();
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args.set(key, rest.length ? rest.join('=') : 'true');
  }
  return args;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function survey(worldRoot) {
  const manifestFile = path.join(worldRoot, 'manifest.json');
  const manifest = readJson(manifestFile);
  if (!manifest) return { ok: false, error: `no readable manifest.json at ${manifestFile}` };

  const config = manifest.worldConfig || {};
  const atoms = Array.isArray(manifest.atoms) ? manifest.atoms : [];
  const inventory = new Map();          // `${type}:${name}` -> record
  const byType = new Map();
  const missingCover = [];

  for (const entry of atoms) {
    if (!entry || !entry.name) continue;
    const type = entry.type || 'unknown';
    const record = {
      id: entry.id || null,
      type,
      name: entry.name,
      description: entry.description || '',
      hasCover: false,
      coverUrl: null,
      tags: []
    };
    const detail = entry.path ? readJson(path.join(worldRoot, entry.path)) : null;
    if (detail) {
      record.tags = Array.isArray(detail.tags) ? detail.tags : [];
      if (detail.description) record.description = detail.description;
      if (detail.coverArtifactPath) {
        const cover = readJson(path.join(worldRoot, detail.coverArtifactPath));
        if (cover && cover.status === 'ready' && cover.url) {
          record.hasCover = true;
          record.coverUrl = cover.url;
        }
      }
    }
    if (!record.hasCover) missingCover.push(`${type}:${entry.name}`);
    inventory.set(`${type}:${entry.name}`, record);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(record);
  }

  const count = type => (byType.get(type) || []).length;
  const state = atoms.length === 0
    ? 'empty'
    : (count('character') >= 3 && count('location') >= 2 ? 'populated' : 'sparse');

  return {
    ok: true,
    worldRoot,
    worldId: config.worldId || null,
    phase: manifest.phase || null,
    config: {
      name: config.name || null,
      genre: config.genre || null,
      tone: config.tone || null,
      era: config.era || null,
      language: config.language || null,
      visualStyle: config.visualStyle || null,
      coreConflict: config.coreConflict || null
    },
    state,
    counts: Object.fromEntries([...byType].map(([type, list]) => [type, list.length])),
    inventory: [...inventory.values()],
    missingCover,
    works: (Array.isArray(manifest.works) ? manifest.works : []).map(work => ({
      id: work.id, type: work.type, title: work.title, path: work.path
    }))
  };
}

function checkBinding(book, report) {
  const errors = [];
  const warnings = [];
  const binding = book && book.worldBinding;
  if (!binding || typeof binding !== 'object') {
    errors.push('book has no worldBinding block; run Step 0 world reconnaissance first');
    return { errors, warnings };
  }
  const inventory = new Map(report.inventory.map(record => [`${record.type}:${record.name}`, record]));
  const known = new Set(report.inventory.map(record => record.name));
  // character and location atoms both become standees, so both need a cover to serve as an identity reference
  const visualTypes = new Set(['character', 'location']);
  const authored = new Set(Array.isArray(binding.authored) ? binding.authored : []);
  const chapterIds = new Set((Array.isArray(book.chapters) ? book.chapters : []).map(chapter => chapter.id));
  const bound = new Set();

  for (const chapter of Array.isArray(binding.chapters) ? binding.chapters : []) {
    if (!chapterIds.has(chapter.chapterId)) errors.push(`${chapter.chapterId}: bound chapter does not exist in the book`);
    for (const type of ['characters', 'locations', 'events']) {
      const singular = type.slice(0, -1);
      for (const name of Array.isArray(chapter[type]) ? chapter[type] : []) {
        bound.add(name);
        const record = inventory.get(`${singular}:${name}`);
        if (record) {
          if (visualTypes.has(singular) && !record.hasCover) {
            warnings.push(`${chapter.chapterId}: ${singular} ${name} has no ready cover, so no identity reference is available`);
          }
          continue;
        }
        if (!known.has(name) && !authored.has(name)) {
          errors.push(`${chapter.chapterId}: ${singular} ${name} is not an atom in this world and is not listed in authored[]`);
        }
      }
    }
  }
  for (const chapterId of chapterIds) {
    if (!(binding.chapters || []).some(chapter => chapter.chapterId === chapterId)) {
      errors.push(`${chapterId}: chapter has no worldBinding entry`);
    }
  }
  if (binding.state === 'empty') {
    if (!authored.size) errors.push('state "empty" requires authored[] to list the materials this book creates');
  } else if (binding.state !== 'populated' && binding.state !== 'sparse') {
    errors.push(`worldBinding.state must be populated, sparse or empty, got ${binding.state}`);
  }
  if (report.state === 'empty' && binding.state !== 'empty') {
    errors.push(`world survey reports an empty world, but the book claims state "${binding.state}"`);
  }
  if (report.state === 'populated' && binding.state === 'empty') {
    errors.push('world survey reports a populated world, but the book claims state "empty"');
  }
  const unused = report.inventory
    .filter(record => ['character', 'location', 'event'].includes(record.type) && !bound.has(record.name))
    .map(record => `${record.type}:${record.name}`);
  if (unused.length) warnings.push(`not bound by this book (fine, just confirm it is deliberate): ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ` …+${unused.length - 8}` : ''}`);
  return { errors, warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const worldRoot = path.resolve(args.get('world') || '/workspace');
  const report = survey(worldRoot);
  if (!report.ok) { console.error(report.error); process.exitCode = 1; return; }

  const bookFile = args.get('binding');
  let binding = null;
  if (bookFile) {
    const book = readJson(path.resolve(bookFile));
    if (!book) { console.error(`cannot read book at ${bookFile}`); process.exitCode = 1; return; }
    binding = checkBinding(book, report);
  }

  const out = { ...report, binding };
  if (args.get('out')) fs.writeFileSync(path.resolve(args.get('out')), JSON.stringify(out, null, 2));

  console.log(`world ${report.config.name || '(unnamed)'} — state: ${report.state}`);
  console.log(`  genre=${report.config.genre} tone=${report.config.tone} era=${report.config.era} language=${report.config.language}`);
  console.log(`  visualStyle: ${report.config.visualStyle}`);
  console.log(`  materials: ${Object.entries(report.counts).map(([type, n]) => `${type} ${n}`).join(', ') || 'none'}`);
  console.log(`  works already in world: ${report.works.length}`);
  if (report.missingCover.length) console.log(`  atoms without a ready cover: ${report.missingCover.length}`);
  for (const [type, list] of Object.entries(report.counts)) {
    if (!['character', 'location', 'event'].includes(type)) continue;
    const names = report.inventory.filter(r => r.type === type).slice(0, 6).map(r => r.name + (r.hasCover ? '' : '(*)'));
    console.log(`  ${type}: ${names.join(', ')}${list > 6 ? ' …' : ''}`);
  }
  console.log('  (* = no ready cover, so no identity reference available)');
  if (report.state === 'empty') {
    console.log('  EMPTY WORLD: the book creates this world\'s materials. Set state "empty", list every');
    console.log('  invented character/location/event in authored[], and write them back as atoms.');
  }

  if (binding) {
    console.log('\nbinding check:');
    for (const warning of binding.warnings) console.log(`  WARN ${warning}`);
    for (const error of binding.errors) console.log(`  FAIL ${error}`);
    if (!binding.errors.length) console.log('  PASS every bound name resolves to an atom in this world');
    if (binding.errors.length) process.exitCode = 1;
  } else {
    console.log('\npass --binding=<book.json> to resolve a book\'s worldBinding against this world');
  }
}

if (require.main === module) main();
module.exports = { survey, checkBinding };
