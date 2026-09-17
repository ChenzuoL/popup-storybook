// Deterministic mapping from a full-spread composition-board rectangle to book placement.
// Board rectangles are [x, y, width, height] in board pixels. The board controls x and size;
// depthBand controls Three.js z. The host renderer may use coordinateSpace: "spread" for wide items.
const DEFAULT_DEPTH = Object.freeze({ background: 0.28, midground: 0.55, foreground: 0.82 });

export function deriveBoardPlacement(boardItem, compositionBoard, options = {}) {
  const [boardWidth, boardHeight] = compositionBoard.canvas || [];
  if (!(boardWidth > 0 && boardHeight > 0)) throw new Error('compositionBoard.canvas must be positive');
  const rect = boardItem.boardRect;
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) throw new Error(`${boardItem.id}: boardRect must be [x,y,width,height]`);
  const [x, y, width, height] = rect;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > boardWidth || y + height > boardHeight) {
    throw new Error(`${boardItem.id}: boardRect must stay inside the composition board`);
  }
  const center = (x + width / 2) / boardWidth;
  const fullWidth = width / boardWidth;
  const fullHeight = height / boardHeight;
  const depths = { ...DEFAULT_DEPTH, ...(options.depthBands || {}) };
  const depthBand = boardItem.depthBand || boardItem.layer;
  const depth = depths[depthBand];
  if (!Number.isFinite(depth) || depth < 0 || depth > 1) throw new Error(`${boardItem.id}: unknown depthBand ${depthBand}`);
  const pageSide = boardItem.pageSide || (center < 0.5 ? 'left' : 'right');
  if (!['left', 'right', 'spread'].includes(pageSide)) throw new Error(`${boardItem.id}: invalid pageSide`);
  const coordinateSpace = pageSide === 'spread' ? 'spread' : 'page';
  // The renderer's page-local width is one half of the full spread, hence x/width * 2.
  const anchorX = pageSide === 'spread' ? center : pageSide === 'left' ? 1 - 2 * center : 2 * center - 1;
  return {
    anchor: [Number(anchorX.toFixed(6)), Number(depth.toFixed(6))],
    maxWidth: Number((fullWidth * 2).toFixed(6)),
    maxHeight: Number(fullHeight.toFixed(6)),
    side: pageSide === 'spread' ? (center < 0.5 ? 'left' : 'right') : pageSide,
    coordinateSpace,
    crossGutter: pageSide === 'spread',
    boardItemId: boardItem.id,
    placementSource: 'board'
  };
}

export function deriveSpreadPlacements(spread, options = {}) {
  if (!spread?.compositionBoard || !Array.isArray(spread.boardItems)) throw new Error(`${spread?.id || 'spread'}: compositionBoard and boardItems are required`);
  return spread.boardItems.map(item => deriveBoardPlacement(item, spread.compositionBoard, options));
}
