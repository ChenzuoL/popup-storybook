// app.js — reading UI, theme, navigation, narration, bookmarks and failure surface around the book.
import { PopupBook } from './book3d.js';
import { PaperAudio } from './audio.js';
import { configureStore, loadBookmark, saveBookmark } from './store.js';

const $ = sel => document.querySelector(sel);
const audio = new PaperAudio();

// ---------------------------------------------------------------- theme

const FONTS = {
  song: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif',
  kai: '"LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif',
  hei: '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fangsong: '"FangSong", "STFangsong", "Noto Serif SC", serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
  'latin-serif': '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Noto Serif SC", serif',
  'latin-display': '"Didot", "Bodoni 72", "Playfair Display", Georgia, "Noto Serif SC", serif',
  typewriter: '"American Typewriter", "Courier Prime", "Courier New", "Noto Serif SC", monospace',
  rounded: '"Nunito", "Varela Round", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Noto Sans SC", sans-serif'
};
const LABELS = {
  zh: { open: '\u7ffb\u5f00', resume: '\u4ece\u4e0a\u6b21\u90a3\u9875\u7ffb\u5f00', binding: '\u88c5\u8ba2\u4e2d', ready: '\u53ef\u4ee5\u7ffb\u5f00\u4e86', closed: '\u4e66\u5df2\u5408\u4e0a', index: '\u76ee\u5f55', indexClose: '\u6536\u8d77', reset: '\u56de\u5230\u7b2c\u4e00\u8de8\u9875', sound: '\u7eb8\u58f0', close: '\u5408\u4e0a', narrate: '\u6717\u8bfb', pause: '\u6682\u505c', reader: '\u6b63\u6587', browserVoice: '\u6d4f\u89c8\u5668\u6717\u8bfb\uff08\u8fd9\u4e00\u9875\u6ca1\u6709\u914d\u97f3\u6587\u4ef6\uff09', chapter: n => `\u7b2c${'\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341'[n] || n + 1}\u7ae0`, spreads: (c, s) => `${c} \u7ae0 \u00b7 ${s} \u8de8\u9875`, prev: '\u4e0a\u4e00\u8de8\u9875', next: '\u4e0b\u4e00\u8de8\u9875', fail: '\u8fd9\u4e00\u9875\u51fa\u4e86\u70b9\u95ee\u9898\uff0c\u5237\u65b0\u540e\u53ef\u4ee5\u7ee7\u7eed\u9605\u8bfb\u3002', failLoad: '\u4e66\u7a3f\u6ca1\u6709\u52a0\u8f7d\u6210\u529f\u3002', failBind: '\u7eb8\u672c\u4e66\u6ca1\u80fd\u88c5\u8ba2\u5b8c\u6210\uff0c\u5237\u65b0\u540e\u518d\u8bd5\u3002' },
  en: { open: 'Open the book', resume: 'Open where you left off', binding: 'Binding', ready: 'Ready to open', closed: 'The book is closed', index: 'Contents', indexClose: 'Hide', reset: 'Back to the first spread', sound: 'Paper sound', close: 'Close', narrate: 'Read aloud', pause: 'Pause', reader: 'Text', browserVoice: 'Browser voice (no recording for this page)', chapter: n => `Chapter ${n + 1}`, spreads: (c, s) => `${c} chapters · ${s} spreads`, prev: 'Previous spread', next: 'Next spread', fail: 'Something went wrong on this page — reload to keep reading.', failLoad: 'The manuscript did not load.', failBind: 'The book could not be bound — reload to try again.' },
  ja: { open: '\u672c\u3092\u3072\u3089\u304f', resume: '\u7d9a\u304d\u304b\u3089\u3072\u3089\u304f', binding: '\u88fd\u672c\u4e2d', ready: '\u3072\u3089\u3051\u307e\u3059', closed: '\u672c\u3092\u9589\u3058\u307e\u3057\u305f', index: '\u76ee\u6b21', indexClose: '\u9589\u3058\u308b', reset: '\u6700\u521d\u306e\u898b\u958b\u304d\u3078', sound: '\u7d19\u306e\u97f3', close: '\u9589\u3058\u308b', narrate: '\u6717\u8aad', pause: '\u4e00\u6642\u505c\u6b62', reader: '\u672c\u6587', browserVoice: '\u30d6\u30e9\u30a6\u30b6\u97f3\u58f0\uff08\u3053\u306e\u30da\u30fc\u30b8\u306e\u9332\u97f3\u306f\u3042\u308a\u307e\u305b\u3093\uff09', chapter: n => `\u7b2c${n + 1}\u7ae0`, spreads: (c, s) => `${c}\u7ae0\u30fb${s}\u898b\u958b\u304d`, prev: '\u524d\u306e\u898b\u958b\u304d', next: '\u6b21\u306e\u898b\u958b\u304d', fail: '\u3053\u306e\u30da\u30fc\u30b8\u3067\u554f\u984c\u304c\u8d77\u304d\u307e\u3057\u305f\u3002\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002', failLoad: '\u539f\u7a3f\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002', failBind: '\u88fd\u672c\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002' }
};

