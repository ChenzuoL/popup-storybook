'use strict';
// Static guards on templates/runtime/book3d.js for the motions the creator approved:
// one hinge (no drawer fan-out), the whole scene rising on one curve with the page angle,
// gutter-spanning pieces cut at the gutter, closed book drawn before textures bind.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '../templates/runtime/book3d.js'), 'utf8');
const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fn = name => { const i = code.indexOf(`\n  ${name}(`); assert.ok(i >= 0, `missing ${name}()`); return code.slice(i, code.indexOf('\n  }\n', i)); };

// one hinge, nothing scaled
assert.ok(/this\.hinge\s*=\s*new THREE\.Group/.test(code), 'one hinge group');
assert.ok(!/leftStack\.scale\.x\s*=/.test(code), 'left page block must not be scaled (drawer fan-out)');
// one curve: no per-piece delays, no right-first / left-later batches
assert.ok(!/riseDelay/.test(code), 'no per-piece rise delay');
assert.ok(!/layerDelay\s*[*+]/.test(code), 'no layer delay');
const deploy = fn('_deployFromHinge');
assert.ok(/rotation\.x\s*=\s*-Math\.PI \/ 2 \* \(1 - r\)/.test(deploy), 'every piece folds from the same r');
assert.ok(/_rideHinge/.test(deploy), 'left-page pieces ride the hinge');
for (const kind of ['open', 'close']) {
  const i = code.indexOf(`a.kind === '${kind}'`); assert.ok(i >= 0, `${kind} branch`);
  const body = code.slice(i, code.indexOf('} else if', i + 20));
  assert.ok(/_deployFromHinge\(/.test(body), `${kind} drives the scene from the hinge angle`);
}
assert.ok(!/_settleSpread\(|kind: 'settle'[^}]*only/.test(fn('_finishOpen')), 'no second rise batch after the book lands');
// gutter split
assert.ok(/gutterHalf/.test(code) && /\['left', L, 0\], \['right', 0, R\]/.test(code), 'gutter-spanning pieces are cut at the gutter');
// support cache must include the up state
assert.ok(/it\._up === up/.test(fn('_updateSupport')), 'support cache keyed on the up state');
// progressive binding: render loop starts before the textures resolve
const load = fn('load');
const loopAt = load.indexOf('this._loop()');
const firstWait = Math.min(...['loadTex(', 'Promise.all', 'await '].map(k => load.indexOf(k)).filter(i => i >= 0));
assert.ok(loopAt >= 0 && loopAt < firstWait, 'render loop starts before any texture is awaited');
// QA seeks
for (const h of ['seekOpen', 'seekClose', 'seekTurn', 'mechanismAudit']) assert.ok(code.includes(`\n  ${h}(`), `QA hook ${h}`);
console.log('PASS runtime motion guards (one hinge, one curve, gutter split, progressive binding)');
