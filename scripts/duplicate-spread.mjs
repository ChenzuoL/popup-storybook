#!/usr/bin/env node
// duplicate-spread.mjs — copy an existing spread into labelled test copies so multi-spread page
// turning can be tested without generating any new assets. Every copy reuses the same asset files;
// spread ids, scene ids, boardItem ids (and their occlusion evidence) get unique suffixes, titles
// and narration are marked as test copies, and copies can open a new chapter so chapter switching
// is exercised too.
//
//   node scripts/duplicate-spread.mjs --book=data/book.json [--source=0] [--copies=2] [--new-chapter-from=3]
//   node scripts/duplicate-spread.mjs --book=data/book.json --remove     # drop the test copies again
//
// Test copies carry `testCopyOf`; remove them (or replace them with real spreads) before a final release.
import { readFileSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
if (!args.book) { console.error('Usage: node scripts/duplicate-spread.mjs --book=data/book.json [--source=0] [--copies=2] [--new-chapter-from=N] | --remove'); process.exit(2); }
const book = JSON.parse(readFileSync(args.book, 'utf8'));
const save = () => writeFileSync(args.book, JSON.stringify(book, null, 2) + '\n');
const label = n => `test copy ${n}`;

if (args.remove) {
  const before = book.spreads.length;
  book.spreads = book.spreads.filter(s => !s.testCopyOf);
  const used = new Set(book.spreads.map(s => s.chapterId));
  const dropped = book.chapters.filter(c => c.testCopy && !used.has(c.id)).map(c => c.id);
  book.chapters = book.chapters.filter(c => !dropped.includes(c.id));
  if (book.worldBinding?.chapters) book.worldBinding.chapters = book.worldBinding.chapters.filter(c => !dropped.includes(c.chapterId));
  book.spreadOrder = book.spreads.map(s => s.id);
  save();
  console.log(JSON.stringify({ ok: true, removed: before - book.spreads.length, chapters: dropped }));
  process.exit(0);
}

const src = book.spreads[Number(args.source ?? 0)];
if (!src) { console.error('no such source spread'); process.exit(2); }
if (src.testCopyOf) { console.error('source is itself a test copy'); process.exit(2); }
const copies = Math.max(1, Number(args.copies ?? 2));
const newChapterFrom = args['new-chapter-from'] != null ? Number(args['new-chapter-from']) : null;
let chapter = src.chapterId;
const made = [];
for (let k = 0; k < copies; k++) {
  const n = book.spreads.length + 1;                 // 1-based position of the new spread
  if (newChapterFrom != null && n >= newChapterFrom && !book.chapters.find(c => c.testCopy && c.id === chapter)) {
    chapter = `chapter-${String(book.chapters.length + 1).padStart(2, '0')}`;
    book.chapters.push({ id: chapter, title: 'Test chapter (copies)', testCopy: true });
    const bind = book.worldBinding?.chapters?.find(c => c.chapterId === src.chapterId);
    if (bind) book.worldBinding.chapters.push({ ...JSON.parse(JSON.stringify(bind)), chapterId: chapter });
  }
  const id = `${chapter}-spread-${String(n).padStart(2, '0')}`;
  const suf = `-c${n}`;
  const s = JSON.parse(JSON.stringify(src));
  s.id = id; s.chapterId = chapter; s.testCopyOf = src.id;
  s.title = `${src.title} · ${label(n)}`;
  s.scene = (s.scene || []).map(it => ({ ...it, id: String(it.id).replace(src.id, id), boardItemId: it.boardItemId ? it.boardItemId + suf : it.boardItemId }));
  s.boardItems = (s.boardItems || []).map(b => ({ ...b, id: b.id + suf, occludes: b.occludes ? b.occludes.map(v => v + suf) : b.occludes }));
  if (s.depthEvidence?.occlusion) {
    s.depthEvidence.occlusion = s.depthEvidence.occlusion.map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ['front', 'back', 'a', 'b'].includes(k) ? v + suf : v])));
  }
  s.passages = (s.passages || []).map((p, i) => ({ ...p, id: `${p.id}${suf}`, audio: null, text: i === 0 ? `（${label(n)}）${p.text}` : p.text }));
  book.spreads.push(s);
  made.push(id);
}
book.spreadOrder = book.spreads.map(s => s.id);
save();
console.log(JSON.stringify({ ok: true, source: src.id, added: made, spreads: book.spreads.length }));