function applyTheme(book) {
  const t = book.theme || {};
  const p = t.palette || {};
  const root = document.documentElement.style;
  const set = (k, v) => v && root.setProperty(k, v);
  set('--paper', p.paper); set('--paper-deep', p.paperDeep); set('--ink', p.ink); set('--ink-soft', p.inkSoft);
  set('--accent', p.accent); set('--cloth', p.cloth); set('--stage', t.book?.background || p.paperDeep);
  const ty = t.typography || {};
  set('--font-display', FONTS[ty.display] || ty.display);
  set('--font-body', FONTS[ty.body] || ty.body);
  if (typeof ty.fontCss === 'string' && /^https:\/\//.test(ty.fontCss)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = ty.fontCss;
    document.head.append(link);
  }
  const app = $('#app');
  app.dataset.chrome = ['sidebar', 'footer', 'margin'].includes(t.chrome) ? t.chrome : 'sidebar';
  app.dataset.side = t.readerSide === 'left' ? 'left' : 'right';
  app.dataset.surface = t.surface || 'grain';
  app.dataset.shape = t.shape || 'soft';
  app.dataset.bar = t.bar || 'floating';
  document.documentElement.lang = book.language === 'en' ? 'en' : book.language === 'ja' ? 'ja' : 'zh-CN';
}

// ---------------------------------------------------------------- state

const dom = {
  app: $('#app'), canvas: $('#view'), gateBtn: $('#gate-open'), gateNote: $('#gate-note'),
  kicker: $('#bar-kicker'), heading: $('#bar-heading'), counter: $('#hud-counter'),
  passages: $('#passages'), readerTitle: $('#reader-spread'), readerKicker: $('#reader-kicker'), readerFoot: $('#reader-foot'),
  prev: $('#nav-prev'), next: $('#nav-next'), dots: $('#nav-dots'),
  index: $('#index'), indexList: $('#index-list'), indexBtn: $('#btn-index'), indexClose: $('#index-close'), indexTitle: $('#index-title'),
  sound: $('#btn-sound'), reset: $('#btn-reset'), close: $('#btn-close'), narrate: $('#btn-narrate'), banner: $('#banner')
};

let book = null;
let data = null;
let L = LABELS.zh;
let turning = false;
let bookmark = null;

function fail(message) { dom.banner.textContent = message; dom.banner.hidden = false; }

function chapterIndex(id) { return data.chapters.findIndex(c => c.id === id); }

function renderReader(state) {
  const ci = chapterIndex(state.chapterId);
  dom.kicker.textContent = `${L.chapter(ci)} · ${state.chapterTitle}`;
  dom.heading.textContent = state.title;
  dom.counter.textContent = `${state.index + 1} / ${state.count}`;
  dom.readerKicker.textContent = `${L.chapter(ci)} · ${state.chapterTitle}`;
  dom.readerTitle.textContent = state.title;
  dom.passages.replaceChildren(...state.passages.map(p => {
    const li = document.createElement('li');
    li.className = 'passage';
    li.dataset.passage = p.id;
    if (p.speaker) {
      const who = document.createElement('span');
      who.className = 'speaker';
      who.textContent = p.speaker;
      li.append(who);
    }
    const body = document.createElement('p');
    body.textContent = p.text;
    li.append(body);
    return li;
  }));
  [...dom.dots.children].forEach((dot, i) => dot.classList.toggle('on', data.chapters[i].id === state.chapterId));
  dom.prev.disabled = state.index === 0 || turning;
  dom.next.disabled = state.index === state.count - 1 || turning;
}

