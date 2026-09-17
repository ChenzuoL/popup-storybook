// app.js — reading UI, navigation, bookmarks and failure surface around the paper book.
import { PopupBook } from './book3d.js';
import { PaperAudio } from './audio.js';
import { configureStore, loadBookmark, saveBookmark } from './store.js';

const $ = sel => document.querySelector(sel);
const audio = new PaperAudio();

const dom = {
  canvas: $('#view'),
  gate: $('#gate'),
  gateBtn: $('#gate-open'),
  gateNote: $('#gate-note'),
  gateTitle: $('#gate-title'),
  chapter: $('#hud-chapter'),
  spread: $('#hud-spread'),
  counter: $('#hud-counter'),
  passages: $('#passages'),
  readerTitle: $('#reader-spread'),
  prev: $('#nav-prev'),
  next: $('#nav-next'),
  dots: $('#nav-dots'),
  index: $('#index'),
  indexList: $('#index-list'),
  indexBtn: $('#btn-index'),
  indexClose: $('#index-close'),
  sound: $('#btn-sound'),
  reset: $('#btn-reset'),
  banner: $('#banner')
};

let book = null;
let data = null;
let turning = false;
let pending = null;
let bookmark = null;

function fail(message) {
  dom.banner.textContent = message;
  dom.banner.hidden = false;
}

function chapterOf(spread) {
  const c = data.chapters.find(ch => ch.id === spread.chapterId);
  return c ? c.title : '';
}

function renderReader(state) {
  const chapterIndex = data.chapters.findIndex(c => c.id === state.chapterId);
  const chapterSpreads = data.spreads.filter(s => s.chapterId === state.chapterId);
  const chapterLabel = `第${['一','二','三','四','五','六','七','八'][chapterIndex] || chapterIndex + 1}章`;
  dom.chapter.textContent = `${chapterLabel} · ${state.chapterTitle}`;
  dom.spread.textContent = state.title;
  dom.counter.textContent = `${state.index + 1} / ${state.count}`;
  dom.readerTitle.textContent = state.title;
  dom.passages.replaceChildren(...state.passages.map(p => {
    const li = document.createElement('li');
    li.className = 'passage';
    const who = document.createElement('span');
    who.className = 'speaker';
    who.textContent = p.speaker;
    const body = document.createElement('p');
    body.textContent = p.text;
    li.append(who, body);
    return li;
  }));
  [...dom.dots.children].forEach((dot, i) => dot.classList.toggle('on', data.chapters[i].id === state.chapterId));
  dom.readerTitle.title = `${chapterLabel} · ${chapterSpreads.findIndex(s => s.id === state.spreadId) + 1} / ${chapterSpreads.length}`;
  dom.prev.disabled = state.index === 0 || turning;
  dom.next.disabled = state.index === state.count - 1 || turning;
}

function persist() {
  saveBookmark({ spreadId: book.current().spreadId, spreadOrder: data.spreadOrder, muted: !audio.enabled });
}

function step(dir) {
  if (!book || turning) return;
  const ok = book.turn(dir);
  if (ok) { audio.turn(); turning = true; }
}

function buildIndex() {
  const entries = book.spreads.map((spread, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'index-item';
    const thumb = document.createElement('span');
    thumb.className = 'index-thumb';
    thumb.style.backgroundImage = `url("${spread.thumbnail || assetFile(spread.focalSubject)}")`;
    const meta = document.createElement('span');
    meta.className = 'index-meta';
    const t = document.createElement('strong');
    t.textContent = spread.title;
    const s = document.createElement('em');
    s.textContent = `${chapterOf(spread)} · ${i + 1} / ${book.spreads.length}`;
    meta.append(t, s);
    item.append(thumb, meta);
    item.addEventListener('click', () => {
      if (!book.goTo(spread.id) && book.current().spreadId !== spread.id) return;
      audio.blip();
      persist();
      renderReader(book.current());
      closeIndex();
    });
    return item;
  });
  const sections = data.chapters.flatMap((chapter, index) => {
    const heading = document.createElement('h2');
    heading.className = 'index-chapter';
    heading.textContent = `第${'一二三四五六七八九十'[index] || index + 1}章 · ${chapter.title}`;
    return [heading, ...entries.filter((_, i) => book.spreads[i].chapterId === chapter.id)];
  });
  dom.indexList.replaceChildren(...sections);
}

