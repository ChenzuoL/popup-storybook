#!/usr/bin/env node
// qwen-isolate.mjs — cut every board element of a spread out of its approved composition board with
// qwen-image-2.1 (edit mode, board as reference), in place, then run BiRefNet for the alpha.
//
//   node scripts/qwen-isolate.mjs --book=data/book.json --spread=chapter-01-spread-01 [--root=.]
//        [--items=boardItemId,boardItemId] [--force] [--concurrency=4] [--identity]
//
// Per boardItem (cutMode):
//   isolate      qwen in-place isolate on white  -> BiRefNet alpha        (characters, landmarks, props)
//   isolate-key  qwen in-place isolate on white  -> white key in matte.py (flat strips, rails, low props
//                                                   BiRefNet finds no salient subject in)
//   curtain      qwen removes all subjects, keeps scenery, same framing   (background curtain; opaque)
//   crop         no model; matte.py crops the board directly
// Outputs: assets/isolate/<assetId>.<ext>, assets/isolate/<assetId>.alpha.<ext>, data/cut-log.json.
// Next: python3 scripts/matte.py --book=... --spread=...
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { generate, download, extOf, pool } from './lib/cohub-task.mjs';
import { isolatePrompt, preRemovePrompt, ISOLATE_MODES, labelOf } from './lib/isolate-prompts.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HINT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/hint_mask.py');

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
if (!args.book || !args.spread) {
  console.error('Usage: node scripts/qwen-isolate.mjs --book=data/book.json --spread=<spread-id> [--root=.] [--items=a,b] [--force] [--concurrency=4] [--identity]');
  process.exit(2);
}
const bookFile = path.resolve(args.book);
const root = path.resolve(args.root || path.dirname(path.dirname(bookFile)));
const book = JSON.parse(await readFile(bookFile, 'utf8'));
const spread = book.spreads.find(s => s.id === args.spread);
if (!spread) throw new Error(`unknown spread ${args.spread}`);
const board = spread.compositionBoard || {};
if (!/^https:\/\//.test(board.url || '')) throw new Error(`${spread.id}: compositionBoard.url (https URL of the approved board Work) is required — qwen edit mode only takes URLs`);
if (board.status !== 'approved') throw new Error(`${spread.id}: compositionBoard.status is ${board.status}; the creator must approve the board before cutting`);
const only = typeof args.items === 'string' ? new Set(args.items.split(',')) : null;
const items = (spread.boardItems || []).filter(it => ISOLATE_MODES.includes(it.cutMode) && (!only || only.has(it.id)));
if (!items.length) { console.log(JSON.stringify({ ok: true, spread: spread.id, isolated: 0, note: 'no isolate/curtain items' })); process.exit(0); }
const maxSide = Math.max(...(board.canvas || [1536]));
const boardFile = path.join(root, board.file || '');
const grow = (r, f) => { const m = Math.max(24, f * Math.max(r[2], r[3])); return [r[0] - m, r[1] - m, r[2] + 2 * m, r[3] + 2 * m]; };
const meets = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const boxOf = it => (Array.isArray(it.hint) ? it.hint : it.rectLocked || it.measured ? it.boardRect : null);
for (const it of items) if (it.cutMode !== 'curtain' && !Array.isArray(it.hint)) throw new Error(`${it.id}: ${it.cutMode} needs hint [x,y,w,h] — a rough box around the element on the master (read it off: python3 scripts/lib/hint_mask.py <board> 0,0,0,0 grid.png --grid)`);
const logFile = path.join(root, 'data/cut-log.json');
let log = {};
try { log = JSON.parse(await readFile(logFile, 'utf8')); } catch { /* new log */ }
const exists = async file => { try { return (await stat(file)).size > 0; } catch { return false; } };

async function cut(item) {
  const entry = { boardItemId: item.id, assetId: item.assetId, cutMode: item.cutMode, board: board.url, attempts: [] };
  const already = log[item.assetId]?.isolate && await exists(path.join(root, log[item.assetId].isolate));
  if (already && !args.force) return { id: item.id, skipped: true };
  const withIdentity = !!(item.identityRef && (args.identity || item.identityLock));
  let source = board.url;
  let neighbours = [];
  if (item.cutMode !== 'curtain') {
    // paint everything outside the (grown) hint white, and name the neighbours inside it for removal
    const input = path.join(root, `assets/isolate/${item.assetId}.input.png`);
    await import('node:fs/promises').then(fs => fs.mkdir(path.dirname(input), { recursive: true }));
    execFileSync('python3', [HINT, boardFile, item.hint.join(','), input, String(item.hintMargin ?? 0.06)]);
    source = input;
    const zone = grow(item.hint, 0.06);
    neighbours = (spread.boardItems || []).filter(o => o !== item && o.cutMode !== 'curtain' && boxOf(o) && meets(zone, boxOf(o))).map(labelOf);
    entry.input = path.relative(root, input);
    entry.neighbours = neighbours;
  }
  if (Array.isArray(item.preRemove) && item.preRemove.length) {
    // entangled: first take the touching neighbours out and complete what they hid
    let cleaned = null;
    for (let attempt = 0; attempt < 3 && !cleaned; attempt++) {
      const { prompt, negative } = preRemovePrompt(item, attempt);
      try {
        const r = await generate({ model: 'qwen-image-2.1', prompt, images: [source], params: { max_side: maxSide, negative_prompt: negative, seed: 77 + attempt * 104729 } });
        entry.attempts.push({ step: 'pre-remove', attempt, prompt, taskRunId: r.taskRunId, url: r.url });
        cleaned = r.url;
      } catch (error) {
        entry.attempts.push({ step: 'pre-remove', attempt, prompt, error: String(error.message || error).slice(0, 400) });
      }
    }
    if (!cleaned) { log[item.assetId] = entry; return { id: item.id, error: 'pre-remove step failed' }; }
    source = cleaned;
    neighbours = neighbours.filter(n => !item.preRemove.includes(n));
  }
  const images = [source, ...(withIdentity ? [item.identityRef] : [])];
  let result = null;
  for (let attempt = 0; attempt < 4 && !result; attempt++) {
    const { prompt, negative } = isolatePrompt(item, { attempt, withIdentity, neighbours });
    try {
      const r = await generate({ model: 'qwen-image-2.1', prompt, images, params: { max_side: maxSide, negative_prompt: negative, seed: 1000 + attempt * 7919 } });
      entry.attempts.push({ attempt, prompt, taskRunId: r.taskRunId, url: r.url });
      result = r;
    } catch (error) {
      entry.attempts.push({ attempt, prompt, error: String(error.message || error).slice(0, 400), taskRunId: error.taskRunId || null });
    }
  }
  if (!result) { log[item.assetId] = entry; return { id: item.id, error: entry.attempts.at(-1).error }; }
  const iso = `assets/isolate/${item.assetId}${extOf(result.url)}`;
  await download(result.url, path.join(root, iso));
  entry.isolate = iso; entry.isolateUrl = result.url;
  if (item.cutMode === 'isolate') {
    try {
      const a = await generate({ model: 'birefnet-general', prompt: 'remove background', images: [result.url] });
      const alpha = `assets/isolate/${item.assetId}.alpha${extOf(a.url, '.webp')}`;
      await download(a.url, path.join(root, alpha));
      entry.alpha = alpha; entry.alphaUrl = a.url; entry.alphaTaskRunId = a.taskRunId;
    } catch (error) {
      entry.alphaError = String(error.message || error).slice(0, 400); // matte.py falls back to the white key
    }
  }
  entry.at = new Date().toISOString();
  log[item.assetId] = entry;
  return { id: item.id, isolate: iso, alpha: entry.alpha || null };
}

const results = await pool(items, Number(args.concurrency) || 4, async item => {
  const r = await cut(item);
  console.error(`${r.error ? 'FAIL' : r.skipped ? 'skip' : 'ok  '} ${item.id}${r.error ? ` — ${r.error}` : ''}`);
  await writeFile(logFile, JSON.stringify(log, null, 2) + '\n');
  return r;
});
const failed = results.filter(r => r.error);
console.log(JSON.stringify({ ok: !failed.length, spread: spread.id, isolated: results.filter(r => r.isolate).length, skipped: results.filter(r => r.skipped).length, failed: failed.map(r => r.id), log: path.relative(root, logFile) }));
if (failed.length) process.exitCode = 1;
