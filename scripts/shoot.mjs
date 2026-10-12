#!/usr/bin/env node
// shoot.mjs — serve a book folder and capture deterministic QA views in headless Chrome (CDP).
//
//   node scripts/shoot.mjs --root=/path/to/book [--out=docs/qa/shots] [--spread=0] [--views=closed,opening,front,oblique,low,back,turn,mobile]
//
// Writes one PNG per view plus report.json with failed assets, depth audit, sampled collisions and
// console errors for each view. Pixels prove nothing alone: open the PNGs and look at them.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
if (!args.root) { console.error('Usage: node scripts/shoot.mjs --root=/path/to/book [--out=docs/qa/shots] [--spread=0] [--views=...]'); process.exit(2); }
const root = path.resolve(args.root);
const out = path.resolve(root, args.out || 'docs/qa/shots');
const spread = Number(args.spread || 0);
const CHROME = args.chrome || process.env.CHROME || ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(Boolean);
const VIEWS = {
  closed: { hash: 'qa=closed', w: 1440, h: 900 },
  reclosed: { hash: `qa=open&spread=${spread}&fast=1&reclose=1`, w: 1440, h: 900 },
  // closed book at grazing angles: the cover must sit on the book as one board, edges steady
  closedSide: { hash: 'qa=closed&yaw=-1.15&pitch=1.3', w: 1440, h: 900 },
  closedLow: { hash: 'qa=closed&yaw=0.55&pitch=1.42', w: 1440, h: 900 },
  closedBack: { hash: 'qa=closed&yaw=2.3&pitch=1.15', w: 1440, h: 900 },
  // flicker probe: the same grazing view nudged by ~0.07 deg; z-fighting flips whole edge runs
  closedLowJ: { hash: 'qa=closed&yaw=0.5512&pitch=1.42', w: 1440, h: 900 },
  closedSideJ: { hash: 'qa=closed&yaw=-1.1488&pitch=1.3', w: 1440, h: 900 },
  opening: { hash: `qa=open&spread=${spread}&opening=0.52&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening10: { hash: `qa=open&spread=${spread}&opening=0.10&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening30: { hash: `qa=open&spread=${spread}&opening=0.30&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening35: { hash: `qa=open&spread=${spread}&opening=0.35&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening45: { hash: `qa=open&spread=${spread}&opening=0.45&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening50: { hash: `qa=open&spread=${spread}&opening=0.50&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening60: { hash: `qa=open&spread=${spread}&opening=0.60&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening65: { hash: `qa=open&spread=${spread}&opening=0.65&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening75: { hash: `qa=open&spread=${spread}&opening=0.75&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening25: { hash: `qa=open&spread=${spread}&opening=0.25&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening40: { hash: `qa=open&spread=${spread}&opening=0.40&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening55: { hash: `qa=open&spread=${spread}&opening=0.55&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening70: { hash: `qa=open&spread=${spread}&opening=0.70&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening85: { hash: `qa=open&spread=${spread}&opening=0.85&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  opening95: { hash: `qa=open&spread=${spread}&opening=0.95&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  // profile along the hinge axis: read the hinge turning up and over, the scene rising with it
  profile20: { hash: `qa=open&spread=${spread}&opening=0.20&yaw=0.12&pitch=1.32`, w: 1440, h: 900 },
  profile35: { hash: `qa=open&spread=${spread}&opening=0.35&yaw=0.12&pitch=1.32`, w: 1440, h: 900 },
  profile50: { hash: `qa=open&spread=${spread}&opening=0.50&yaw=0.12&pitch=1.32`, w: 1440, h: 900 },
  profile65: { hash: `qa=open&spread=${spread}&opening=0.65&yaw=0.12&pitch=1.32`, w: 1440, h: 900 },
  profile80: { hash: `qa=open&spread=${spread}&opening=0.80&yaw=0.12&pitch=1.32`, w: 1440, h: 900 },
  front: { hash: `qa=open&spread=${spread}&fast=1&yaw=0&pitch=0.86`, w: 1440, h: 900 },
  oblique: { hash: `qa=open&spread=${spread}&fast=1&yaw=0.7&pitch=1.02`, w: 1440, h: 900 },
  low: { hash: `qa=open&spread=${spread}&fast=1&yaw=-0.35&pitch=1.34`, w: 1440, h: 900 },
  back: { hash: `qa=open&spread=${spread}&fast=1&yaw=2.45&pitch=1.0`, w: 1440, h: 900 },
  turn: { hash: `qa=open&spread=${spread}&fast=1&yaw=0.3&pitch=0.95&turn=0.45`, w: 1440, h: 900 },
  // multi-spread page turn, forward from this spread and back from the next one
  turn20: { hash: `qa=open&spread=${spread}&fast=1&yaw=0.3&pitch=0.95&turn=0.2`, w: 1440, h: 900 },
  turn50: { hash: `qa=open&spread=${spread}&fast=1&yaw=0.3&pitch=0.95&turn=0.5`, w: 1440, h: 900 },
  turn80: { hash: `qa=open&spread=${spread}&fast=1&yaw=0.3&pitch=0.95&turn=0.8`, w: 1440, h: 900 },
  turnBack50: { hash: `qa=open&spread=${spread + 1}&fast=1&yaw=0.3&pitch=0.95&turn=0.5&dir=back`, w: 1440, h: 900 },
  // closing: every piece lies down with the paper
  closing30: { hash: `qa=open&spread=${spread}&closing=0.30&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  closing60: { hash: `qa=open&spread=${spread}&closing=0.60&yaw=0.45&pitch=0.92`, w: 1440, h: 900 },
  mobile: { hash: `qa=open&spread=${spread}&fast=1&yaw=0&pitch=0.9`, w: 390, h: 844, mobile: true }
};
const wanted = (args.views || 'closed,reclosed,closedSide,closedSideJ,closedLow,closedLowJ,opening,closing30,closing60,front,oblique,low,back,turn,mobile').split(',').filter(v => VIEWS[v]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };

const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, rel);
    if (!file.startsWith(root)) throw new Error('escape');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', `--user-data-dir=/tmp/shoot-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let version;
for (let i = 0; i < 60 && !version; i++) { try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
if (!version) { chrome.kill(); server.close(); throw new Error('Chrome did not start'); }

async function session() {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') logs.push(`exception: ${msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text}`);
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) logs.push(`${msg.params.type}: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  return { send, logs, close: () => ws.close() };
}

await mkdir(out, { recursive: true });
const report = { base, views: {} };
for (const name of wanted) {
  const v = VIEWS[name];
  const s = await session();
  await s.send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: v.mobile ? 2 : 1, mobile: !!v.mobile });
  await s.send('Page.navigate', { url: `${base}index.html#${v.hash}` });
  let ready = false;
  for (let i = 0; i < 160 && !ready; i++) {
    await sleep(250);
    const r = await s.send('Runtime.evaluate', { expression: v.hash.startsWith('qa=closed') ? "document.querySelector('#gate-open') && !document.querySelector('#gate-open').disabled" : "document.body.dataset.qa === 'ready'", returnByValue: true });
    ready = r.result?.result?.value === true;
  }
  await sleep(v.hash.startsWith('qa=closed') ? 900 : 500);
  const probe = await s.send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const n = window.__neta; if (!n) return null; return { phase: n.phase, state: n.state && { spreadId: n.state.spreadId, index: n.state.index }, failedAssets: n.failedAssets, depthAudit: n.depthAudit(0.015), collisions: n.collisions.slice(0, 20), standees: n.standeeStates.length, mechanism: n.mechanismAudit() }; })()` });
  const shot = await s.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(out, `${name}.png`);
  await writeFile(file, Buffer.from(shot.result.data, 'base64'));
  report.views[name] = { file: path.relative(root, file), ready, viewport: [v.w, v.h], probe: probe.result?.result?.value ?? null, console: s.logs };
  s.close();
  console.error(`${ready ? 'ok  ' : 'WAIT'} ${name} -> ${path.relative(root, file)}`);
}
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
chrome.kill(); server.close();
const bad = Object.entries(report.views).filter(([, v]) => !v.ready || v.console.some(l => l.startsWith('exception')) || v.probe?.failedAssets?.length || v.probe?.depthAudit?.length || (v.probe?.mechanism?.floatingStandees ?? 0) > 0 || (v.probe?.collisions?.length ?? 0) > 0);
console.log(JSON.stringify({ ok: !bad.length, out: path.relative(root, out), failing: bad.map(([k]) => k) }));
if (bad.length) process.exitCode = 1;
