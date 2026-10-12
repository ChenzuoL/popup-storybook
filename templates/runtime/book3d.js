// book3d.js — the paper book itself: boards, page blocks, deforming leaf, paper standees.
// The book model (geometry, materials, open/turn motion, camera, drag) is the original
// popup-storybook runtime. On top of it: one hinge for open/close (front board + left page block +
// left page turn together about the spine — no drawer-like fan-out), a closed book that is visible
// while the rest of the textures bind, open-to-bookmark, theme colours for the boards and the stage,
// a dedicated titled cover, a pop-up scene that rises on one curve with the page angle (left-page
// pieces turn with their page; gutter-spanning pieces are cut at the gutter), and QA hooks.
import * as THREE from '../vendor/three.module.min.js';

const PAGE_W = 0.888;          // page width in book units (matches the plate's half aspect)
const PAGE_H = 1.0;            // page height / depth
const BLOCK_H = 0.062;         // fixed page-block height
const BOARD_H = 0.022;         // board thickness under each block
const PAGE_Y = 0;              // the page plane sits at y = 0
const LEAF_LIFT = 0.006;       // keeps the turning leaf off the settled page
const CURL_MAX = 0.72;         // peak curl of a turning leaf (gentle, like a lifted sheet)

const FOLD_START = 0.02;     // the whole outgoing scene lies down together over this window
const FOLD_SPAN = 0.28;
const RISE_START = 0.50;     // the whole incoming scene stands up together over this window
const RISE_SPAN = 0.50;
const TURN_MS = 2800;
const TURN_DELAY = 200;
const PAGE_COVER_EPS = 0.0001; // only the visually flat endpoint belongs exclusively to the moving leaf
const RISE_MS = 430;
const OPEN_MS = 2000;
const DEPLOY_FROM = 0.24;           // fraction of the opening where the scene comes into sight and starts rising               // a little slower: the scene unfolds with the paper
const ORBIT_YAW = 2.55;        // ~146°: walk around to the back of the book
const ORBIT_PITCH_MIN = 0.28;  // almost top-down
const ORBIT_PITCH_MAX = 1.48;  // almost table-level, never under the table
const ORBIT_ZOOM_MIN = 0.48;
const ORBIT_ZOOM_MAX = 1.9;

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.34; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/** Arclength s along a leaf that bends over a cylinder of curvature kappa, then rotates by phi about the gutter. */
function curlPoint(s, phi, kappa, out) {
  let x, y;
  if (kappa < 1e-5) { x = s; y = 0; }
  else {
    const R = 1 / kappa;
    const a = s / R;
    x = R * Math.sin(a);
    y = R * (1 - Math.cos(a));
  }
  const c = Math.cos(phi), sn = Math.sin(phi);
  out[0] = x * c - y * sn;
  out[1] = x * sn + y * c;
}

