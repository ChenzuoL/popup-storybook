// store.js — versioned, local-only bookmark/settings store. Corrupt or older shapes are migrated or dropped.
let KEY = 'paper-storybook/v1';
export function configureStore(key) { if (typeof key !== 'string' || !key.trim()) throw new Error('bookmarks.storageKey required'); KEY = key; }
const SCHEMA = 1;

export function loadBookmark() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    if (raw.schemaVersion === SCHEMA && typeof raw.spreadId === 'string') {
      return { spreadId: raw.spreadId, spreadOrder: Array.isArray(raw.spreadOrder) ? raw.spreadOrder : null, muted: !!raw.muted };
    }
    // earlier shapes: a bare spread id string, or {spread: id}
    const legacy = typeof raw === 'string' ? raw : (typeof raw.spread === 'string' ? raw.spread : null);
    return legacy ? { spreadId: legacy, spreadOrder: null, muted: false } : null;
  } catch { return null; }
}

export function saveBookmark({ spreadId, spreadOrder, muted }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: SCHEMA, spreadId, spreadOrder, muted: !!muted, savedAt: Date.now() }));
  } catch { /* storage unavailable: reading still works, nothing is promised */ }
}

export function clearBookmark() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