function renderClosed(note) {
  dom.app.dataset.state = 'closed';
  dom.kicker.textContent = data.subtitle || L.spreads(data.chapters.length, data.spreadOrder.length);
  dom.heading.textContent = data.title || '';
  if (note) dom.gateNote.textContent = note;
  const resume = bookmark && data.spreadOrder.includes(bookmark.spreadId) && bookmark.spreadId !== data.spreadOrder[0];
  dom.gateBtn.textContent = resume ? L.resume : L.open;
}

function persist() {
  saveBookmark({ spreadId: book.current().spreadId, spreadOrder: data.spreadOrder, muted: !audio.enabled });
  bookmark = loadBookmark();
}

function step(dir) {
  if (!book || turning) return;
  narrator.stop();
  if (book.turn(dir)) { audio.turn(); turning = true; dom.prev.disabled = dom.next.disabled = true; }
}

// ---------------------------------------------------------------- narration

const narrator = {
  mode: 'none', playing: false, index: 0, el: null, utter: null, timer: null,
  init() {
    const n = data.narration || {};
    const hasFiles = data.spreads.some(s => s.passages.some(p => p.audio));
    this.mode = n.mode === 'browser' && 'speechSynthesis' in window ? 'browser' : (n.mode === 'files' || (!n.mode && hasFiles)) ? 'files' : 'none';
    this.autoTurn = n.autoTurn !== false;
    this.rate = Number(n.rate) || 1;
    dom.narrate.hidden = this.mode === 'none';
    dom.narrate.textContent = L.narrate;
    dom.readerFoot.textContent = this.mode === 'browser' ? (n.label || L.browserVoice) : (data.adaptation || '');
  },
  passages() { return book.current().passages; },
  highlight() {
    [...dom.passages.children].forEach((li, i) => li.classList.toggle('playing', this.playing && i === this.index));
    const on = dom.passages.children[this.index];
    if (this.playing && on) on.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  toggle() { this.playing ? this.stop() : this.play(0); },
  play(i) {
    const list = this.passages();
    if (i >= list.length) { this.finish(); return; }
    this.playing = true; this.index = i; this.highlight();
    dom.narrate.textContent = L.pause;
    const p = list[i];
    const next = () => { if (this.playing) this.timer = setTimeout(() => this.play(i + 1), 450); };
    if (this.mode === 'files' && p.audio) {
      this.el = new Audio(p.audio);
      this.el.playbackRate = this.rate;
      this.el.addEventListener('ended', next, { once: true });
      this.el.addEventListener('error', () => { this.stop(); fail(`${p.id}: audio failed — tap ${L.narrate} to retry.`); }, { once: true });
      this.el.play().catch(() => this.stop());
    } else if (this.mode === 'browser') {
      this.utter = new SpeechSynthesisUtterance(p.text);
      this.utter.lang = document.documentElement.lang;
      this.utter.rate = this.rate;
      this.utter.onend = next;
      speechSynthesis.speak(this.utter);
    } else next();
  },
  finish() {
    const auto = this.autoTurn && book.current().index < book.current().count - 1;
    this.stop();
    if (auto) this.timer = setTimeout(() => { if (book.turn(1)) { audio.turn(); turning = true; this.resumeAfterTurn = true; } }, 900);
  },
  stop() {
    this.playing = false;
    clearTimeout(this.timer);
    if (this.el) { this.el.pause(); this.el = null; }
    if (this.mode === 'browser' && 'speechSynthesis' in window) speechSynthesis.cancel();
    dom.narrate.textContent = L.narrate;
    this.highlight();
  }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) narrator.stop(); });

// ---------------------------------------------------------------- index

function buildIndex() {
  const entries = book.spreads.map((spread, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'index-item';
    const thumb = document.createElement('span');
    thumb.className = 'index-thumb';
    const src = spread.thumbnail || spread.compositionBoard?.file || assetFile(spread.focalSubject);
    if (src) thumb.style.backgroundImage = `url("${src}")`;
    const meta = document.createElement('span');
    meta.className = 'index-meta';
    const t = document.createElement('strong');
    t.textContent = spread.title;
    const s = document.createElement('em');
    s.textContent = `${i + 1} / ${book.spreads.length}`;
    meta.append(t, s);
    item.append(thumb, meta);
    item.addEventListener('click', () => {
      narrator.stop();
      if (book.state.phase === 'closed') { begin(i); return; }
      if (!book.goTo(spread.id) && book.current().spreadId !== spread.id) return;
      audio.blip(); persist(); renderReader(book.current()); closeIndex();
    });
    return item;
  });
  const sections = data.chapters.flatMap((chapter, index) => {
    const heading = document.createElement('h2');
    heading.className = 'index-chapter';
    heading.textContent = `${L.chapter(index)} · ${chapter.title}`;
    return [heading, ...entries.filter((_, i) => book.spreads[i].chapterId === chapter.id)];
  });
  dom.indexList.replaceChildren(...sections);
}