function stripeTexture(THREE, bg = '#e6d9ba', line = '#c9b98f', rows = 26) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 8, 256);
  g.strokeStyle = line; g.lineWidth = 1;
  for (let i = 0; i < rows; i++) {
    const y = (i + 0.5) * 256 / rows;
    g.beginPath(); g.moveTo(0, y); g.lineTo(8, y); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

function shadowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(60,44,30,0.42)');
  grad.addColorStop(0.55, 'rgba(60,44,30,0.18)');
  grad.addColorStop(1, 'rgba(60,44,30,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PopupBook {
  constructor(canvas, book, hooks = {}) {
    this.canvas = canvas;
    this.book = book;
    this.hooks = hooks;
    this.spreads = book.spreadOrder.map(id => book.spreads.find(s => s.id === id));
    this.chapters = new Map(book.chapters.map(c => [c.id, c]));
    this.assetById = new Map(book.assets.map(a => [a.id, a]));
    this.state = { phase: 'closed', index: 0, p: 0, ready: false, turning: false };
    this.anim = null;
    this.drag = { yaw: 0, pitch: 0.98, zoom: 1, focus: 0, active: false, x: 0, y: 0, moved: 0 };
    this.clock = new THREE.Clock();
    this.timeScale = 1;
    this._v = [0, 0];
    this._m = new THREE.Matrix4();
    this._gx = new THREE.Vector3();
    this._gy = new THREE.Vector3();
    this._gz = new THREE.Vector3(0, 0, 1);
    this._target = new THREE.Vector3();
    this._visibleSpreads = new Set();
    this._textures = new Map();
    this._standees = new Map();   // spreadId -> array of standee records
    this._disposed = false;
    this.pageW = Number(book.pageGeometry?.pageWidth) || PAGE_W;
    this.pageH = Number(book.pageGeometry?.pageHeight) || PAGE_H;
    const theme = book.theme || {};
    this.colors = {
      board: theme.palette?.cloth || '#6f2a25',
      clear: theme.book?.background || theme.palette?.paperDeep || '#e9dfc9'
    };
  }

  // ---------------------------------------------------------------- loading

  load(onProgress) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(new THREE.Color(this.colors.clear), 1);
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.scene.add(new THREE.HemisphereLight(0xfff6e6, 0x6d5c46, 1.15));
    const key = new THREE.DirectionalLight(0xfff0d4, 1.45);
    key.position.set(1.9, 3.1, 2.2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdcd2ff, 0.35);
    fill.position.set(-2.4, 1.6, -1.2);
    this.scene.add(fill);

    this.paperMat = new THREE.MeshStandardMaterial({ color: 0xefe4cb, roughness: 0.96, metalness: 0 });
    // Page blocks use a quiet paper edge. Repeating horizontal rules read as scanlines when the camera orbits.
    this.pageEdgeMat = new THREE.MeshStandardMaterial({ color: 0xe1d3b2, roughness: 0.98, metalness: 0 });
    this.boardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.colors.board), roughness: 0.82, metalness: 0.02 });
    this.insideMat = new THREE.MeshStandardMaterial({ color: 0xe4d7bd, roughness: 0.96, metalness: 0 });
    this.propMat = new THREE.MeshBasicMaterial({ color: 0xe0d2ae });   // unlit flat paper: no normals to recompute

    this._buildBlocks();
    this._buildPages();
    this._buildLeaf();
    this._buildCover();

    // The closed book is on screen at once; the cover binds first, then everything else.
    this.leftSurface.visible = false;
    this.rightSurface.visible = false;
    this.resize();
    this._loop();

    const files = [...new Set(this.book.assets.flatMap(a => a.maskFile ? [a.file, a.maskFile] : [a.file]))];
    const coverFile = this.assetById.get(this.book.covers?.front)?.file;
    let done = 0;
    const tick = () => { done += 1; if (onProgress) onProgress(done, files.length); };
    const loader = new THREE.TextureLoader();
    const loadTex = file => new Promise(res => loader.load(file, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      this._textures.set(file, tex);
      tick();
      res(tex);
    }, undefined, () => {
      if (!this.failedAssets) this.failedAssets = [];
      this.failedAssets.push(file);
      tick();
      res(null);
    }));
    const cover = (coverFile ? loadTex(coverFile) : Promise.resolve(null)).then(async tex => {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { /* system fonts */ } }
      const coverTex = this._composeCover(tex);
      if (coverTex) this._textures.set('__cover', coverTex);
      const map = coverTex || tex;
      if (map) {
        this.coverArt.material.map = map;
        this.coverArt.material.color.set(0xffffff);
        this.coverArt.material.needsUpdate = true;
        this.renderer.initTexture(map);
      }
    });
    return cover.then(() => Promise.all(files.filter(f => f !== coverFile).map(loadTex))).then(() => {
      this._applySpreadTextures(0);
      this._buildStandees();
      // Upload before reading begins, not on the final frame of a page turn.
      for (const texture of this._textures.values()) this.renderer.initTexture(texture);
      this.state.ready = true;
      this.resize();
    });
  }

  _tex(assetId) {
    const a = this.assetById.get(assetId);
    return a ? this._textures.get(a.file) : null;
  }

  // ---------------------------------------------------------------- geometry

  _buildBlocks() {
    this.leftStack = new THREE.Group();      // left page block + its board; turns with the hinge
    this.leftStack.position.y = -0.0006;     // closed, it rests a hair above the right block, never on its plane
    this.root.add(this.leftStack);
    for (const side of [-1, 1]) {
      const cx = side * this.pageW / 2;
      const block = new THREE.Mesh(new THREE.BoxGeometry(this.pageW, BLOCK_H, this.pageH), this.pageEdgeMat);
      block.position.set(cx, PAGE_Y - BLOCK_H / 2, 0);
      (side < 0 ? this.leftStack : this.root).add(block);
      const board = new THREE.Mesh(new THREE.BoxGeometry(this.pageW + 0.018, BOARD_H, this.pageH + 0.018), this.boardMat);
      board.position.set(cx, PAGE_Y - BLOCK_H - BOARD_H / 2, 0);
      (side < 0 ? this.leftStack : this.root).add(board);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.052, BLOCK_H + BOARD_H, this.pageH + 0.016), this.boardMat);
    spine.position.set(0, PAGE_Y - (BLOCK_H + BOARD_H) / 2, 0);
    this.root.add(spine);
  }

  /** A settled page surface. u runs over the page's half of the plate: [outer 0 -> gutter 0.5] on the left,
   *  [gutter 0.5 -> outer 1] on the right. */
  _pageSurface(side) {
    const g = new THREE.PlaneGeometry(this.pageW, this.pageH);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? 0.5 * uv.getX(i) : 0.5 + 0.5 * uv.getX(i));
    g.translate(side * this.pageW / 2, PAGE_Y + 0.001, 0);
    // The printed sheet is physically above the block. Slope-based depth bias would push it
    // behind the block at oblique camera angles, exposing a blank top and the cloth spine.
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.94, metalness: 0
    }));
    mesh.renderOrder = 1;
    this.root.add(mesh);
    return mesh;
  }

  _buildPages() {
    this.leftSurface = this._pageSurface(-1);
    this.rightSurface = this._pageSurface(1);
  }

  _buildLeaf() {
    const seg = 56;
    const front = new THREE.PlaneGeometry(this.pageW, this.pageH, seg, 1);
    front.rotateX(-Math.PI / 2);
    front.translate(this.pageW / 2, 0, 0);          // x in [0, this.pageW], z in [-H/2, H/2]
    const back = front.clone();
    const fuv = front.attributes.uv, buv = back.attributes.uv;
    this._rest = new Float32Array(front.attributes.position.count * 3);
    const pos = front.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const uLeaf = pos.getX(i) / this.pageW;
      this._rest[i * 3] = pos.getX(i);
      this._rest[i * 3 + 1] = pos.getZ(i);
      fuv.setX(i, 0.5 + 0.5 * uLeaf);           // right page of the outgoing spread
      buv.setX(i, 0.5 * (1 - uLeaf));           // left page of the incoming spread
    }
    // the two faces share one position attribute, so a single deformation moves both
    back.setAttribute('position', pos);
    const leafMaterial = {
      color: 0xffffff, roughness: 0.93, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -1
    };
    this.leafFront = new THREE.Mesh(front, new THREE.MeshStandardMaterial(leafMaterial));
    this.leafBack = new THREE.Mesh(back, new THREE.MeshStandardMaterial({ ...leafMaterial, side: THREE.BackSide }));
    this.leafFront.renderOrder = this.leafBack.renderOrder = 2;
    this.leafGroup = new THREE.Group();
    this.leafGroup.position.y = LEAF_LIFT;
    this.leafGroup.add(this.leafFront, this.leafBack);
    this.leafGroup.visible = false;
    this.root.add(this.leafGroup);
  }

  _buildCover() {
    // One hinge, the way a real book opens: the front board, the left half of the page block and the
    // left printed page are glued together and turn about the spine (-PI closed -> 0 open), lifting up
    // and over. Nothing is scaled or slid; a left half that fans out of the gutter reads as a drawer.
    this.hinge = new THREE.Group();
    this.root.add(this.hinge);
    this.hinge.add(this.leftStack);
    this.hinge.add(this.leftSurface);
    this.frontBoard = this.leftStack.children.find(m => m.geometry?.parameters?.height === BOARD_H) || null;
    // Spine cap: with the left half on top, the closed book's spine edge is twice as tall as the fixed
    // joint. Hidden once the book lies open, where it would coincide with that joint.
    this.spineCap = new THREE.Mesh(new THREE.BoxGeometry(0.052, BLOCK_H + BOARD_H, this.pageH + 0.016), this.boardMat);
    this.spineCap.position.set(0, PAGE_Y - (BLOCK_H + BOARD_H) / 2 - 0.0006, 0);
    this.hinge.add(this.spineCap);
    // The cover print on the outer face of the front board. Authored in the closed pose, then turned
    // into hinge-local (open) coordinates so the hinge's -PI brings it back on top.
    const closedTop = BLOCK_H + 0.0006 + BOARD_H + 0.0012;
    const geo = new THREE.PlaneGeometry(this.pageW, this.pageH);
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.pageW / 2, closedTop, 0);
    geo.rotateZ(Math.PI);
    this.coverArt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.colors.board), roughness: 0.86, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }));
    this.hinge.add(this.coverArt);
    this.hinge.rotation.z = -Math.PI;
    this.coverGroup = this.hinge;            // older readers of the QA surface use this name
  }

  /** Cover texture: the dedicated cover art centre-cropped to the page aspect, plus the title set in
   *  the theme's display face (image models cannot be trusted with text, least of all CJK). */
  _composeCover(tex) {
    const img = tex && tex.image;
    if (!img || !img.width) return null;
    const aspect = this.pageW / this.pageH;
    const H = 1400, W = Math.round(H * aspect);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const ia = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (ia > aspect) { sw = img.height * aspect; sx = (img.width - sw) / 2; } else { sh = img.width / aspect; sy = (img.height - sh) / 2; }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    const covers = this.book.covers || {};
    const title = covers.title ?? this.book.title;
    if (title && covers.titlePlacement !== 'none') this._drawCoverTitle(g, W, H, String(title), covers.subtitle || '', covers.titlePlacement === 'bottom' ? 'bottom' : 'top');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  _drawCoverTitle(g, W, H, title, subtitle, placement) {
    const css = getComputedStyle(document.documentElement);
    const face = (css.getPropertyValue('--font-display') || '').trim() || 'serif';
    const covers = this.book.covers || {};
    const ink = covers.titleColor || this.book.theme?.palette?.paper || '#f6efdf';
    const [main, ...rest] = title.split(/\s+[·|｜]\s+/);
    const second = [rest.join(' · '), subtitle].filter(Boolean).join('  ');
    const top = placement === 'top';
    const band = H * 0.38;
    const grad = top ? g.createLinearGradient(0, 0, 0, band) : g.createLinearGradient(0, H, 0, H - band);
    grad.addColorStop(0, 'rgba(18,12,8,0.66)');
    grad.addColorStop(0.55, 'rgba(18,12,8,0.34)');
    grad.addColorStop(1, 'rgba(18,12,8,0)');
    g.fillStyle = grad;
    if (top) g.fillRect(0, 0, W, band); else g.fillRect(0, H - band, W, band);
    let size = W * 0.115;
    const fit = (txt, sz, weight, max) => { g.font = `${weight} ${sz}px ${face}`; while (g.measureText(txt).width > max && sz > 14) { sz -= 2; g.font = `${weight} ${sz}px ${face}`; } return sz; };
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(W * 0.006)}px`;
    size = fit(main, size, 600, W * 0.84);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = ink;
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = size * 0.2;
    g.shadowOffsetY = size * 0.05;
    const y1 = top ? H * 0.085 + size : H * 0.86;
    g.fillText(main, W / 2, y1);
    if (second) {
      const s2 = fit(second, Math.max(16, size * 0.4), 500, W * 0.8);
      const y2 = y1 + size * 0.42 + s2 * 1.55;            // clear of the main line's descenders
      g.fillText(second, W / 2, y2);
      g.shadowColor = 'transparent';
      g.fillRect(W / 2 - W * 0.06, y1 + size * 0.28, W * 0.12, Math.max(1.5, W * 0.0022));
    }
    g.shadowColor = 'transparent';
  }

  // ---------------------------------------------------------------- standees

  _buildStandees() {
    this._shadowTex = shadowTexture(THREE);
    this._standeeRoot = new THREE.Group();
    this.root.add(this._standeeRoot);
    for (const spread of this.spreads) {
      const group = new THREE.Group();
      group.visible = false;
      const items = [];
      for (const item of spread.scene) {
        const tex = this._tex(item.assetId);
        if (!tex) continue;
        const a = this.assetById.get(item.assetId);
        const bounds = a.alphaBounds || [0, 0, 1, 1];
        const img = tex.image || { width: 1, height: 1 };
        const visW = bounds[2], visH = bounds[3];
        if (visW <= 0 || visH <= 0) continue;
        const aspect = (img.width * visW) / (img.height * visH);
        const maxW = item.maxWidth * this.pageW, maxH = item.maxHeight * this.pageH;
        const h = Math.min(maxH, maxW / aspect);
        const w = h * aspect;
        const planeH = h / visH;
        const planeW = planeH * (img.width / img.height);
        const mask = a.maskFile ? this._textures.get(a.maskFile) : null;
        // the VISIBLE bottom-centre is the fold axis
        const pivotX = -planeW * (bounds[0] + visW / 2 - 0.5);
        const pivotY = -planeH * (0.5 - bounds[1] - visH);
        const zNorm = item.anchor[1];
        const spreadSpace = item.coordinateSpace === 'spread' || item.crossGutter === true;
        const base = { tex, mask, planeH, pivotY, h, zNorm, assetId: item.assetId, layer: item.layer };
        if (!spreadSpace) {
          const side = item.side === 'left' ? -1 : 1;
          const xNorm = item.anchor[0];
          const s = xNorm * this.pageW;
          items.push(this._makeStandee(group, {
            ...base, sceneId: item.id, side: item.side, homeX: side * s, u0: 0, u1: 1, width: planeW, offsetX: pivotX,
            w, vHalfW: Math.min((planeW * visW) / 2, item.side === 'right' ? this.pageW - s : s), leafS: s, xNorm
          }));
          continue;
        }
        // A gutter-spanning piece (backdrop curtain, rail strip) is cut at the gutter into two halves,
        // each glued to its own page — the paper equivalent of a V-fold. Then both halves turn with
        // their page and rise on the same curve as everything else; one plane across both pages would
        // cut through the page that is still turning.
        const homeX = (item.anchor[0] - 0.5) * 2 * this.pageW;
        const L = homeX + pivotX - planeW / 2, R = L + planeW;     // plane edges in spread x
        const visL = homeX - w / 2, visR = homeX + w / 2;
        const halves = L < -0.002 && R > 0.002
          ? [['left', L, 0], ['right', 0, R]]
          : [[(L + R) / 2 < 0 ? 'left' : 'right', L, R]];
        for (const [side, x0, x1] of halves) {
          const width = x1 - x0, cx = (x0 + x1) / 2;
          const vis = Math.max(0.01, Math.min(x1, visR) - Math.max(x0, visL));
          const sAbs = Math.abs(cx);
          items.push(this._makeStandee(group, {
            ...base, sceneId: halves.length > 1 ? `${item.id}:${side[0]}` : item.id, side, homeX: cx,
            u0: (x0 - L) / planeW, u1: (x1 - L) / planeW, width, offsetX: 0,
            w: vis, vHalfW: Math.min(width / 2, side === 'right' ? this.pageW - sAbs : sAbs), leafS: sAbs, xNorm: sAbs / this.pageW,
            gutterHalf: halves.length > 1
          }));
        }
      }
      this._standees.set(spread.id, { group, items });
      this._standeeRoot.add(group);
    }
  }

  /** One paper standee: printed front, plain back through the mask, rear prop, crease, shadow. */
  _makeStandee(group, o) {
    const geo = new THREE.PlaneGeometry(o.width, o.planeH);
    if (o.u0 !== 0 || o.u1 !== 1) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, o.u0 + uv.getX(i) * (o.u1 - o.u0));
      uv.needsUpdate = true;
    }
    geo.translate(o.offsetX, o.pivotY, 0);
    const mesh = new THREE.Mesh(geo,
      new THREE.MeshStandardMaterial({ map: o.tex, transparent: true, alphaTest: 0.42, roughness: 0.9, metalness: 0 }));
    mesh.material.map.anisotropy = 8;
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xe6dabd, roughness: 0.97, metalness: 0,
      alphaMap: o.mask, transparent: true, alphaTest: 0.42, side: THREE.BackSide
    }));
    // a folded prop behind the cutout: two paper panels meeting at a knee that opens as the figure rises
    const panelGeo = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      g.setIndex([0, 1, 2, 2, 1, 3]);
      return g;
    };
    const support = [0, 1].map(() => { const m = new THREE.Mesh(panelGeo(), this.propMat); m.frustumCulled = false; return m; });
    const rig = new THREE.Group();          // carries the fold: 0 = upright, -PI/2 = flat on the page
    rig.add(mesh, back);
    const figure = new THREE.Group();       // carries the page frame while the paper is in flight
    figure.add(rig, ...support);
    const home = new THREE.Vector3(o.homeX, PAGE_Y + 0.003, -this.pageH / 2 + o.zNorm * this.pageH);
    figure.position.copy(home);
    rig.rotation.x = -Math.PI / 2;
    group.add(figure);
    const w = o.w, h = o.h;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, w * 0.5),
      new THREE.MeshBasicMaterial({ map: this._shadowTex, transparent: true, depthWrite: false, opacity: 0.9 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(home.x, PAGE_Y + 0.002, home.z - h * 0.06);
    shadow.visible = false;
    group.add(shadow);
    // the fold line printed on the page where this cut-out is glued
    const crease = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.32, 0.2), 0.012),
      new THREE.MeshBasicMaterial({ color: 0x8c806b, transparent: true, opacity: 0.22, depthWrite: false }));
    crease.rotation.x = -Math.PI / 2;
    crease.position.set(home.x, PAGE_Y + 0.0018, home.z - h * 0.02);
    crease.visible = false;
    group.add(crease);
    const it = {
      figure, rig, shadow, crease, mesh, support, home, side: o.side, xNorm: o.xNorm, zNorm: o.zNorm, h, w,
      assetId: o.assetId, sceneId: o.sceneId, spreadSpace: false, gutterHalf: !!o.gutterHalf,
      leafS: o.leafS, vHalfW: o.vHalfW, vH: o.planeH * (h / o.planeH)
    };
    this._updateSupport(it);
    return it;
  }

  /** Deploy a spread's scene from the hinge angle alone: every piece on one curve, together. Left-page
   *  pieces are glued to the left page and turn with it. phi: -PI closed .. 0 open. */
  _deployFromHinge(spreadId, phi) {
    const rec = this._standees.get(spreadId);
    if (!rec) return;
    const open = 1 - Math.min(1, Math.abs(phi) / Math.PI);
    // Inside a nearly shut book the scene is out of sight; it appears as the pages part (about 45°
    // apart) and starts lifting at once, so nothing lies flat in view for long.
    const r = smooth(Math.min(Math.max((open - DEPLOY_FROM) / (1 - DEPLOY_FROM), 0), 1));
    const inSight = phi > -Math.PI * (1 - DEPLOY_FROM - 0.012);
    const landed = Math.abs(phi) < 0.01;
    for (const it of rec.items) {
      it.rig.rotation.x = -Math.PI / 2 * (1 - r);
      it.figure.visible = inSight;
      if (it.side === 'left') {
        it.riding = !landed;
        if (landed) this._placeHome(it); else this._rideHinge(it, phi);
        it.shadow.visible = inSight && landed && r > 0.3;
      } else {
        it.riding = false;
        it.shadow.visible = inSight && r > 0.3;
      }
      this._updateSupport(it, r);
    }
  }

  /** A left-page piece glued to the turning hinge: same rotation about the spine axis. */
  _rideHinge(it, phi) {
    const c = Math.cos(phi), s = Math.sin(phi);
    it.figure.position.set(it.home.x * c - it.home.y * s, it.home.x * s + it.home.y * c, it.home.z);
    it.figure.quaternion.setFromAxisAngle(this._gz, phi);
  }

  // ---------------------------------------------------------------- state

  current() {
    const spread = this.spreads[this.state.index];
    return {
      spreadId: spread.id,
      chapterId: spread.chapterId,
      chapterTitle: (this.chapters.get(spread.chapterId) || {}).title || '',
      index: this.state.index,
      count: this.spreads.length,
      title: spread.title,
      passages: spread.passages,
      ready: this.state.ready,
      phase: this.state.phase,
      turning: this.state.turning
    };
  }

  _applySpreadTextures(index) {
    const s = this.spreads[index];
    this.leftSurface.material.map = this._tex(s.pageArt.left);
    this.rightSurface.material.map = this._tex(s.pageArt.right);
  }

  /** The two-panel paper prop behind a cut-out, re-solved every time the figure's fold changes. */
  _updateSupport(it, e = 1) {
    const up = e > 0.45;
    if (it._fold === it.rig.rotation.x && it._shown === it.figure.visible && it._up === up && it._ride === !!it.riding) return;
    it._fold = it.rig.rotation.x;
    it._shown = it.figure.visible;
    it._up = up;
    it._ride = !!it.riding;
    if (!it.figure.visible) {
      it.support[0].visible = false;
      it.support[1].visible = false;
      it.crease.visible = false;
      return;
    }
    const th = it.rig.rotation.x;
    const top = { y: it.h * Math.cos(th), z: it.h * Math.sin(th) };
    const base = { y: 0.004, z: -it.h * 0.9 };
    const dy = top.y - base.y, dz = top.z - base.z;
    const d = Math.hypot(dy, dz);
    const reach = Math.sqrt(Math.max(0, (it.h * 0.5) ** 2 - d * d / 4));
    const knee = {
      y: (top.y + base.y) / 2 + (reach * dz) / Math.max(d, 1e-4),
      z: (top.z + base.z) / 2 - (reach * dy) / Math.max(d, 1e-4)
    };
    const w = Math.min(it.w * 0.2, 0.13);
    this._writePanel(it.support[0], top, knee, w);
    this._writePanel(it.support[1], knee, base, w);
    // the prop only reads as paper once the cut-out is well up; near flat its two panels invert
    const shown = th < -0.10 && up;
    it.support[0].visible = shown;
    it.support[1].visible = shown;
    it.crease.visible = shown && !it.riding;
  }

  _writePanel(mesh, a, b, w) {
    const p = mesh.geometry.attributes.position;
    p.setXYZ(0, -w / 2, a.y, a.z);
    p.setXYZ(1, w / 2, a.y, a.z);
    p.setXYZ(2, -w / 2, b.y, b.z);
    p.setXYZ(3, w / 2, b.y, b.z);
    p.needsUpdate = true;
  }

  _placeHome(it) {
    it.figure.position.copy(it.home);
    it.figure.quaternion.identity();
    it.shadow.position.set(it.home.x, PAGE_Y + 0.002, it.home.z - it.h * 0.06);
    it._home = true;
    this._updateSupport(it);
  }

  _showStandees(spreadId, mode) {
    for (const id of this._visibleSpreads) {
      if (id !== spreadId) this._standees.get(id).group.visible = false;
    }
    this._visibleSpreads = new Set([spreadId]);
    const rec = this._standees.get(spreadId);
    rec.group.visible = true;
    {
      for (const it of rec.items) {
        it.riding = false;
        this._placeHome(it);
        if (mode === 'up') { it.figure.visible = true; it.rig.rotation.x = 0; }
        else { it.figure.visible = mode === 'folded'; it.rig.rotation.x = -Math.PI / 2; }
        it.shadow.visible = mode === 'up';
        this._updateSupport(it, mode === 'up' ? 1 : 0);
      }
    }
  }

  /** Places a pop-up that is glued to the turning leaf: its base and its surface frame follow the curled paper. */
  _rideLeaf(it, p, face) {
    const s = it.leafS ?? it.xNorm * this.pageW;
    const phi = Math.PI * p;
    const kappa = CURL_MAX * Math.sin(Math.PI * Math.min(Math.max(p, 0), 1)) ** 2;
    // A rigid cut-out rests on the CHORD of the curved paper, not on its tangent: its two ends touch
    // the sheet and the middle clears it, which is both what paper does and what keeps edges honest.
    const half = it.spreadSpace
      ? Math.max(1e-6, it.vHalfW)
      : Math.max(1e-6, Math.min(it.vHalfW, s, this.pageW - s));
    const sA = it.spreadSpace ? s - half : Math.max(0, s - half);
    const sB = it.spreadSpace ? s + half : Math.min(this.pageW, s + half);
    curlPoint(sA, phi, kappa, this._v);
    const ax = this._v[0], ay = this._v[1];
    curlPoint(sB, phi, kappa, this._v);
    const bx = this._v[0], by = this._v[1];
    let dx = bx - ax, dy = by - ay;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const gx = this._gx.set(face * dx, face * dy, 0);
    const gy = this._gy.set(-face * dy, face * dx, 0);
    this._m.makeBasis(gx, gy, this._gz);
    it.figure.quaternion.setFromRotationMatrix(this._m);
    // If the sheet bows toward the printed face, the card rests on that bulge and its ends lift clear;
    // if it bows away, the card's two ends touch the sheet and the middle floats.
    curlPoint(s, phi, kappa, this._v);
    const off = (this._v[0] - (ax + bx) / 2) * gy.x + (this._v[1] - (ay + by) / 2) * gy.y;
    const lift = 0.002 + Math.max(0, off);
    it.figure.position.set(
      (ax + bx) / 2 + gy.x * lift,
      this.leafGroup.position.y + (ay + by) / 2 + gy.y * lift,
      it.home.z
    );
    return gy.y;                                        // how far this pop-up's up-direction points skyward
  }

  // ---------------------------------------------------------------- motions

  /** Prepare a spread's page art and the cover's inside before opening onto it. */
  _prepareSpread(index) {
    this._applySpreadTextures(index);
  }

  open(targetIndex = this.state.index) {
    if (this.state.phase !== 'closed' || !this.state.ready) return false;
    const index = Math.max(0, Math.min(this.spreads.length - 1, targetIndex | 0));
    this.state.index = index;
    this._prepareSpread(index);
    this.state.phase = 'opening';
    this.hinge.rotation.z = -Math.PI;
    this._showStandees(this.spreads[index].id, 'folded');
    this.leftSurface.visible = false;
    this.anim = { kind: 'open', t: 0, dur: OPEN_MS, settle: false };
    this.hooks.onStart && this.hooks.onStart('open');
    return true;
  }

  /** Close from a settled spread: the original opening, reversed. */
  close() {
    if (!this.state.ready || this.state.phase !== 'idle' || this.anim) return false;
    this.state.phase = 'closing';
    this.leafGroup.visible = false;
    this.anim = { kind: 'close', t: 0, dur: OPEN_MS };
    this.hooks.onStart && this.hooks.onStart('close');
    return true;
  }

  settled() { return this.state.phase === 'idle' && !this.anim; }

  turn(dir) {
    if (!this.state.ready || this.state.phase !== 'idle' || this.anim) return false;
    const target = this.state.index + dir;
    if (target < 0 || target >= this.spreads.length) return false;
    const from = this.spreads[this.state.index];
    const to = this.spreads[target];
    const leafDir = dir > 0 ? 1 : -1;

    this._showStandees(from.id, 'up');
    // A spread's left leaf always carries the EARLIER spread and its right leaf the LATER one, so a
    // backward turn never repaints the page it is turning away from: the left page is revealed under
    // the lifting leaf, the right page keeps its picture until the leaf lands on it.
    const earlier = leafDir > 0 ? from : to;
    const later = leafDir > 0 ? to : from;
    this.leftSurface.material.map = this._tex(earlier.pageArt.left);
    this.rightSurface.material.map = this._tex(later.pageArt.right);
    this.leftSurface.visible = true;
    this.rightSurface.visible = true;

    this.leafFront.material.map = this._tex(earlier.pageArt.right);   // becomes the right-hand page
    this.leafBack.material.map = this._tex(later.pageArt.left);       // becomes the left-hand page
    // Existing texture maps share the same shader; a map swap needs no program rebuild.
    this.state.p = leafDir > 0 ? 0 : 1;
    this._deformLeaf(this.state.p);
    this._updateTurnSurfaceVisibility(this.state.p);
    this.leafGroup.visible = true;

    // The turning leaf physically carries two page groups: the outgoing page that becomes its front
    // face and the incoming page that becomes its back. Those groups ride the paper; the rest stand
    // on the page the leaf has uncovered.
    const outCarriedSide = leafDir > 0 ? 'right' : 'left';
    const inCarriedSide = leafDir > 0 ? 'left' : 'right';
    const outFace = leafDir > 0 ? 1 : -1;
    const inFace = -outFace;

    const inc = this._standees.get(to.id);
    inc.group.visible = true;
    this._visibleSpreads.add(to.id);
    for (const it of inc.items) {
      this._placeHome(it);
      it.riding = it.side === inCarriedSide;
      it.face = inFace;
      it.ridingRole = 'in';
      it.rig.rotation.x = -Math.PI / 2;
      it.figure.visible = false;
      it.shadow.visible = false;
      it.crease.visible = false;
    }
    const out = this._standees.get(from.id);
    for (const it of out.items) {
      it.riding = it.side === outCarriedSide;
      it.face = outFace;
      it.ridingRole = 'out';
    }

    this.state.phase = 'turning';
    this.state.turning = true;
    this.anim = { kind: 'turn', t: 0, dur: TURN_MS + TURN_DELAY, dir: leafDir, target, fromId: from.id, toId: to.id, settled: false };
    this.hooks.onStart && this.hooks.onStart('turn', dir);
    return true;
  }

  goTo(spreadId) {
    const index = this.spreads.findIndex(s => s.id === spreadId);
    if (index < 0 || !this.state.ready || index === this.state.index || this.state.phase === 'turning' || this.state.phase === 'opening' || this.state.phase === 'closing') return false;
    if (this.state.phase === 'closed') { this.state.index = index; this._prepareSpread(index); return true; }
    this.anim = null;
    this.leafGroup.visible = false;
    this.state.phase = 'idle';
    this.state.turning = false;
    this.state.index = index;
    this.state.p = 0;
    this._applySpreadTextures(index);
    this._showStandees(spreadId, 'folded');
    this._standees.get(spreadId).group.visible = true;
    this.anim = { kind: 'settle', t: 0, dur: RISE_MS };
    this.hooks.onSettled && this.hooks.onSettled(this.current());
    return true;
  }

  _updateTurnSurfaceVisibility(p) {
    // At p=0 the moving leaf owns the right-page surface; at p=1 it owns the left.
    // Keeping the covered static surface alive would leave two textured meshes on one plane.
    this.rightSurface.visible = p > PAGE_COVER_EPS;
    this.leftSurface.visible = p < 1 - PAGE_COVER_EPS;
  }

  _deformLeaf(p) {
    const phi = Math.PI * p;
    const bend = Math.sin(Math.PI * Math.min(Math.max(p, 0), 1)) ** 2;
    const kappa = CURL_MAX * bend;
    this.leafGroup.position.y = PAGE_Y + 0.001 + LEAF_LIFT * bend;
    const pos = this.leafFront.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const s = this._rest[i * 3];
      const z = this._rest[i * 3 + 1];
      curlPoint(s, phi, kappa, this._v);
      arr[i * 3] = this._v[0];
      arr[i * 3 + 1] = this._v[1];
      arr[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    this.leafFront.geometry.computeVertexNormals();
    this.leafBack.geometry.setAttribute('normal', this.leafFront.geometry.attributes.normal);
  }

  _finishTurn(anim) {
    this.state.index = anim.target;
    this.state.phase = 'idle';
    this.state.turning = false;
    this.state.p = 0;
    this._applySpreadTextures(anim.target);
    this.leftSurface.visible = true;
    this.rightSurface.visible = true;
    this.leafGroup.visible = false;
    this._showStandees(anim.toId, 'up');
    const settled = this.current();
    requestAnimationFrame(() => this.hooks.onSettled && this.hooks.onSettled(settled));
  }

  _finishOpen() {
    this.state.phase = 'idle';
    this.hinge.rotation.z = 0;
    this.leftSurface.visible = true;
    this._applySpreadTextures(this.state.index);
    this._showStandees(this.spreads[this.state.index].id, 'up');
    this.hooks.onSettled && this.hooks.onSettled(this.current());
  }

  _finishClose() {
    this.state.phase = 'closed';
    this.drag.focus = 0;
    this.hinge.rotation.z = -Math.PI;
    this.leftSurface.visible = false;
    this.rightSurface.visible = false;
    const rec = this._standees.get(this.spreads[this.state.index].id);
    if (rec) rec.group.visible = false;
    this._visibleSpreads.clear();
    this.hooks.onClosed && this.hooks.onClosed(this.current());
  }

  // ---------------------------------------------------------------- loop

  _update(dt) {
    const a = this.anim;
    const dts = dt * 1000 * (this.timeScale === undefined ? 1 : this.timeScale);
    if (!a) {
      // idle breathing of the standees is intentionally absent: the book is paper, not a cartoon
    } else if (a.kind === 'open') {
      a.t += dts;
      const t = Math.min(a.t / a.dur, 1);
      const e = easeInOut(t);
      // the hinge lifts up and over the spine; the left page shows once it is off the right page
      this.hinge.rotation.z = -Math.PI * (1 - e);
      this.leftSurface.visible = e > 0.02;
      this.rightSurface.visible = true;
      this.drag.focus = e;
      // every piece rises together with the paper, driven by the hinge angle alone
      this._deployFromHinge(this.spreads[this.state.index].id, this.hinge.rotation.z);
      if (t >= 1) { this.anim = null; this._finishOpen(); }
    } else if (a.kind === 'turn') {
      a.t += dts;
      const done = a.t >= TURN_MS + TURN_DELAY;
      const t = Math.min(Math.max((a.t - TURN_DELAY) / TURN_MS, 0), 1);
      const p = a.dir > 0 ? (done ? 1 : smooth(t)) : (done ? 0 : 1 - smooth(t));
      this.state.p = p;
      this._deformLeaf(p);
      this._updateTurnSurfaceVisibility(p);
      const q = a.dir > 0 ? p : 1 - p;              // progress of the landing, both directions
      // One page, one mechanism: every cut-out on the outgoing spread lies down together, and every
      // cut-out on the incoming spread stands up together, driven by the paper's own progress.
      const outE = 1 - easeInOut(Math.min(Math.max((q - FOLD_START) / FOLD_SPAN, 0), 1));
      const inE = smooth(Math.min(Math.max((q - RISE_START) / RISE_SPAN, 0), 1));

      // the outgoing scene lies down as the paper comes over it
      const recFrom = this._standees.get(a.fromId);
      if (recFrom) for (const it of recFrom.items) {
        // a cut-out riding the paper must lie down at once; one left on the page can take the whole turn
        const e = outE;
        if (it.riding) {
          const upY = this._rideLeaf(it, p, it.face);
          it.figure.visible = upY > 0.12;
        } else {
          it.figure.visible = e > 0.08;
        }
        it.rig.rotation.x = -Math.PI / 2 * (1 - e);
        it.shadow.visible = e > 0.55;
        this._updateSupport(it, e);
      }

      // the incoming scene stands up out of the page and off the moving paper
      const recTo = this._standees.get(a.toId);
      if (recTo) for (const it of recTo.items) {
        // the page the leaf uncovers pops up early; the one glued to the flying paper stands as it lands
        const e = inE;
        if (it.riding) {
          const upY = this._rideLeaf(it, p, it.face);
          it.figure.visible = upY > 0.12;
        } else {
          it.figure.visible = e > 0.08;
        }
        it.rig.rotation.x = -Math.PI / 2 * (1 - e);
        it.shadow.visible = e > 0.4;
        this._updateSupport(it, e);
      }
      if (done) { this.anim = null; this._finishTurn(a); }
    } else if (a.kind === 'close') {
      a.t += dts;
      // the opening, backwards: the hinge turns back over and every piece lies down with it
      const t = Math.min(Math.max(a.t / a.dur, 0), 1);
      const e = 1 - easeInOut(t);
      this.hinge.rotation.z = -Math.PI * (1 - e);
      this.leftSurface.visible = e > 0.02;
      this.rightSurface.visible = true;
      this.drag.focus = e;
      this._deployFromHinge(this.spreads[this.state.index].id, this.hinge.rotation.z);
      if (t >= 1) { this.anim = null; this._finishClose(); }
    } else if (a.kind === 'settle') {
      a.t += dts;
      const spreadId = this.spreads[this.state.index].id;
      const rec = this._standees.get(spreadId);
      if (rec) for (const it of rec.items) {
        if (a.only && !a.only.has(it)) continue;
        const local = a.t / RISE_MS;                 // every piece together: parallel planes never cross
        const t = Math.min(Math.max(local, 0), 1);
        it.figure.visible = t > 0.08;
        it.rig.rotation.x = -Math.PI / 2 * (1 - easeOutBack(t));
        it.shadow.visible = t > 0.3;
        this._updateSupport(it, t);
      }
      if (a.t >= a.dur) this.anim = null;
    }
  }

  /** QA hook: pairs of standees on one spread whose fold lines are closer than minGap (book units). */
  depthAudit(minGap = 0.015) {
    const out = [];
    for (const [id, rec] of this._standees) {
      const zs = [...rec.items].sort((a, b) => a.home.z - b.home.z);
      for (let i = 1; i < zs.length; i++) {
        const gap = zs[i].home.z - zs[i - 1].home.z;
        if (zs[i].gutterHalf && zs[i - 1].gutterHalf && zs[i].assetId === zs[i - 1].assetId) continue;
        if (gap < minGap) out.push({ spread: id, a: zs[i - 1].assetId, b: zs[i].assetId, gap: Number(gap.toFixed(4)) });
      }
    }
    return out;
  }

  /** QA hook: the open/close mechanism, and any piece standing where its paper is not there yet. */
  mechanismAudit() {
    let floating = 0;
    const rec = this._standees.get(this.spreads[this.state.index]?.id);
    if (rec && rec.group.visible && this.state.phase !== 'turning') {
      // a raised piece must share its page's frame: left pieces turn with the hinge, right pieces stay put
      const q = new THREE.Quaternion();
      for (const it of rec.items) {
        if (!it.figure.visible || it.rig.rotation.x < -1.2) continue;
        const want = it.side === 'left' ? this.hinge.rotation.z : 0;
        q.setFromAxisAngle(this._gz, want);
        if (it.figure.quaternion.angleTo(q) > 0.02) floating++;
      }
    }
    return {
      model: 'original',
      phase: this.state.phase,
      hingeRotationZ: this.hinge.rotation.z,
      coverRotationZ: this.hinge.rotation.z + Math.PI,     // 0 closed -> PI open, as before
      leftStackScaleX: this.leftStack.scale.x,
      spineCapVisible: this.spineCap.visible,
      floatingStandees: floating,
      orbit: { yaw: this.drag.yaw, pitch: this.drag.pitch }
    };
  }

  /** QA hook: freeze the cover-opening mechanism at normalized progress. */
  seekClose(u) {
    if (!this.anim || this.anim.kind !== 'close') return null;
    this.anim.t = Math.min(this.anim.dur * 0.999, Math.max(0, u) * this.anim.dur);
    this._update(0);
    return { hinge: this.hinge.rotation.z };
  }

  seekOpen(u) {
    if (!this.anim || this.anim.kind !== 'open') return null;
    this.anim.t = Math.min(this.anim.dur * 0.999, Math.max(0, u) * this.anim.dur);
    this._update(0);
    return { hinge: this.hinge.rotation.z, leftStack: this.leftStack.scale.x };
  }

  /** QA hook: sampled bounds of the turning leaf's vertices, in book units. */
  leafSample() {    if (!this.leafGroup.visible) return null;
    const arr = this.leafFront.geometry.attributes.position.array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < arr.length; i += 3) {
      if (arr[i] < minY) minY = arr[i];
      if (arr[i] > maxY) maxY = arr[i];
    }
    return { minY: minY + this.leafGroup.position.y, maxY: maxY + this.leafGroup.position.y, p: this.state.p };
  }

  /** QA hook: fold angle of every pop-up in the visible spread (0 = upright, -PI/2 = flat on the page). */
  standeeStates() {
    const out = [];
    for (const [id, rec] of this._standees) {
      if (!rec.group.visible) continue;
      for (const it of rec.items) {
        out.push({ id: it.sceneId || `${id}:${it.assetId}`, spread: id, asset: it.assetId, ownerSpread: id, position: it.figure.position.toArray(), fold: it.rig.rotation.x, visible: it.figure.visible, riding: !!it.riding });
      }
    }
    return out;
  }

  /** QA hook: stable ownership/depth snapshot for the active adjacent turn. */
  pageSurfaceAudit() {
    const a = this.anim;
    if (!a || a.kind !== 'turn') {
      const current = this.spreads[this.state.index];
      return {
        lowId: current?.id || null, highId: current?.id || null, progress: 0,
        static: { left: { visible: this.leftSurface.visible, assetId: current?.pageArt?.left || null }, right: { visible: this.rightSurface.visible, assetId: current?.pageArt?.right || null } },
        leaf: { visible: this.leafGroup.visible, frontAssetId: null, backAssetId: null },
        coplanarVisible: false, occlusions: [],
        depth: { leftRenderOrder: this.leftSurface.renderOrder, rightRenderOrder: this.rightSurface.renderOrder, leafRenderOrder: this.leafFront.renderOrder }
      };
    }
    const from = this.spreads.find(spread => spread.id === a.fromId);
    const to = this.spreads.find(spread => spread.id === a.toId);
    const forward = a.dir > 0;
    const low = forward ? from : to;
    const high = forward ? to : from;
    const progress = forward ? this.state.p : 1 - this.state.p;
    const coplanarVisible = progress <= PAGE_COVER_EPS && this.rightSurface.visible || progress >= 1 - PAGE_COVER_EPS && this.leftSurface.visible;
    return {
      lowId: low?.id || null, highId: high?.id || null, progress,
      static: { left: { visible: this.leftSurface.visible, assetId: low?.pageArt?.left || null }, right: { visible: this.rightSurface.visible, assetId: high?.pageArt?.right || null } },
      leaf: { visible: this.leafGroup.visible, frontAssetId: low?.pageArt?.right || null, backAssetId: high?.pageArt?.left || null },
      coplanarVisible, occlusions: [],
      depth: { leftRenderOrder: this.leftSurface.renderOrder, rightRenderOrder: this.rightSurface.renderOrder, leafRenderOrder: this.leafFront.renderOrder, leftPolygonOffset: !!this.leftSurface.material.polygonOffset, rightPolygonOffset: !!this.rightSurface.material.polygonOffset }
    };
  }

  /** QA hook: world-space attachment snapshot with stable scene ids and page ownership. */
  attachmentSnapshot() {
    this.root.updateMatrixWorld(true);
    const out = [];
    for (const [spreadId, record] of this._standees) {
      if (!record.group.visible) continue;
      for (const item of record.items) {
        if (!item.figure.visible && !item.riding) continue;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        item.figure.getWorldPosition(position);
        item.figure.getWorldQuaternion(quaternion);
        out.push({
          id: item.sceneId || `${spreadId}:${item.assetId}`,
          assetId: item.assetId, ownerSpread: spreadId,
          position: position.toArray(), quaternion: quaternion.toArray(),
          fold: item.rig.rotation.x, supportVisible: item.support.some(panel => panel.visible),
          owner: item.riding ? 'leaf' : 'static'
        });
      }
    }
    return out;
  }

  /** QA hook: seek to a normalized point inside the running turn, then re-solve that frame. */
  seekTurn(u) {
    if (!this.anim || this.anim.kind !== 'turn') return null;
    this.anim.t = Math.min(this.anim.dur, Math.max(0, u) * this.anim.dur);
    this._update(0);
    return this.state.p;
  }

  /** QA hook: ray-cast every visible cut-out / prop edge against the pages and the moving leaf.
   *  Returns the crossing records; finite sampling is evidence, not a proof of no intersection. */
  collisions() {
    this.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const targets = [];
    if (this.leafGroup.visible) targets.push(this.leafFront, this.leafBack);
    if (this.leftSurface.visible) targets.push(this.leftSurface);
    if (this.rightSurface.visible) targets.push(this.rightSurface);
    if (this.frontBoard && Math.abs(this.hinge.rotation.z) > 0.01) targets.push(this.frontBoard);

    // Only opaque edges are sampled: a cut-out contributes its visible rectangle, a prop its two panels.
    const edges = [];
    for (const [id, rec] of this._standees) {
      if (!rec.group.visible) continue;
      for (const it of rec.items) {
        if (!it.figure.visible) continue;
        const q = [[-it.vHalfW, 0], [it.vHalfW, 0], [it.vHalfW, it.vH], [-it.vHalfW, it.vH]];
        const pts = q.map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(it.mesh.matrixWorld));
        edges.push({ kind: 'standee', id: it.assetId || id, pts });
        for (const panel of it.support) {
          if (!panel.visible) continue;
          const p = panel.geometry.attributes.position;
          const pp = [0, 1, 2, 3].map(k => new THREE.Vector3().fromBufferAttribute(p, k).applyMatrix4(panel.matrixWorld));
          edges.push({ kind: 'support', id: it.assetId || id, pts: pp });
        }
      }
    }

    const problems = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
    for (const { kind, id, pts } of edges) {
      for (let k = 0; k < pts.length; k++) {
        A.copy(pts[k]); B.copy(pts[(k + 1) % pts.length]); D.copy(B).sub(A);
        const len = D.length();
        if (len < 1e-5) continue;
        ray.set(A, D.clone().normalize());
        ray.far = len;
        for (const hit of ray.intersectObjects(targets, false)) {
          const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          const da = A.clone().sub(hit.point).dot(n);
          const db = B.clone().sub(hit.point).dot(n);
          // a sign change with an explicit coplanarity tolerance: grazes at the glued edge and
          // near-corner contacts of a flat card on a curved sheet are not paper violations
          const depth = Math.min(Math.abs(da), Math.abs(db));
          if (da * db < 0 && depth > 0.004 && hit.distance > 0.008 && hit.distance < len - 0.008) {
            problems.push({
              kind, id,
              object: hit.object === this.frontBoard ? 'cover' : (hit.object === this.leafFront || hit.object === this.leafBack) ? 'leaf' : 'page',
              depth: Number(depth.toFixed(4)),
              distance: Number(hit.distance.toFixed(4))
            });
          }
        }
      }
    }
    return problems;
  }

  _frameCamera() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    const focus = this.drag.focus === undefined ? 1 : this.drag.focus;
    const cx = this.pageW * 0.5 * (1 - focus);            // a closed book is framed on its own half only
    const half = 0.46 + 0.52 * focus;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const rH = half / (Math.tan(vFov / 2) * this.camera.aspect);
    const rV = 0.78 / Math.tan(vFov / 2);
    const r = Math.max(rH, rV) * 1.05 * this.drag.zoom;
    const phi = this.drag.pitch, theta = this.drag.yaw;
    this.camera.position.set(
      cx + r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.cos(theta)
    );
    this._target.set(cx, 0.02, 0);
    this.camera.lookAt(this._target);
    void w; void h;
  }

  _loop() {
    if (this._disposed) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.2);
    this._update(dt);
    if (this.spineCap) this.spineCap.visible = Math.abs(this.hinge.rotation.z) > 0.03;
    this._frameCamera();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._frameCamera();
  }

  bindDrag(el) {
    // Grab-the-object: the point under the pointer follows the pointer. Inverse of a camera-slide.
    const down = e => {
      this.drag.active = true; this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved = 0;
      try { el.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    };
    const move = e => {
      if (!this.drag.active) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.drag.yaw = Math.max(-ORBIT_YAW, Math.min(ORBIT_YAW, this.drag.yaw - dx * 0.005));
      this.drag.pitch = Math.max(ORBIT_PITCH_MIN, Math.min(ORBIT_PITCH_MAX, this.drag.pitch - dy * 0.004));
    };
    const up = e => {
      this.drag.active = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.drag.zoom = Math.max(ORBIT_ZOOM_MIN, Math.min(ORBIT_ZOOM_MAX, this.drag.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
    this._unbindDrag = () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }

  dispose() {
    this._disposed = true;
    this._unbindDrag && this._unbindDrag();
    this.renderer.dispose();
  }
}
