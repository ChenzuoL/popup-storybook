import assert from 'node:assert/strict';
import { PageTurnState } from '../templates/runtime/page-turn-state.mjs';

const pageArt = name => ({ left: `${name}-left`, right: `${name}-right` });
const scene = name => [
  { id: `${name}-left-item`, assetId: 'subject', spreadId: name, side: 'left', anchor: [0.4, 0.5] },
  { id: `${name}-right-item`, assetId: 'subject', spreadId: name, side: 'right', anchor: [0.6, 0.5] }
];
const book = {
  spreadOrder: ['a', 'b'],
  spreads: [
    { id: 'a', chapterId: 'chapter', pageArt: pageArt('a'), scene: scene('a') },
    { id: 'b', chapterId: 'chapter', pageArt: pageArt('b'), scene: scene('b') }
  ]
};
const state = new PageTurnState(book);
assert.equal(state.current().spreadId, 'a');
const forward = state.turn('next');
assert.equal(state.turn('next'), forward, 'repeated turn requests share the active promise');
state.seekTurn(0.5);
let audit = state.pageSurfaceAudit();
assert.deepEqual(audit.leaf, { visible: true, frontAssetId: 'a-right', backAssetId: 'b-left' });
assert.deepEqual(state.attachmentSnapshot().filter(item => item.owner === 'leaf').map(item => item.id).sort(), ['a-right-item', 'b-left-item']);
state.seekTurn(1);
assert.equal(await forward, true);
assert.equal(state.current().spreadId, 'b');
const backward = state.turn('prev');
state.seekTurn(0.5);
audit = state.pageSurfaceAudit();
assert.equal(audit.static.right.assetId, 'b-right', 'backward turn keeps the current right page until landing');
assert.deepEqual(audit.leaf, { visible: true, frontAssetId: 'b-left', backAssetId: 'a-right' });
state.seekTurn(1);
await backward;
assert.equal(state.current().spreadId, 'a');
console.log('PASS neutral page-turn state ownership, turn lock and forward/backward endpoint behavior');
