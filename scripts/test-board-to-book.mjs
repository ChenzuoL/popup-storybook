import assert from 'node:assert/strict';
import { deriveBoardPlacement, deriveSpreadPlacements, assignDepths, depthProblems } from '../templates/runtime/board-to-book.mjs';
const board = { canvas: [1000, 500] };
// x / size come from the board rectangle
const left = deriveBoardPlacement({ id: 'left', boardRect: [100, 100, 200, 200], pageSide: 'left', layer: 'midground' }, board, { depth: 0.5 });
assert.deepEqual(left.anchor, [0.6, 0.5]);
assert.equal(left.coordinateSpace, 'page');
assert.equal(left.side, 'left');
const right = deriveBoardPlacement({ id: 'right', boardRect: [650, 100, 200, 200], pageSide: 'right', layer: 'foreground' }, board, { depth: 0.9 });
assert.deepEqual(right.anchor, [0.5, 0.9]);
const wide = deriveBoardPlacement({ id: 'wide', boardRect: [0, 10, 1000, 80], pageSide: 'spread', layer: 'background' }, board, { depth: 0.2 });
assert.equal(wide.crossGutter, true);
assert.equal(wide.coordinateSpace, 'spread');
assert.throws(() => deriveBoardPlacement({ id: 'bad', boardRect: [900, 0, 200, 50], pageSide: 'right', layer: 'foreground' }, board), /stay inside/);
assert.throws(() => deriveBoardPlacement({ id: 'bad', boardRect: [0, 0, 10, 10], pageSide: 'right', layer: 'unknown' }, board), /unknown depthBand/);

// every standee on a spread gets its own z — the case that clipped in production:
// a trunk, a letter, a case and a rail strip all in the foreground band
const spread = {
  id: 's', compositionBoard: { canvas: [1536, 1024] },
  boardItems: [
    { id: 'bg', layer: 'background', pageSide: 'spread', boardRect: [0, 0, 1536, 700] },
    { id: 'train', layer: 'midground', pageSide: 'right', boardRect: [975, 115, 561, 715] },
    { id: 'hagrid', layer: 'midground', pageSide: 'left', boardRect: [400, 180, 322, 605] },
    { id: 'harry', layer: 'midground', pageSide: 'left', boardRect: [642, 372, 166, 432] },
    { id: 'ron', layer: 'midground', pageSide: 'right', boardRect: [823, 372, 190, 452] },
    { id: 'trunk', layer: 'foreground', pageSide: 'right', boardRect: [820, 608, 232, 214] },
    { id: 'letter', layer: 'foreground', pageSide: 'right', boardRect: [1000, 782, 152, 96] },
    { id: 'case', layer: 'foreground', pageSide: 'right', boardRect: [1150, 772, 210, 104] },
    { id: 'rail', layer: 'foreground', pageSide: 'spread', boardRect: [0, 862, 1536, 162] }
  ]
};
const placed = deriveSpreadPlacements(spread);
const z = Object.fromEntries(placed.map(p => [p.boardItemId, p.anchor[1]]));
assert.equal(new Set(Object.values(z)).size, placed.length, 'two standees share a z');
assert(z.bg < z.hagrid && z.hagrid < z.trunk, 'layers must stay back-to-front');
assert(z.trunk < z.case && z.case < z.letter && z.letter < z.rail, 'foreground must follow board baselines (lower on board = closer)');
assert(z.hagrid < z.harry && z.harry < z.ron, 'midground must follow board baselines');
const scene = placed.map((p, i) => ({ id: p.boardItemId, layer: spread.boardItems[i].layer, anchor: p.anchor }));
assert.deepEqual(depthProblems(scene), []);
const sorted = Object.values(z).sort((a, b) => a - b);
for (let i = 1; i < sorted.length; i++) assert(sorted[i] - sorted[i - 1] >= 0.02 - 1e-9, 'minimum depth gap violated');
// shared depth is reported
assert(depthProblems([{ id: 'a', layer: 'foreground', anchor: [0.2, 0.82] }, { id: 'b', layer: 'foreground', anchor: [0.4, 0.82] }]).some(p => /own z/.test(p)));
// equal baselines still get distinct depths
const twins = assignDepths([{ id: 'p', layer: 'midground', boardRect: [0, 100, 100, 300] }, { id: 'q', layer: 'midground', boardRect: [400, 100, 100, 300] }], { canvas: [1000, 500] });
assert.notEqual(twins.get('p').depth, twins.get('q').depth);
// a recorded manual calibration is honoured but must stay in its window
const manual = assignDepths([{ id: 'm', layer: 'foreground', boardRect: [0, 0, 10, 10], depth: 0.8 }], { canvas: [100, 100] });
assert.equal(manual.get('m').depth, 0.8);
assert.throws(() => assignDepths([{ id: 'm', layer: 'foreground', boardRect: [0, 0, 10, 10], depth: 0.3 }], { canvas: [100, 100] }), /outside/);
// too many pieces for one window fails loudly instead of collapsing them
assert.throws(() => assignDepths(Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, layer: 'foreground', boardRect: [i, 0, 5, 5] })), { canvas: [100, 100] }), /cannot be/);
console.log('PASS board-to-book keeps board x/size and gives every standee its own baseline-ordered z');
// measured occlusion beats the baseline: a train whose wheels hang below the platform line is still
// behind the boy the master shows in front of it
{
  const items = [
    { id: 'ron', layer: 'midground', boardRect: [818, 383, 233, 395], occludes: ['train'] },
    { id: 'train', layer: 'midground', boardRect: [962, 156, 574, 641] }
  ];
  const d = assignDepths(items, { canvas: [1536, 1024] });
  assert(d.get('train').depth < d.get('ron').depth, 'occlusion order ignored');
  const plain = assignDepths(items.map(({ occludes, ...rest }) => rest), { canvas: [1536, 1024] });
  assert(plain.get('train').depth > plain.get('ron').depth, 'fixture should invert without occlusion');
  assert(depthProblems([{ id: 'ron', layer: 'midground', anchor: [0, 0.5], occludes: ['train'] }, { id: 'train', layer: 'midground', anchor: [0, 0.6] }]).some(p => /measured in front/.test(p)));
  const cyc = [];
  assignDepths([{ id: 'a', layer: 'midground', boardRect: [0, 0, 10, 10], occludes: ['b'] }, { id: 'b', layer: 'midground', boardRect: [20, 0, 10, 10], occludes: ['a'] }], { canvas: [100, 100] }, { conflictsOut: cyc });
  assert(cyc.some(c => /cycle/.test(c)), 'occlusion cycle must be reported');
}
console.log('PASS measured occlusion order overrides the baseline and cycles fall back loudly');
