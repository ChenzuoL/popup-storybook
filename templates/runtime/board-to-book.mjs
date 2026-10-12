// Deterministic mapping from a full-spread composition board to book placement.
//
// Board rectangles are [x, y, width, height] in board pixels. The board controls x and size.
// Depth (anchor[1], the Three.js z of the standee's fold line, 0 = back edge, 1 = front edge) is
// assigned per item so that NO TWO STANDEES ON A SPREAD SHARE A Z. Shared depth bands are what make
// neighbouring props interpenetrate ("clip through"): a trunk and a rail strip on one band occupy one plane.
//
// Rule, per spread:
//   1. layers keep their order: every background item < every midground item < every foreground item;
//   2. inside a layer, items are ordered by their board BASELINE (y + height: where the piece meets
//      the floor). A lower baseline on the board stands closer to the reader. Ties: taller first
//      (further back), then left-to-right;
//   3. z is proportional to the baseline inside the layer's window, then swept so neighbours are at
//      least `minGap` apart; if the sweep overflows the window the layer is re-spread evenly;
//   4. an explicit boardItem.depth is a recorded manual calibration; it must stay inside its window
//      and is still subject to uniqueness.

export const DEFAULT_DEPTH_WINDOWS = Object.freeze({
  background: Object.freeze([0.10, 0.34]),
  midground: Object.freeze([0.40, 0.70]),
  foreground: Object.freeze([0.75, 0.97])
});
export const DEFAULT_MIN_GAP = 0.02;
const LAYERS = ['background', 'midground', 'foreground'];
const round = v => Number(v.toFixed(6));

function windowsFrom(options = {}) {
  const out = {};
  for (const layer of LAYERS) {
    const w = options.depthWindows?.[layer] || DEFAULT_DEPTH_WINDOWS[layer];
    if (!Array.isArray(w) || w.length !== 2 || !(w[0] >= 0 && w[1] <= 1 && w[0] < w[1])) throw new Error(`depthWindows.${layer} must be [lo, hi] inside [0,1]`);
    out[layer] = w;
  }
  if (!(out.background[1] < out.midground[0] && out.midground[1] < out.foreground[0])) throw new Error('depthWindows must not overlap: background < midground < foreground');
  return out;
}

function layerOf(item) {
  const layer = item.depthBand || item.layer;
  if (!LAYERS.includes(layer)) throw new Error(`${item.id}: unknown depthBand ${layer}`);
  return layer;
}

function orderWithinLayer(items, layer, conflicts) {
  // 1. measured occlusion from the master, when matte.py could read it: front items sort after the
  //    items they cover, no matter where their baselines sit (a train whose wheels hang below the
  //    platform is still behind the figure standing in front of it)
  const edges = new Map(items.map(item => [item.id, new Set()]));   // id -> ids that must come BEFORE it
  const indeg = new Map(items.map(item => [item.id, 0]));
  const link = (before, after) => {
    if (before === after || !edges.has(before) || !edges.has(after) || edges.get(after).has(before)) return;
    edges.get(after).add(before);
    indeg.set(after, indeg.get(after) + 1);
  };
  for (const item of items) for (const behind of Array.isArray(item.occludes) ? item.occludes : []) link(behind, item.id);
  const base = item => item.boardRect[1] + item.boardRect[3];
  const priority = [...items].sort((a, b) => base(a) - base(b) || b.boardRect[3] - a.boardRect[3] || a.boardRect[0] - b.boardRect[0] || String(a.id).localeCompare(String(b.id)));
  const ordered = [];
  const remaining = new Set(items.map(i => i.id));
  while (remaining.size) {
    const ready = priority.find(item => remaining.has(item.id) && indeg.get(item.id) === 0);
    if (!ready) {   // occlusion cycle: fall back to the baseline and say so
      const rest = priority.filter(item => remaining.has(item.id));
      conflicts.push(`${layer}: occlusion constraints cycle between ${rest.map(i => i.id).join(', ')} — baseline order used`);
      ordered.push(...rest);
      break;
    }
    ordered.push(ready);
    remaining.delete(ready.id);
    for (const [id, before] of edges) if (before.has(ready.id)) indeg.set(id, indeg.get(id) - 1);
  }
  return ordered;
}

