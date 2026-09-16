'use strict';

module.exports = function createAdapter({ book }) {
  const spreads = book.spreadOrder.map(id => book.spreads.find(spread => spread.id === id));
  let index = 0;
  let active = null;
  let progress = 0;
  let resolveTurn = null;
  const itemFor = spread => (spread.scene || []).map(item => ({
    id: item.id,
    ownerSpread: spread.id,
    position: [item.anchor[0], 0, item.anchor[1]],
    quaternion: [0, 0, 0, 1],
    fold: active && active.high.id === spread.id ? (1 - progress) * 0.00001 : progress * 0.00001,
    supportVisible: true
  }));
  return {
    current() { return { spreadId: spreads[index].id, turning: !!active, progress }; },
    settled() { return !active; },
    async goTo(id) { index = spreads.findIndex(spread => spread.id === id); if (index < 0) throw new Error(`unknown spread ${id}`); active = null; progress = 0; },
    turn(direction) {
      if (active) throw new Error('turn already active');
      const lowIndex = direction === 'next' ? index : index - 1;
      const highIndex = direction === 'next' ? index + 1 : index;
      if (lowIndex < 0 || highIndex >= spreads.length) throw new Error('turn outside book');
      const low = spreads[lowIndex];
      const high = spreads[highIndex];
      active = { direction, low, high };
      progress = 0;
      return new Promise(resolve => { resolveTurn = resolve; });
    },
    async seekTurn(value) {
      if (!active) throw new Error('seekTurn requires an active turn');
      progress = Math.max(0, Math.min(1, value));
      if (progress >= 1) {
        index = active.direction === 'next' ? spreads.indexOf(active.high) : spreads.indexOf(active.low);
        active = null;
        progress = 0;
        const resolve = resolveTurn;
        resolveTurn = null;
        resolve?.();
      }
    },
    attachmentSnapshot() {
      if (!active) return itemFor(spreads[index]);
      return [...itemFor(active.low), ...itemFor(active.high)];
    },
    pageSurfaceAudit() {
      if (!active) throw new Error('pageSurfaceAudit requires an active turn');
      const { low, high, direction } = active;
      return {
        lowId: low.id,
        highId: high.id,
        static: {
          left: { assetId: low.pageArt.left },
          right: { assetId: high.pageArt.right }
        },
        leaf: direction === 'next'
          ? { visible: true, frontAssetId: low.pageArt.right, backAssetId: high.pageArt.left }
          : { visible: true, frontAssetId: high.pageArt.left, backAssetId: low.pageArt.right },
        coplanarVisible: false,
        occlusions: []
      };
    },
    collisions() { return []; }
  };
};
