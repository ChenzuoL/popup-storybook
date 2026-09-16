// Neutral page-turn ownership state machine. Geometry and rendering stay in the host renderer.
export class PageTurnState {
  constructor(book, options = {}) {
    this.book = book;
    this.spreads = book.spreadOrder.map(id => book.spreads.find(spread => spread.id === id));
    if (this.spreads.some(spread => !spread)) throw new Error('spreadOrder contains an unknown spread');
    this.index = Math.max(0, Math.min(this.spreads.length - 1, options.startIndex || 0));
    this.epsilon = options.epsilon ?? 0.0001;
    this.poseAttachment = options.poseAttachment || defaultPose;
    this.collisionSampler = options.collisionSampler || (() => []);
    this.active = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  current() {
    const spread = this.spreads[this.index];
    return {
      spreadId: spread.id,
      chapterId: spread.chapterId,
      index: this.index,
      count: this.spreads.length,
      phase: this.active ? 'turning' : 'settled',
      turning: !!this.active,
      progress: this.active?.progress ?? 0,
      ready: true
    };
  }

  settled() { return !this.active; }

  goTo(spreadId) {
    if (this.active) throw new Error('cannot goTo during a turn');
    const next = this.spreads.findIndex(spread => spread.id === spreadId);
    if (next < 0) throw new Error(`unknown spread ${spreadId}`);
    this.index = next;
    this.#emit();
  }

  // The host animation loop calls seekTurn() once per frame after this promise starts.
  turn(direction) {
    if (this.active) return this.active.promise;
    const step = direction === 'next' ? 1 : direction === 'prev' ? -1 : 0;
    if (!step) throw new Error(`unknown turn direction ${direction}`);
    const target = this.index + step;
    if (target < 0 || target >= this.spreads.length) return Promise.resolve(false);
    const lowIndex = Math.min(this.index, target);
    const highIndex = Math.max(this.index, target);
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    this.active = { direction, from: this.index, target, lowIndex, highIndex, progress: 0, promise, resolve };
    this.#emit();
    return promise;
  }

  seekTurn(progress) {
    if (!this.active) throw new Error('seekTurn requires an active turn');
    const p = Math.max(0, Math.min(1, Number(progress)));
    if (!Number.isFinite(p)) throw new Error('turn progress must be finite');
    this.active.progress = p;
    if (p >= 1 - this.epsilon) {
      const finished = this.active;
      this.index = finished.target;
      this.active = null;
      finished.resolve(true);
    }
    this.#emit();
  }

  attachmentOwner(item) {
    if (!this.active) return item.spreadId === this.spreads[this.index].id ? 'static' : 'hidden';
    const { lowIndex, highIndex } = this.active;
    const isLeafSide = item.spreadId === this.spreads[lowIndex].id && item.side === 'right'
      || item.spreadId === this.spreads[highIndex].id && item.side === 'left';
    if (isLeafSide) return 'leaf';
    if (item.spreadId === this.spreads[lowIndex].id && item.side === 'left') return 'static';
    if (item.spreadId === this.spreads[highIndex].id && item.side === 'right') return 'static';
    return 'hidden';
  }

  attachmentSnapshot() {
    const items = [];
    const visibleSpreads = this.active
      ? [this.spreads[this.active.lowIndex], this.spreads[this.active.highIndex]]
      : [this.spreads[this.index]];
    for (const spread of visibleSpreads) {
      for (const item of spread.scene || []) {
        const owner = this.attachmentOwner({ ...item, spreadId: spread.id });
        if (owner === 'hidden') continue;
        const pose = this.poseAttachment(item, { owner, progress: this.active?.progress ?? 0, direction: this.active?.direction || null });
        items.push({ id: item.id, ownerSpread: spread.id, ...pose, owner });
      }
    }
    return items;
  }

  pageSurfaceAudit() {
    if (!this.active) throw new Error('pageSurfaceAudit requires an active turn');
    const { lowIndex, highIndex, direction, progress } = this.active;
    const low = this.spreads[lowIndex];
    const high = this.spreads[highIndex];
    const atStart = progress <= this.epsilon;
    const atEnd = progress >= 1 - this.epsilon;
    const forward = direction === 'next';
    return {
      lowId: low.id,
      highId: high.id,
      progress,
      static: {
        left: { visible: !atEnd, assetId: atEnd ? high.pageArt.left : low.pageArt.left },
        right: { visible: !atStart, assetId: atEnd ? low.pageArt.right : high.pageArt.right }
      },
      leaf: {
        visible: true,
        frontAssetId: forward ? low.pageArt.right : high.pageArt.left,
        backAssetId: forward ? high.pageArt.left : low.pageArt.right
      },
      coplanarVisible: false,
      occlusions: []
    };
  }

  collisions() {
    return this.collisionSampler(this);
  }

  #emit() {
    const snapshot = this.current();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function defaultPose(item, context) {
  const fold = context.owner === 'leaf' ? context.progress : 0;
  return {
    position: [item.anchor[0], 0, item.anchor[1]],
    quaternion: [0, 0, 0, 1],
    fold,
    supportVisible: fold < 1
  };
}
