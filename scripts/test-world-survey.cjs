'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { survey, checkBinding } = require('./world-survey.cjs');

const skill = path.resolve(__dirname, '..');
const run = args => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'world-survey.cjs'), ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

// --- fixture worlds: the test builds its own, so it never depends on the authoring world ---
function writeWorld(dir, { characters = [], locations = [], events = [], withCovers = true }) {
  const atoms = [];
  for (const [type, list] of [['character', characters], ['location', locations], ['event', events]]) {
    for (const name of list) {
      const id = `atom_${type}_${name}`;
      const rel = `materials/${type}/${id}.json`;
      const detail = { id, type, name, description: `${name} fixture`, tags: [type] };
      if (withCovers) {
        const coverRel = `artifacts/covers/${id}.json`;
        detail.coverArtifactPath = coverRel;
        fs.mkdirSync(path.join(dir, path.dirname(coverRel)), { recursive: true });
        fs.writeFileSync(path.join(dir, coverRel), JSON.stringify({ atomId: id, status: 'ready', url: `https://example.invalid/${id}.png` }));
      }
      fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), JSON.stringify(detail));
      atoms.push({ id, type, name, description: `${name} fixture`, path: rel });
    }
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    version: 1,
    worldConfig: { name: path.basename(dir), genre: 'fixture', tone: 'fixture', era: 'fixture', language: 'en', visualStyle: 'flat color' },
    atoms, works: [], phase: 'ready'
  }));
  return dir;
}

const populatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-populated-'));
writeWorld(populatedDir, {
  characters: ['Alice', 'Bob', 'Cara'],
  locations: ['Hall', 'Garden'],
  events: ['The Incident']
});
const live = survey(populatedDir);
assert.equal(live.ok, true, 'a populated world must be readable');
assert.equal(live.state, 'populated');
const withCover = live.inventory.filter(r => r.type === 'character' && r.hasCover);
assert.equal(withCover.length, 3, 'atom covers must be discovered for identity reference');

// --- empty world: the reverse case ---
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-empty-'));
fs.writeFileSync(path.join(emptyDir, 'manifest.json'), JSON.stringify({
  version: 1,
  worldConfig: { name: 'Blank', language: 'en', visualStyle: 'flat color' },
  atoms: [], works: [], phase: 'ready'
}));
const empty = survey(emptyDir);
assert.equal(empty.state, 'empty');
assert.equal(empty.inventory.length, 0);
const emptyRun = run([`--world=${emptyDir}`]);
assert.equal(emptyRun.status, 0);
assert.match(emptyRun.stdout, /EMPTY WORLD/);

// sparse world: one character, no locations
const sparseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-sparse-'));
fs.mkdirSync(path.join(sparseDir, 'materials/character'), { recursive: true });
fs.writeFileSync(path.join(sparseDir, 'materials/character/a.json'), JSON.stringify({ id: 'a', type: 'character', name: 'Solo', description: '', tags: [] }));
fs.writeFileSync(path.join(sparseDir, 'manifest.json'), JSON.stringify({
  version: 1,
  worldConfig: { name: 'Thin', language: 'en' },
  atoms: [{ id: 'a', type: 'character', name: 'Solo', description: '', path: 'materials/character/a.json' }],
  works: [], phase: 'ready'
}));
assert.equal(survey(sparseDir).state, 'sparse');

// --- binding resolution ---
const chapter = { id: 'chapter-01' };
const bookWith = binding => ({ chapters: [chapter], worldBinding: binding });
const template = JSON.parse(fs.readFileSync(path.join(skill, 'templates/book-v2.json'), 'utf8'));

const name = live.inventory.find(r => r.type === 'character' && r.hasCover).name;
const location = live.inventory.find(r => r.type === 'location').name;
const event = live.inventory.find(r => r.type === 'event').name;

