// Global entity search (MiniSearch) + human reference parsing ("John 3:16", "1 cor 13").
import MiniSearch from 'minisearch';
import { books, fetchJSON, stripMd } from './data';

let indexPromise = null;

export function getIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const [people, places, themes, dict, creeds, events, journeys] = await Promise.all([
        fetchJSON('people.json'), fetchJSON('places.json'), fetchJSON('themes.json'), fetchJSON('dictionary/index.json'),
        fetchJSON('creeds/index.json'), fetchJSON('events.json'), fetchJSON('journeys.json'),
      ]);
      const docs = [];
      books().forEach((b) => docs.push({ id: `B:${b.osis}`, kind: 'Book', title: b.name, sub: b.oneLine || b.division, to: `/read/${b.osis}/1`, boost: 6 }));
      themes.forEach((t) => docs.push({ id: `T:${t.id}`, kind: 'Theme', title: t.title, sub: t.hook, to: `/themes/${t.id}`, boost: 5, extra: (t.bridge?.concept || '') }));
      journeys.forEach((j) => docs.push({ id: `J:${j.id}`, kind: 'Journey', title: j.title, sub: j.subtitle, to: `/journeys/${j.id}`, boost: 4 }));
      creeds.forEach((c) => docs.push({ id: `C:${c.id}`, kind: 'Creed', title: c.title, sub: `${c.format} · ${c.yearLabel || ''}`, to: `/creeds/${c.id}`, boost: 3 }));
      people.forEach((p) => docs.push({ id: `P:${p.id}`, kind: 'Person', title: p.l, sub: p.sub || `${p.vc} verses`, to: `/people/${p.id}`, boost: 1 + Math.log10(p.vc + 1) }));
      places.forEach((p) => docs.push({ id: `L:${p.id}`, kind: 'Place', title: p.l, sub: `${p.ft} · ${p.vc} verses`, to: `/places/${p.id}`, boost: 1 + Math.log10(p.vc + 1) * 0.8 }));
      events.forEach((e) => docs.push({ id: `E:${e.id}`, kind: 'Event', title: e.title, sub: e.year != null ? (e.year < 0 ? `${-e.year} BC` : `AD ${e.year}`) : '', to: `/timeline?e=${e.id}`, boost: 1.5 }));
      dict.forEach((d) => docs.push({ id: `D:${d.id}`, kind: 'Dictionary', title: d.l, sub: "Easton's Bible Dictionary", to: `/dictionary/${d.id}`, boost: 0.8 }));
      const ms = new MiniSearch({
        fields: ['title', 'sub', 'extra'],
        storeFields: ['kind', 'title', 'sub', 'to', 'boost'],
        searchOptions: { boost: { title: 4 }, prefix: true, fuzzy: 0.15 },
      });
      ms.addAll(docs);
      return ms;
    })();
  }
  return indexPromise;
}

export async function searchAll(q, limit = 30) {
  const ms = await getIndex();
  return ms
    .search(q, { boostDocument: (id, term, stored) => stored?.boost || 1 })
    .slice(0, limit);
}

const ALIASES = {
  psalm: 'Ps', psalms: 'Ps', ps: 'Ps', song: 'Song', 'song of songs': 'Song', 'song of solomon': 'Song', jn: 'John',
  mt: 'Matt', mk: 'Mark', lk: 'Luke', rom: 'Rom', rev: 'Rev', revelations: 'Rev', gen: 'Gen', ex: 'Exod', exo: 'Exod',
  phil: 'Phil', philemon: 'Phlm', jas: 'Jas', james: 'Jas', judg: 'Judg', jude: 'Jude', eccl: 'Eccl', ecc: 'Eccl', prov: 'Prov',
};

/** Parse "John 3:16", "1 Cor 13:4-7", "psalm 23" into an OSIS ref string, or null. */
export function parseHumanRef(input) {
  const m = /^\s*([1-3]?\s*[a-z][a-z .]*?)\.?\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?)?\s*$/i.exec(input);
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/\s+/g, ' ').replace(/^([1-3]) ?/, '$1 ').trim();
  let osis = ALIASES[name] || ALIASES[name.replace(/ /g, '')];
  if (!osis) {
    const compact = name.replace(/ /g, '');
    const b = books().find((x) => x.name.toLowerCase() === name)
      || books().find((x) => x.osis.toLowerCase() === compact)
      || books().find((x) => x.name.toLowerCase().replace(/ /g, '').startsWith(compact));
    osis = b?.osis;
  }
  if (!osis) return null;
  const c = +m[2];
  const book = books().find((x) => x.osis === osis);
  if (!book || c < 1 || c > book.chapters) return null;
  if (!m[3]) return `${osis}.${c}`;
  return m[4] ? `${osis}.${c}.${m[3]}-${osis}.${c}.${m[4]}` : `${osis}.${c}.${m[3]}`;
}

/** Full-text verse search over the BSB (loads all 66 books on first use, ~4 MB). */
export async function searchVerses(q, limit = 200, tr = 'bsb') {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  const all = books();
  const texts = await Promise.all(all.map((b) => fetchJSON(`bible/${tr}/${b.osis}.json`)));
  for (let bi = 0; bi < all.length; bi++) {
    const chs = texts[bi];
    for (let c = 0; c < chs.length; c++) {
      for (let v = 0; v < chs[c].length; v++) {
        const t = chs[c][v];
        if (!t) continue;
        const lt = (tr === 'kjv' ? stripMd(t) : t).toLowerCase();
        if (words.every((w) => lt.includes(w))) {
          out.push({ ref: `${all[bi].osis}.${c + 1}.${v + 1}`, text: t });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}
