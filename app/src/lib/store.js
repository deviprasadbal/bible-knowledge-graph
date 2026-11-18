// Personal, per-device state (bookmarks, highlights, notes, reading progress, settings).
// Kept in localStorage only; nothing leaves the reader's browser.
import { useSyncExternalStore } from 'react';

const KEY = 'lamplight.v1';
const defaults = {
  settings: { translation: 'bsb', parallel: false, fontScale: 1, theme: 'auto', bridges: true, redLetter: false },
  bookmarks: {}, // ref -> timestamp
  highlights: {}, // ref -> color
  notes: {}, // ref -> {text, t}
  read: {}, // "Gen.1" -> timestamp
  journeys: {}, // journeyId -> {stepIndex: true}
  journal: [], // [{id, t, text, prompt}]
  recent: [], // last visited chapters
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    const s = JSON.parse(raw);
    return { ...structuredClone(defaults), ...s, settings: { ...defaults.settings, ...(s.settings || {}) } };
  } catch {
    return structuredClone(defaults);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota: keep in memory */
  }
}

export function update(fn) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  save();
  listeners.forEach((l) => l());
}

export const getState = () => state;
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const setSetting = (k, v) => update((s) => { s.settings[k] = v; });
export const toggleBookmark = (ref) => update((s) => {
  if (s.bookmarks[ref]) delete s.bookmarks[ref]; else s.bookmarks[ref] = Date.now();
});
export const setHighlight = (ref, color) => update((s) => {
  if (!color || s.highlights[ref] === color) delete s.highlights[ref]; else s.highlights[ref] = color;
});
export const setNote = (ref, text) => update((s) => {
  if (!text?.trim()) delete s.notes[ref]; else s.notes[ref] = { text, t: Date.now() };
});
export const markRead = (chapterKey) => update((s) => {
  s.read[chapterKey] = Date.now();
  s.recent = [chapterKey, ...s.recent.filter((r) => r !== chapterKey)].slice(0, 8);
});
export const unmarkRead = (chapterKey) => update((s) => { delete s.read[chapterKey]; });
export const toggleJourneyStep = (jid, i) => update((s) => {
  s.journeys[jid] = s.journeys[jid] || {};
  if (s.journeys[jid][i]) delete s.journeys[jid][i]; else s.journeys[jid][i] = true;
});
export const addJournal = (text, prompt) => update((s) => {
  s.journal.unshift({ id: Date.now().toString(36), t: Date.now(), text, prompt });
});
export const deleteJournal = (id) => update((s) => { s.journal = s.journal.filter((j) => j.id !== id); });

export function exportState() {
  return JSON.stringify(state, null, 2);
}
export function importState(json) {
  const s = JSON.parse(json);
  update((d) => Object.assign(d, s));
}