/** Unique per-item depth for every board item of one spread. Returns Map(boardItemId -> {depth, rank}). */
export function assignDepths(boardItems, compositionBoard, options = {}) {
  const [, boardHeight] = compositionBoard.canvas || [];
  if (!(boardHeight > 0)) throw new Error('compositionBoard.canvas must be positive');
  const windows = windowsFrom(options);
  const minGap = Number.isFinite(options.minGap) ? options.minGap : DEFAULT_MIN_GAP;
  const result = new Map();
  const conflicts = options.conflicts || [];
  for (const layer of LAYERS) {
    const [lo, hi] = windows[layer];
    const items = boardItems.filter(item => layerOf(item) === layer);
    if (!items.length) continue;
    if (items.length > 1 && (hi - lo) / (items.length - 1) < minGap) {
      throw new Error(`${layer}: ${items.length} standees cannot be ${minGap} apart inside [${lo}, ${hi}] — split the layer or widen depthWindows`);
    }
    const base = item => item.boardRect[1] + item.boardRect[3];
    const sorted = orderWithinLayer(items, layer, conflicts);
    // proportional to the baseline inside the window
    const b0 = base(sorted[0]), b1 = base(sorted[sorted.length - 1]);
    let z = sorted.map(item => {
      if (Number.isFinite(item.depth)) {
        if (item.depth < lo || item.depth > hi) throw new Error(`${item.id}: manual depth ${item.depth} is outside the ${layer} window [${lo}, ${hi}]`);
        return item.depth;
      }
      if (sorted.length === 1) return (lo + hi) / 2;
      const t = b1 > b0 ? (base(item) - b0) / (b1 - b0) : 0.5;
      return lo + 0.08 * (hi - lo) + t * 0.84 * (hi - lo);
    });
    // sweep forward so neighbours keep the minimum gap
    for (let i = 1; i < z.length; i++) if (z[i] < z[i - 1] + minGap) z[i] = z[i - 1] + minGap;
    if (z[z.length - 1] > hi + 1e-9) {
      const manual = sorted.some(item => Number.isFinite(item.depth));
      if (manual) throw new Error(`${layer}: manual depths leave no room for a ${minGap} gap inside [${lo}, ${hi}]`);
      z = sorted.map((_, i) => lo + (i / (sorted.length - 1)) * (hi - lo));
    }
    sorted.forEach((item, i) => result.set(item.id, { depth: round(z[i]), layer }));
  }
  // global rank: back to front, used by the renderer to stack folded standees without z-fighting
  [...result.entries()].sort((a, b) => a[1].depth - b[1].depth).forEach(([id, v], rank) => { v.rank = rank; });
  if (options.conflictsOut) options.conflictsOut.push(...conflicts);
  return result;
}

export function deriveBoardPlacement(boardItem, compositionBoard, options = {}) {
  const [boardWidth, boardHeight] = compositionBoard.canvas || [];
  if (!(boardWidth > 0 && boardHeight > 0)) throw new Error('compositionBoard.canvas must be positive');
  const rect = boardItem.boardRect;
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) throw new Error(`${boardItem.id}: boardRect must be [x,y,width,height]`);
  const [x, y, width, height] = rect;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > boardWidth || y + height > boardHeight) {
    throw new Error(`${boardItem.id}: boardRect must stay inside the composition board`);
  }
  const layer = layerOf(boardItem);
  let depth = options.depth;
  if (!Number.isFinite(depth)) {
    const [lo, hi] = windowsFrom(options)[layer];
    depth = Number.isFinite(boardItem.depth) ? boardItem.depth : (lo + hi) / 2;
  }
  const center = (x + width / 2) / boardWidth;
  const pageSide = boardItem.pageSide || (center < 0.5 ? 'left' : 'right');
  if (!['left', 'right', 'spread'].includes(pageSide)) throw new Error(`${boardItem.id}: invalid pageSide`);
  const coordinateSpace = pageSide === 'spread' ? 'spread' : 'page';
  // The renderer's page-local width is one half of the full spread, hence x/width * 2.
  const anchorX = pageSide === 'spread' ? center : pageSide === 'left' ? 1 - 2 * center : 2 * center - 1;
  return {
    anchor: [round(anchorX), round(depth)],
    maxWidth: round((width / boardWidth) * 2),
    maxHeight: round(height / boardHeight),
    side: pageSide === 'spread' ? (center < 0.5 ? 'left' : 'right') : pageSide,
    coordinateSpace,
    crossGutter: pageSide === 'spread',
    boardItemId: boardItem.id,
    placementSource: 'board',
    depthRank: Number.isFinite(options.rank) ? options.rank : undefined
  };
}

/** Placements for a whole spread, with unique per-item depth. This is the only mapper production uses. */
export function deriveSpreadPlacements(spread, options = {}) {
  if (!spread?.compositionBoard || !Array.isArray(spread.boardItems)) throw new Error(`${spread?.id || 'spread'}: compositionBoard and boardItems are required`);
  const depths = assignDepths(spread.boardItems, spread.compositionBoard, options);
  return spread.boardItems.map(item => {
    const d = depths.get(item.id);
    return deriveBoardPlacement(item, spread.compositionBoard, { ...options, depth: d.depth, rank: d.rank });
  });
}

/** Problems with a spread's scene depths: duplicates, gaps below minGap, or layer order inversions. */
export function depthProblems(scene, options = {}) {
  const minGap = Number.isFinite(options.minGap) ? options.minGap : DEFAULT_MIN_GAP;
  const problems = [];
  const items = (scene || []).filter(item => Array.isArray(item.anchor) && Number.isFinite(item.anchor[1]));
  const sorted = [...items].sort((a, b) => a.anchor[1] - b.anchor[1]);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].anchor[1] - sorted[i - 1].anchor[1];
    if (gap < minGap - 1e-9) problems.push(`${sorted[i - 1].id} and ${sorted[i].id} are ${gap.toFixed(4)} apart in depth (minimum ${minGap}); every standee needs its own z`);
  }
  const order = { background: 0, midground: 1, foreground: 2 };
  for (const a of items) for (const b of items) {
    if (order[a.layer] < order[b.layer] && a.anchor[1] >= b.anchor[1]) problems.push(`${a.id} (${a.layer}) is not behind ${b.id} (${b.layer})`);
  }
  const depthOf = new Map(items.map(i => [i.id, i.anchor[1]]));
  for (const a of items) for (const behind of Array.isArray(a.occludes) ? a.occludes : []) {
    if (depthOf.has(behind) && depthOf.get(a.id) <= depthOf.get(behind)) problems.push(`${a.id} measured in front of ${behind} on the master but stands no closer (depths ${depthOf.get(a.id)} / ${depthOf.get(behind)})`);
  }
  return problems;
}
