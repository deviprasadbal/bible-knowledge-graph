// Data layer: cached fetches of the static JSON produced by pipeline/build_graph.py
const BASE = import.meta.env.BASE_URL + 'data/';
const cache = new Map();

export function fetchJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${r.status} loading ${path}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

export const OSIS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');

let BOOKS = null; // filled by loadCore()
export const books = () => BOOKS || [];
export const bookByOsis = (o) => (BOOKS || []).find((b) => b.osis === o);

export async function loadCore() {
  BOOKS = await fetchJSON('books.json');
  return BOOKS;
}

const letter = (id) => {
  const c = (id || '_')[0].toLowerCase();
  return /[a-z]/.test(c) ? c : '_';
};
export const getPerson = async (id) => (await fetchJSON(`people/${letter(id)}.json`))[id];
export const getPlace = async (id) => (await fetchJSON(`places/${letter(id)}.json`))[id];
export const getDictEntry = async (id) => (await fetchJSON(`dictionary/${letter(id)}.json`))[id];
export const getChapter = async (tr, osis, ch) => (await fetchJSON(`bible/${tr}/${osis}.json`))[ch - 1] || [];

// ---------- references ----------
const REF = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/;
export function parseRef(ref) {
  const [a, z] = String(ref).split('-');
  const m = REF.exec(a);
  if (!m) return null;
  const start = { b: m[1], c: +m[2], v: m[3] ? +m[3] : null };
  let end = null;
  if (z) {
    const n = REF.exec(z);
    if (n) end = { b: n[1], c: +n[2], v: n[3] ? +n[3] : null };
  }
  return { start, end };
}

export function formatRef(ref, short = false) {
  const p = parseRef(ref);
  if (!p) return ref;
  const bk = bookByOsis(p.start.b);
  const name = bk ? (short ? shortName(bk.name) : bk.name) : p.start.b;
  let s = `${name} ${p.start.c}${p.start.v ? ':' + p.start.v : ''}`;
  if (p.end) {
    if (p.end.b !== p.start.b) s += `–${formatRef(`${p.end.b}.${p.end.c}${p.end.v ? '.' + p.end.v : ''}`, short)}`;
    else if (p.end.c !== p.start.c) s += `–${p.end.c}${p.end.v ? ':' + p.end.v : ''}`;
    else if (p.end.v && p.end.v !== p.start.v) s += `–${p.end.v}`;
  }
  return s;
}
const shortName = (n) => n.replace('Song of Solomon', 'Song').replace('Lamentations', 'Lam').replace('Ecclesiastes', 'Eccl');

export function refLink(ref) {
  const p = parseRef(ref);
  if (!p) return '/read';
  return `/read/${p.start.b}/${p.start.c}${p.start.v ? `?v=${p.start.v}${p.end && p.end.c === p.start.c && p.end.v ? '-' + p.end.v : ''}` : ''}`;
}

/** Load text for a reference: returns [{ref, c, v, text}] (max verses). */
export async function refVerses(ref, tr = 'bsb', max = 40) {
  const p = parseRef(ref);
  if (!p) return [];
  const { start, end } = p;
  const book = await fetchJSON(`bible/${tr}/${start.b}.json`);
  const out = [];
  const endC = end && end.b === start.b ? end.c : start.c;
  for (let c = start.c; c <= endC; c++) {
    const vs = book[c - 1] || [];
    for (let i = 0; i < vs.length; i++) {
      const v = i + 1;
      if (c === start.c && start.v && v < start.v) continue;
      if (!end && start.v && v > start.v) break;
      if (end && c === endC && end.v && v > end.v) break;
      if (vs[i] == null) continue;
      out.push({ ref: `${start.b}.${c}.${v}`, c, v, text: vs[i] });
      if (out.length >= max) return out;
    }
  }
  return out;
}

// Strip markdown links and the KJV's _italic_ markers (words supplied by the translators).
export const stripMd = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/_([^_]+)_/g, '$1');

export const yearLabel = (y) => (y == null ? '' : y < 0 ? `${-y} BC` : `AD ${y}`);

export const TYPE_META = {
  P: { key: 'Person', label: 'People', color: 'var(--c-person)', path: '/people/' },
  L: { key: 'Place', label: 'Places', color: 'var(--c-place)', path: '/places/' },
  E: { key: 'Event', label: 'Events', color: 'var(--c-event)', path: '/timeline?e=' },
  B: { key: 'Book', label: 'Books', color: 'var(--c-book)', path: '/read/' },
  T: { key: 'Theme', label: 'Themes', color: 'var(--c-theme)', path: '/themes/' },
  C: { key: 'Creed', label: 'Creeds', color: 'var(--c-creed)', path: '/creeds/' },
  G: { key: 'Group', label: 'Groups', color: 'var(--c-group)', path: null },
};

export function nodePath(node) {
  const [kind, id] = node.id.split(/:(.+)/);
  switch (kind) {
    case 'person': return `/people/${id}`;
    case 'place': return `/places/${id}`;
    case 'event': return `/timeline?e=${id}`;
    case 'book': return `/read/${id}/1`;
    case 'theme': return `/themes/${id}`;
    case 'creed': return `/creeds/${id}`;
    default: return `/explore?focus=${encodeURIComponent(node.id)}`;
  }
}

// Theme categories (shared with content/themes.json)
export const THEME_CATEGORIES = [
  { id: 'big-questions', title: 'Big Questions', blurb: 'The questions every thoughtful person eventually asks, and how the Bible answers them.' },
  { id: 'core-beliefs', title: 'Core Beliefs', blurb: 'The central teachings Protestant Christians hold, drawn from Scripture.' },
  { id: 'five-solas', title: 'The Five Solas', blurb: 'The five "alones" that sum up the Protestant Reformation of the 1500s.' },
  { id: 'good-life', title: 'The Good Life', blurb: 'How Scripture shapes love, wisdom, justice, rest and daily work.' },
];