function assetFile(assetId) {
  const a = data.assets.find(x => x.id === assetId);
  return a ? a.file : '';
}

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

function bind() {
  dom.prev.addEventListener('click', () => step(-1));
  dom.next.addEventListener('click', () => step(1));
  dom.indexBtn.addEventListener('click', () => (dom.index.hidden ? openIndex() : closeIndex()));
  dom.indexClose.addEventListener('click', closeIndex);
  dom.sound.addEventListener('click', () => {
    audio.unlock();
    audio.enabled = !audio.enabled;
    dom.sound.textContent = audio.enabled ? '纸声 开' : '纸声 关';
    dom.sound.setAttribute('aria-pressed', String(audio.enabled));
    if (audio.enabled) audio.blip();
    persist();
  });
  dom.reset.addEventListener('click', () => {
    book.goTo(data.spreadOrder[0]);
    renderReader(book.current());
    audio.blip();
    persist();
    closeIndex();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { step(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
    else if (e.key === 'Escape') closeIndex();
  });
  window.addEventListener('error', () => fail('这一页出了点问题，刷新后可以继续阅读。'));
  window.addEventListener('resize', () => book && book.resize());
}

function begin() {
  audio.unlock();
  dom.gate.classList.add('gone');
  const target = bookmark && data.spreadOrder.includes(bookmark.spreadId) ? bookmark.spreadId : null;
  pending = target && target !== data.spreadOrder[0] ? target : null;
  book.open();
}

async function main() {
  try {
    data = await (await fetch('data/book.json')).json();
  } catch {
    fail('书稿没有加载成功。');
    return;
  }
  configureStore(data.bookmarks?.storageKey || `paper-storybook:${location.pathname}`);
  bookmark = loadBookmark();
  document.title = data.title || "Paper Storybook";
  book = new PopupBook(dom.canvas, data, {
    onStart: kind => { if (kind === 'open') audio.open(); if (kind === 'turn') audio.fold(); },
    onSettled: state => {
      turning = false;
      renderReader(state);
      persist();
      if (pending) {
        const target = pending;
        pending = null;
        setTimeout(() => { book.goTo(target); renderReader(book.current()); }, 380);
      }
    }
  });
  audio.enabled = !bookmark?.muted;
  dom.sound.textContent = audio.enabled ? '纸声 开' : '纸声 关';
  dom.sound.setAttribute('aria-pressed', String(audio.enabled));
  book.bindDrag(dom.canvas);
  dom.gateBtn.disabled = true;
  dom.gateTitle.textContent = data.title || '纸艺立体书';

  const sub = document.querySelector('[data-book-sub]');
  if (sub) sub.textContent = data.language === 'zh' ? '纸艺 · 立体书' : 'paper storybook';
  document.querySelector('.gate-sub').textContent = `${data.chapters.length} 章 · ${data.spreadOrder.length} 跨页`;

  try {
    await book.load((done, total) => {
      dom.gateNote.textContent = done < total ? `装订中 ${done}/${total}` : '可以翻开了';
      if (done === total) dom.gateBtn.disabled = false;
    });
  } catch {
    fail('纸本书没能装订完成，刷新后再试。');
    return;
  }
  if (bookmark && data.spreadOrder.includes(bookmark.spreadId)) {
    dom.gateNote.textContent = '上次翻到的地方已经记下';
  }
  buildDots();
  buildIndex();
  renderReader(book.current());
  dom.gateBtn.addEventListener('click', begin);
  bind();

  // read-only hooks used by the project's own QA script
  window.__neta = {
    get state() { return book.current(); },
    get phase() { return book.state.phase; },
    get failedAssets() { return book.failedAssets || []; },
    get leafSample() { return book.leafSample(); },
    get standeeStates() { return book.standeeStates(); },
    attachmentSnapshot() { return book.attachmentSnapshot(); },
    pageSurfaceAudit() { return book.pageSurfaceAudit(); },
    get collisions() { return book.collisions(); },
    get spreadCount() { return book.spreads.length; },
    get spreadIds() { return book.spreads.map(s => s.id); },
    seekTurn(u) { return book.seekTurn(u); },
    goTo(id) { const ok = book.goTo(id); renderReader(book.current()); return ok; },
    set timeScale(v) { book.timeScale = v; }
  };
}

main();
