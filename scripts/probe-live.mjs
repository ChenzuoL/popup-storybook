#!/usr/bin/env node
// probe-live.mjs — verify the PUBLISHED Work, not the local copy.
//
//   node scripts/probe-live.mjs --url=https://neta.art/w/<owner>/<world>/<work> [--out=/tmp/live]
//
// 1. opens the Studio page in headless Chrome and reads the Work iframe's real CDN src;
// 2. opens that CDN URL directly (cross-origin frames cannot be probed from the shell) with the
//    runtime's #qa= entry: settled desktop, settled mobile, and frozen opening frames;
// 3. prints window.__neta probes (failed assets, depth audit, collisions, mechanismAudit) and writes
//    screenshots. Exit 1 if any check fails. A local pass does not prove the CDN serves the same build.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
if (!args.url) { console.error('Usage: node scripts/probe-live.mjs --url=https://neta.art/w/<owner>/<world>/<work> [--out=dir]'); process.exit(2); }
const out = path.resolve(args.out || '/tmp/popup-live');
await mkdir(out, { recursive: true });
const CHROME = args.chrome || process.env.CHROME || '/usr/local/bin/google-chrome';
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio', `--user-data-dir=/tmp/probe-live-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
if (!ver) { chrome.kill(); throw new Error('Chrome did not start'); }

async function tab() {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception ' + (m.params.exceptionDetails?.exception?.description || '').slice(0, 200));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const evalv = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  return { send, evalv, logs, close: () => ws.close() };
}

// 1. find the CDN src of the Work iframe
const shell = await tab();
await shell.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await shell.send('Page.navigate', { url: args.url });
let src = null;
for (let i = 0; i < 60 && !src; i++) {
  await sleep(500);
  src = await shell.evalv(`[...document.querySelectorAll('iframe')].map(f => f.src).find(s => /\\/content\\/index\\.html/.test(s)) || null`);
}
shell.close();
if (!src) { chrome.kill(); console.log(JSON.stringify({ ok: false, error: 'no Work iframe found on the Studio page' })); process.exit(1); }
const base = src.split('#')[0].split('?')[0];

// 2. probe the CDN build directly
const probeExpr = `(() => { const n = window.__neta; if (!n) return null; return { phase: n.phase, standees: n.standeeStates.length, failedAssets: n.failedAssets, depthAudit: n.depthAudit(0.015), collisions: n.collisions.length, mechanism: n.mechanismAudit ? n.mechanismAudit() : null, title: document.title }; })()`;
const runs = [
  { name: 'desktop', hash: 'qa=open&spread=0&fast=1&yaw=0.35&pitch=0.95', w: 1440, h: 900 },
  { name: 'mobile', hash: 'qa=open&spread=0&fast=1&yaw=0&pitch=0.9', w: 390, h: 844, mobile: true },
  { name: 'closedSide', hash: 'qa=closed&yaw=-1.15&pitch=1.3', w: 1440, h: 900 },
  { name: 'closedSideJ', hash: 'qa=closed&yaw=-1.1488&pitch=1.3', w: 1440, h: 900 },
  { name: 'opening50', hash: 'qa=open&spread=0&opening=0.50&yaw=0.45&pitch=0.92', w: 1440, h: 900 },
  { name: 'opening85', hash: 'qa=open&spread=0&opening=0.85&yaw=0.45&pitch=0.92', w: 1440, h: 900 }
];
const report = { url: args.url, cdn: base, runs: {} };
for (const r of runs) {
  const t = await tab();
  await t.send('Emulation.setDeviceMetricsOverride', { width: r.w, height: r.h, deviceScaleFactor: r.mobile ? 2 : 1, mobile: !!r.mobile });
  await t.send('Page.navigate', { url: `${base}#${r.hash}` });
  let ready = false;
  const readyExpr = r.hash.startsWith('qa=closed')
    ? "!!document.querySelector('#gate-open') && !document.querySelector('#gate-open').disabled"
    : "document.body && document.body.dataset.qa === 'ready'";
  for (let i = 0; i < 80 && !ready; i++) { await sleep(400); ready = (await t.evalv(readyExpr)) === true; }
  if (r.hash.startsWith('qa=closed')) await sleep(800);
  await sleep(400);
  const probe = await t.evalv(probeExpr);
  const shot = await t.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(out, `${r.name}.png`), Buffer.from(shot.result.data, 'base64'));
  report.runs[r.name] = { ready, probe, console: t.logs };
  t.close();
}
chrome.kill();
const bad = Object.entries(report.runs).filter(([, v]) => {
  const p = v.probe, m = p?.mechanism;
  return !v.ready || !p || v.console.length || p.failedAssets?.length || p.depthAudit?.length || p.collisions
    || (m && m.floatingStandees > 0);
}).map(([k]) => k);
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: !bad.length, cdn: base, failing: bad, out }, null, 0));
console.log(`flicker: python3 ${path.join(path.dirname(new URL(import.meta.url).pathname), 'flicker-check.py')} ${path.join(out, 'closedSide.png')} ${path.join(out, 'closedSideJ.png')}`);
for (const [k, v] of Object.entries(report.runs)) {
  const m = v.probe?.mechanism || {};
  console.log(`${k}: ready=${v.ready} phase=${m.phase} standees=${v.probe?.standees} failed=${v.probe?.failedAssets?.length} depth=${v.probe?.depthAudit?.length} collisions=${v.probe?.collisions} cover=${m.coverRotationZ?.toFixed?.(2)} leftStack=${m.leftStackScaleX?.toFixed?.(2)} floating=${m.floatingStandees}`);
}
if (bad.length) process.exitCode = 1;