const good = checkBinding(bookWith({
  worldId: live.worldId || 'world_x', state: 'populated',
  chapters: [{ chapterId: 'chapter-01', characters: [name], locations: [location], events: [event] }], authored: []
}), live);
assert.deepEqual(good.errors, [], `expected a resolving binding, got ${JSON.stringify(good.errors)}`);

const invented = checkBinding(bookWith({
  worldId: 'world_x', state: 'populated',
  chapters: [{ chapterId: 'chapter-01', characters: ['Nobody At All'], locations: [], events: [] }], authored: []
}), live);
assert.ok(invented.errors.some(e => e.includes('not an atom')), 'an invented name must fail');

const authoredOk = checkBinding(bookWith({
  worldId: 'world_x', state: 'sparse',
  chapters: [{ chapterId: 'chapter-01', characters: ['全新角色'], locations: [], events: [] }], authored: ['全新角色']
}), live);
assert.deepEqual(authoredOk.errors, [], 'a name declared in authored[] must be accepted');

const emptyClaim = checkBinding(bookWith({
  worldId: 'world_x', state: 'empty',
  chapters: [{ chapterId: 'chapter-01', characters: [], locations: [], events: [] }], authored: ['invented']
}), live);
assert.ok(emptyClaim.errors.some(e => e.includes('populated world')), 'claiming empty in a populated world must fail');

const emptyWorldBook = checkBinding(bookWith({
  worldId: 'world_x', state: 'empty',
  chapters: [{ chapterId: 'chapter-01', characters: [], locations: [], events: [] }], authored: ['invented']
}), empty);
assert.deepEqual(emptyWorldBook.errors, [], 'an empty world with authored materials must pass');

const noEntry = checkBinding({ chapters: [chapter, { id: 'chapter-02' }], worldBinding: { worldId: 'w', state: 'populated', chapters: [{ chapterId: 'chapter-01', characters: [name] }], authored: [] } }, live);
assert.ok(noEntry.errors.some(e => e.includes('chapter-02: chapter has no worldBinding entry')), 'an unbound chapter must fail');

const noBinding = checkBinding({ chapters: [chapter] }, live);
assert.ok(noBinding.errors.some(e => e.includes('no worldBinding block')), 'a book without reconnaissance must fail');

// the shipped template is shape-valid but its names are placeholders, so resolution must flag them
const templateCheck = checkBinding(template, live);
assert.ok(templateCheck.errors.some(e => e.includes('not an atom')), 'template placeholders must not resolve as real atoms');

// a character without a cover cannot supply an identity reference: warn, do not fail
const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-bare-'));
writeWorld(bareDir, { characters: ['Alice', 'Bob', 'Cara'], locations: ['Hall', 'Garden'], events: ['The Incident'], withCovers: false });
const bare = survey(bareDir);
const noCover = checkBinding(bookWith({
  worldId: 'world_x', state: 'populated',
  chapters: [{ chapterId: 'chapter-01', characters: ['Alice'], locations: ['Hall'], events: ['The Incident'] }], authored: []
}), bare);
assert.deepEqual(noCover.errors, [], 'a missing cover is a warning, not an error');
assert.ok(noCover.warnings.some(w => w.includes('no ready cover')), 'a missing cover must warn');

// an unreadable world is reported, not thrown
const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popup-bad-'));
assert.equal(survey(badDir).ok, false);

// exit codes
const failRun = run([`--world=${emptyDir}`, `--binding=${path.join(skill, 'templates/book-v2.json')}`]);
assert.equal(failRun.status, 1, 'a template binding against an empty world must exit non-zero');

fs.rmSync(emptyDir, { recursive: true, force: true });
fs.rmSync(sparseDir, { recursive: true, force: true });
fs.rmSync(populatedDir, { recursive: true, force: true });
fs.rmSync(bareDir, { recursive: true, force: true });
fs.rmSync(badDir, { recursive: true, force: true });
console.log('PASS world reconnaissance inventory, three world states and binding resolution');