function assetFile(assetId) { const a = data.assets.find(x => x.id === assetId); return a ? a.file : ''; }
function openIndex() { dom.index.hidden = false; dom.indexBtn.setAttribute('aria-expanded', 'true'); }
function closeIndex() { dom.index.hidden = true; dom.indexBtn.setAttribute('aria-expanded', 'false'); }

function buildDots() {
  dom.dots.replaceChildren(...data.chapters.map(chapter => {
    const d = document.createElement('span');
    d.className = 'dot';
    d.title = chapter.title;
    return d;
  }));
}

// ---------------------------------------------------------------- wiring

function bind() {
  dom.prev.addEventListener('click', () => step(-1));
  dom.next.addEventListener('click', () => step(1));
  dom.indexBtn.addEventListener('click', () => (dom.index.hidden ? openIndex() : closeIndex()));
  dom.indexClose.addEventListener('click', closeIndex);
  dom.narrate.addEventListener('click', () => { audio.unlock(); narrator.toggle(); });
  dom.close.addEventListener('click', () => { narrator.stop(); closeIndex(); if (book.close()) { persist(); dom.app.dataset.state = 'closing'; } });
  dom.sound.addEventListener('click', () => {
    audio.unlock();
    audio.enabled = !audio.enabled;
    dom.sound.setAttribute('aria-pressed', String(audio.enabled));
    dom.sound.classList.toggle('off', !audio.enabled);
    if (audio.enabled) audio.blip();
    persist();
  });
  dom.reset.addEventListener('click', () => {
    narrator.stop();
    book.goTo(data.spreadOrder[0]);
    renderReader(book.current());
    audio.blip(); persist(); closeIndex();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { step(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
    else if (e.key === 'Escape') closeIndex();
  });
  window.addEventListener('error', () => fail(L.fail));
  window.addEventListener('resize', () => book && book.resize());
  new ResizeObserver(() => book && book.resize()).observe(dom.canvas);
}

function begin(explicit) {
  audio.unlock();
  closeIndex();
  const target = Number.isInteger(explicit) ? explicit
    : bookmark && data.spreadOrder.includes(bookmark.spreadId) ? data.spreadOrder.indexOf(bookmark.spreadId) : book.state.index;
  if (book.open(target)) dom.app.dataset.state = 'opening';
}

async function main() {
  try { data = await (await fetch('data/book.json')).json(); }
  catch { fail(LABELS.zh.failLoad); return; }
  L = { ...(LABELS[data.language] || LABELS.zh), ...(data.theme?.labels || {}) };
  applyTheme(data);
  configureStore(data.bookmarks?.storageKey || `paper-storybook:${location.pathname}`);
  bookmark = loadBookmark();
  document.title = data.title || 'Pop-up book';
  for (const [el, key] of [[dom.indexBtn, 'index'], [dom.indexTitle, 'index'], [dom.indexClose, 'indexClose'], [dom.reset, 'reset'], [dom.sound, 'sound'], [dom.close, 'close']]) el.textContent = L[key];
  dom.prev.setAttribute('aria-label', L.prev); dom.next.setAttribute('aria-label', L.next);
  book = new PopupBook(dom.canvas, data, {
    onStart: kind => { if (kind === 'open') audio.open(); if (kind === 'turn') audio.fold(); if (kind === 'close') audio.open(); },
    onSettled: state => {
      turning = false;
      dom.app.dataset.state = 'open';
      renderReader(state);
      persist();
      if (narrator.resumeAfterTurn) { narrator.resumeAfterTurn = false; setTimeout(() => narrator.play(0), 600); }
    },
    onClosed: () => { renderClosed(L.closed); }
  });
  audio.enabled = !bookmark?.muted;
  dom.sound.setAttribute('aria-pressed', String(audio.enabled));
  dom.sound.classList.toggle('off', !audio.enabled);
  book.bindDrag(dom.canvas);
  renderClosed(`${L.binding}…`);
  try {
    await book.load((done, total) => {
      dom.gateNote.textContent = done < total ? `${L.binding} ${done}/${total}` : L.ready;
      if (done === total) dom.gateBtn.disabled = false;
    });
  } catch { fail(L.failBind); return; }
  if (bookmark && data.spreadOrder.includes(bookmark.spreadId)) book.goTo(bookmark.spreadId);
  renderClosed(L.ready);
  buildDots();
  buildIndex();
  narrator.init();
  dom.gateBtn.addEventListener('click', () => begin());
  bind();

  // read-only hooks used by the project's own QA script
  window.__neta = {
    get state() { return book.current(); },
    get phase() { return book.state.phase; },
    get failedAssets() { return book.failedAssets || []; },
    get leafSample() { return book.leafSample(); },
    get standeeStates() { return book.standeeStates(); },
    depthAudit(minGap) { return book.depthAudit(minGap); },
    attachmentSnapshot() { return book.attachmentSnapshot(); },
    pageSurfaceAudit() { return book.pageSurfaceAudit(); },
    mechanismAudit() { return book.mechanismAudit(); },
    get collisions() { return book.collisions(); },
    get spreadCount() { return book.spreads.length; },
    get spreadIds() { return book.spreads.map(s => s.id); },
    settled() { return book.settled(); },
    open(i) { begin(Number.isInteger(i) ? i : undefined); return book.state.phase; },
    close() { return book.close(); },
    seekOpen(u) { return book.seekOpen(u); },
    seekTurn(u) { return book.seekTurn(u); },
    seekClose(u) { return book.seekClose(u); },
    orbit(yaw, pitch, zoom) { if (yaw != null) book.drag.yaw = yaw; if (pitch != null) book.drag.pitch = pitch; if (zoom != null) book.drag.zoom = zoom; },
    goTo(id) { const ok = book.goTo(id); renderReader(book.current()); return ok; },
    set timeScale(v) { book.timeScale = v; }
  };
  qaFromHash();
}

// QA entry for headless screenshots:
// #qa=open&spread=2&yaw=0.6&pitch=1.1&zoom=1&fast=1&turn=0.5
// #qa=open&spread=0&opening=0.52  (freeze the cover-opening mechanism)
// #qa=open&spread=0&fast=1&reclose=1  (open, close again, ready when back in the closed state)
// (scripts/shoot.mjs). Readers never see it; it only runs when the hash asks for it.
function qaFromHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.has('qa')) return;
  const n = k => (q.has(k) ? Number(q.get(k)) : null);
  const openingAt = n('opening');
  if (openingAt != null) book.timeScale = 0;
  else if (q.has('fast')) book.timeScale = 40;
  window.__neta.orbit(n('yaw'), n('pitch'), n('zoom'));
  if (q.get('qa') !== 'open') return;
  const spread = n('spread');
  begin(Number.isInteger(spread) ? spread : 0);
  if (openingAt != null) {
    setTimeout(() => {
      book.seekOpen(openingAt);
      document.body.dataset.qa = 'ready';
    }, 120);
    return;
  }
  const closingAt = n('closing');
  if (closingAt != null) {
    // open fully, press close, freeze the close at closingAt
    const waitOpen = () => (book.settled() ? (book.close(), book.timeScale = 0, book.seekClose(closingAt), document.body.dataset.qa = 'ready') : setTimeout(waitOpen, 50));
    book.timeScale = 40;
    waitOpen();
    return;
  }
  if (q.has('reclose')) {
    // open fully, press close, and report ready once the book is back in its closed state
    const waitOpen = () => (book.settled() ? (book.close(), waitClosed()) : setTimeout(waitOpen, 50));
    const waitClosed = () => (book.state.phase === 'closed' ? setTimeout(() => { document.body.dataset.qa = 'ready'; }, 300) : setTimeout(waitClosed, 50));
    waitOpen();
    return;
  }
  const turnAt = n('turn');
  if (turnAt != null) {
    const wait = () => (book.settled() ? (step(q.get('dir') === 'back' ? -1 : 1), book.timeScale = 0, book.seekTurn(turnAt), document.body.dataset.qa = 'ready') : setTimeout(wait, 50));
    wait();
  } else {
    const wait = () => (book.settled() ? setTimeout(() => { document.body.dataset.qa = 'ready'; }, 400) : setTimeout(wait, 50));
    wait();
  }
}

main();
