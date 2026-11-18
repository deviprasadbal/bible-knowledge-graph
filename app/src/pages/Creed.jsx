import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Calendar, ChevronDown, ChevronLeft, ChevronRight, Languages, MapPin, Search, Users,
} from 'lucide-react';
import { bookByOsis, fetchJSON } from '../lib/data';
import { Skeleton, VerseRef, useAsync, useLookup, useTitle } from '../components/ui';
import {
  CONTEXT, authorLine, cleanName, docYear, eraOf, formatInfo, itemCountLabel, shortRef, tidyTitle, unitFor,
} from '../lib/creedMeta';

export default function Creed() {
  const { id } = useParams();
  const { data, loading, error } = useAsync(() => fetchJSON(`creeds/${id}.json`), [id]);
  const index = useLookup('creeds/index.json');
  useTitle(data?.title || (error ? 'Document not found' : 'Creeds'));

  if (loading && !data) return <div className="container page narrow"><Skeleton lines={8} /></div>;
  if (error || !data) {
    return (
      <div className="container page empty">
        <h2>We couldn&rsquo;t find that document</h2>
        <p>It may have moved, or the link may be mistyped.</p>
        <Link className="btn" to="/creeds"><ArrowLeft size={16} /> All creeds and confessions</Link>
      </div>
    );
  }
  return <CreedDoc key={id} doc={data} index={index} />;
}

/* ------------------------------------------------------------------ helpers */
const shapeOf = (doc, it) => {
  if (Array.isArray(it.sections) && it.sections.length) return 'chapter';
  if (doc.format === 'Creed' || (it.n === '' && (doc.content || []).length === 1)) return 'creed';
  if (doc.format === 'Catechism' || doc.format === 'HenrysCatechism') return 'qa';
  return 'article';
};
const paras = (text) => String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
const DORT_HEADS = ['First Head of Doctrine', 'Second Head of Doctrine', 'Third and Fourth Heads of Doctrine', 'Fifth Head of Doctrine'];

function chapterLabel(doc, it, i) {
  if (doc.id === 'canons_of_dort' && doc.content.length === 4) return DORT_HEADS[i];
  const n = String(it.n || '');
  if (n.includes('&')) return `Chapters ${n.replace(/\s*&\s*/, ' & ')}`;
  return n ? `Chapter ${n}` : '';
}
function itemLabel(shape, n) {
  if (!n) return '';
  if (shape === 'qa') return `Q. ${n}`;
  if (shape === 'chapter') return `Ch. ${n}`;
  return n;
}
function showArticleNum(it) {
  const n = String(it.n || '');
  const t = String(it.title || '');
  if (!n || !/^(\d+|[IVXLC]+)$/.test(n)) return false;
  if (/^(canon|article|art\.|thesis|chapter)\b/i.test(t) || /^[IVXLC]+\.\s/.test(t)) return false;
  return true;
}

/** Find the target of ?item=<n> (also accepts "<chapter>.<section>"). */
function findTarget(items, q) {
  if (q == null || q === '') return null;
  const v = String(q).trim().toLowerCase();
  let i = items.findIndex((it) => String(it.n).toLowerCase() === v);
  if (i >= 0) return { i, s: -1 };
  const m = v.match(/^(.+?)[.:](.+)$/);
  if (m) {
    i = items.findIndex((it) => String(it.n).toLowerCase() === m[1]);
    if (i >= 0) {
      const s = (items[i].sections || []).findIndex((x) => String(x.n).toLowerCase() === m[2] || String(x.n).toLowerCase() === `a${m[2]}`);
      return { i, s };
    }
  }
  if (/^\d+$/.test(v) && +v >= 1 && +v <= items.length && items.every((it) => it.n !== v)) return { i: +v - 1, s: -1 };
  return null;
}

/* Inline Scripture references inside the texts ("Rom. 5:12", "1 Cor 15:3", "Psalm 100:3") become previewable links. */
const ALIASES = {
  Gen: 'Gen', Genesis: 'Gen', Ex: 'Exod', Exod: 'Exod', Exodus: 'Exod', Lev: 'Lev', Leviticus: 'Lev', Num: 'Num', Numb: 'Num',
  Numbers: 'Num', Deut: 'Deut', Deuteronomy: 'Deut', Josh: 'Josh', Joshua: 'Josh', Judg: 'Judg', Judges: 'Judg', Ruth: 'Ruth',
  Sam: '#Sam', Samuel: '#Sam', Kings: '#Kgs', Kgs: '#Kgs', Chron: '#Chr', Chr: '#Chr', Chronicles: '#Chr', Ezra: 'Ezra',
  Neh: 'Neh', Nehemiah: 'Neh', Esth: 'Esth', Esther: 'Esth', Job: 'Job', Ps: 'Ps', Psa: 'Ps', Psalm: 'Ps', Psalms: 'Ps',
  Prov: 'Prov', Proverbs: 'Prov', Eccl: 'Eccl', Eccles: 'Eccl', Ecclesiastes: 'Eccl', Song: 'Song', Cant: 'Song',
  Canticles: 'Song', Isa: 'Isa', Isaiah: 'Isa', Jer: 'Jer', Jeremiah: 'Jer', Lam: 'Lam', Lamentations: 'Lam', Ezek: 'Ezek',
  Ezekiel: 'Ezek', Dan: 'Dan', Daniel: 'Dan', Hos: 'Hos', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obad: 'Obad',
  Obadiah: 'Obad', Jonah: 'Jonah', Mic: 'Mic', Micah: 'Mic', Nah: 'Nah', Nahum: 'Nah', Hab: 'Hab', Habak: 'Hab',
  Habakkuk: 'Hab', Zeph: 'Zeph', Zephaniah: 'Zeph', Hag: 'Hag', Haggai: 'Hag', Zech: 'Zech', Zechariah: 'Zech', Mal: 'Mal',
  Malachi: 'Mal', Matt: 'Matt', Mat: 'Matt', Math: 'Matt', Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke', John: 'John~',
  Jhn: 'John', Acts: 'Acts', Rom: 'Rom', Romans: 'Rom', Cor: '#Cor', Corinthians: '#Cor', Gal: 'Gal', Galatians: 'Gal',
  Eph: 'Eph', Ephesians: 'Eph', Phil: 'Phil', Philip: 'Phil', Philippians: 'Phil', Col: 'Col', Colossians: 'Col',
  Thess: '#Thess', Thes: '#Thess', Thessalonians: '#Thess', Tim: '#Tim', Timothy: '#Tim', Tit: 'Titus', Titus: 'Titus',
  Philem: 'Phlm', Philemon: 'Phlm', Heb: 'Heb', Hebrews: 'Heb', Jas: 'Jas', Jam: 'Jas', James: 'Jas', Pet: '#Pet',
  Peter: '#Pet', Jude: 'Jude', Rev: 'Rev', Revelation: 'Rev',
};
const REF_RE = new RegExp(
  `\\b(?:([1-3]|I{1,3})\\s?)?(${Object.keys(ALIASES).sort((a, b) => b.length - a.length).join('|')})\\.?\\s+(\\d{1,3})\\s?:\\s?(\\d{1,3})(?:\\s?[-–]\\s?(\\d{1,3})(?!\\s?:))?`,
  'g',
);
const ROMAN = { I: 1, II: 2, III: 3 };

function toOsis(num, name) {
  const a = ALIASES[name];
  if (!a) return null;
  const n = num ? ROMAN[num] || +num : 0;
  if (a.startsWith('#')) return n ? `${n}${a.slice(1)}` : null; // numbered book needs its number
  if (a === 'John~') return n ? `${n}John` : 'John';
  return n ? null : a;
}

function linkify(text, keyBase = '') {
  const s = String(text || '');
  const out = [];
  let last = 0;
  let k = 0;
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(s))) {
    const osis = toOsis(m[1], m[2]);
    const bk = osis && bookByOsis(osis);
    const c = +m[3];
    const v = +m[4];
    const e = m[5] ? +m[5] : null;
    if (!bk || c < 1 || c > bk.chapters || v < 1) continue;
    if (m.index > last) out.push(s.slice(last, m.index));
    const ref = `${osis}.${c}.${v}${e && e > v ? `-${osis}.${c}.${e}` : ''}`;
    out.push(<VerseRef key={`${keyBase}r${k++}`} refStr={ref}>{m[0]}</VerseRef>);
    last = m.index + m[0].length;
  }
  if (!out.length) return s;
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function snippetOf(raw, word) {
  const low = raw.toLowerCase();
  const at = low.indexOf(word);
  if (at < 0) return raw.slice(0, 110) + (raw.length > 110 ? '…' : '');
  const a = Math.max(0, at - 40);
  const b = Math.min(raw.length, at + 90);
  return (a > 0 ? '…' : '') + raw.slice(a, b).trim() + (b < raw.length ? '…' : '');
}

/* ------------------------------------------------------------------ document */
function CreedDoc({ doc, index }) {
  const [params, setParams] = useSearchParams();
  const itemParam = params.get('item');
  const items = useMemo(() => doc.content || [], [doc]);
  const multi = items.length > 1;
  const hasSub = items.some((it) => it.sub?.length);
  const [expandAll, setExpandAll] = useState(false);
  const [flash, setFlash] = useState('');
  const [active, setActive] = useState(0);
  const mountedAt = useRef(0);
  const flashTimer = useRef();
  const flashOn = useRef();
  const shapes = useMemo(() => items.map((it) => shapeOf(doc, it)), [doc, items]);
  const mainShape = shapes.find((s) => s !== 'creed') || 'creed';
  const era = eraOf(doc.year);
  const story = doc.story || CONTEXT[doc.id] || '';

  const scrollToEl = useCallback((elId, instant) => {
    const el = document.getElementById(elId);
    if (!el) return;
    // Glide for short hops; long jumps through a 196-question catechism land at once (the flash marks the spot).
    const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 1.5;
    el.scrollIntoView({ behavior: instant || far ? 'instant' : 'smooth', block: 'start' });
    clearTimeout(flashTimer.current);
    clearTimeout(flashOn.current);
    setFlash('');
    flashOn.current = setTimeout(() => setFlash(elId), 30); // re-arm the animation even for the same item
    flashTimer.current = setTimeout(() => setFlash(''), 2900);
  }, []);
  useEffect(() => () => { clearTimeout(flashTimer.current); clearTimeout(flashOn.current); }, []);

  const target = useMemo(() => findTarget(items, itemParam), [items, itemParam]);
  useEffect(() => { mountedAt.current = performance.now(); }, []);
  useEffect(() => {
    if (!target) return undefined;
    const elId = target.s >= 0 ? `item-${target.i}-${target.s}` : `item-${target.i}`;
    // A deep link on arrival jumps instantly (and again once web fonts settle the layout); later jumps glide.
    const initial = performance.now() - mountedAt.current < 1500;
    scrollToEl(elId, initial);
    let live = true;
    if (initial && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        const el = document.getElementById(elId);
        if (live && el && performance.now() - mountedAt.current < 4000) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
    }
    return () => { live = false; };
  }, [target, scrollToEl]);

  const goTo = useCallback((i, s = -1) => {
    const it = items[i];
    if (!it) return;
    const n = String(it.n || '');
    const value = s >= 0 && it.sections?.[s] ? `${n}.${String(it.sections[s].n).replace(/^A(?=\d)/, '')}` : n;
    const unique = n && items.filter((x) => String(x.n) === n).length === 1;
    if (unique && value !== itemParam) {
      setParams((p) => { const next = new URLSearchParams(p); next.set('item', value); return next; }, { replace: true });
    } else {
      scrollToEl(s >= 0 ? `item-${i}-${s}` : `item-${i}`);
    }
  }, [items, itemParam, setParams, scrollToEl]);

  // Scroll-spy for the side contents list.
  useEffect(() => {
    if (!multi || typeof IntersectionObserver === 'undefined') return;
    const els = items.map((_, i) => document.getElementById(`item-${i}`)).filter(Boolean);
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = +e.target.dataset.idx;
        if (e.isIntersecting) visible.add(i); else visible.delete(i);
      }
      if (visible.size) setActive(Math.min(...visible));
    }, { rootMargin: '-140px 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items, multi]);

  const entries = useMemo(() => items.map((it, i) => {
    const raw = [
      it.text, ...(it.sections || []).map((s) => s.text), ...(it.sub || []).map((s) => `${s.q} ${s.a}`),
    ].filter(Boolean).join(' ');
    return {
      i, n: String(it.n || ''), label: itemLabel(shapes[i], it.n), title: tidyTitle(it.title) || `Item ${i + 1}`,
      raw, hay: `${it.title || ''} ${raw}`.toLowerCase(),
      secs: (it.sections || []).map((s) => String(s.n || '').toLowerCase()),
    };
  }), [items, shapes]);

  const neighbours = useMemo(() => {
    if (!index?.length) return {};
    const k = index.findIndex((d) => d.id === doc.id);
    return k < 0 ? {} : { prev: index[k - 1], next: index[k + 1] };
  }, [index, doc.id]);

  const where = doc.location && doc.location !== 'None' ? doc.location : '';
  const authors = authorLine(doc.authors, 3);
  const [one, many] = unitFor(doc);

  return (
    <div className="container page">
      <Link to="/creeds" className="lp-back"><ArrowLeft size={15} /> Creeds &amp; confessions</Link>
      <header className="cr-head">
        <span className="eyebrow">{formatInfo(doc.format).label} &middot; {era.title}</span>
        <h1>{doc.title}</h1>
        <div className="cr-meta">
          {docYear(doc) && <span><Calendar size={15} aria-hidden="true" /> {docYear(doc)}</span>}
          {authors && <span title={(doc.authors || []).map(cleanName).join(', ')}><Users size={15} aria-hidden="true" /> {authors}</span>}
          {where && <span><MapPin size={15} aria-hidden="true" /> {where}</span>}
          {doc.language && doc.language !== 'None' && <span><Languages size={15} aria-hidden="true" /> Written in {doc.language}</span>}
          <span><BookOpen size={15} aria-hidden="true" /> {itemCountLabel(doc)}{doc.proofCount > 0 ? ` · ${doc.proofCount.toLocaleString()} proof texts` : ''}</span>
        </div>
        {story && (
          <div className="panel cr-story">
            <div className="section-label" style={{ marginTop: 0 }}>Origins</div>
            <p>{story}</p>
          </div>
        )}
      </header>

      {multi && (
        <div className="cr-bar">
          <ItemFinder entries={entries} onPick={goTo} unit={one} />
          {hasSub && (
            <button type="button" className="btn sm" aria-pressed={expandAll} onClick={() => setExpandAll((x) => !x)}>
              {expandAll ? 'Collapse follow-ups' : 'Expand all follow-ups'}
            </button>
          )}
          <span className="small faint cr-bar-count">{items.length} {many}</span>
        </div>
      )}

      <div className={multi ? 'two-col cr-layout' : 'cr-layout'}>
        <div className="cr-body">
          {items.map((it, i) => {
            const shape = shapes[i];
            const cls = (id) => `cr-item${flash === id ? ' cr-flash' : ''}`;
            const id = `item-${i}`;
            if (shape === 'creed') {
              return (
                <div key={i} id={id} data-idx={i} className={`${cls(id)} creed-text cr-creed`}>
                  {multi && it.title && <h3>{tidyTitle(it.title)}</h3>}
                  {paras(it.text).map((p, k) => <p key={k}>{linkify(p, `${i}-${k}`)}</p>)}
                  <Proofs refs={it.proofs} />
                </div>
              );
            }
            if (shape === 'chapter') {
              const secProofs = it.sections.some((s) => s.proofs?.length);
              return (
                <section key={i} id={id} data-idx={i} className={`${cls(id)} cr-chapter`} aria-labelledby={`${id}-h`}>
                  <span className="eyebrow">{chapterLabel(doc, it, i)}</span>
                  <h2 id={`${id}-h`}>{tidyTitle(it.title)}</h2>
                  {paras(it.text).map((p, k) => <p key={`t${k}`} className="cr-prose">{linkify(p, `${i}-t${k}`)}</p>)}
                  {it.sections.map((s, k) => {
                    const sn = String(s.n || '');
                    const m = sn.match(/^([AR])(\d+)$/);
                    const prev = it.sections[k - 1];
                    const groupStart = m && (!prev || String(prev.n || '')[0] !== m[1]);
                    const sid = `${id}-${k}`;
                    return (
                      <Fragment key={k}>
                        {groupStart && m[1] === 'R' && <h3 className="cr-subhead">Rejection of Errors</h3>}
                        <div id={sid} className={`cr-section${flash === sid ? ' cr-flash' : ''}`}>
                          <span className="cr-sec-num" aria-label={`Section ${m ? m[2] : sn}`}>{m ? m[2] : sn}</span>
                          <div className="cr-section-body">
                            {paras(s.text).map((p, j) => <p key={j} className="cr-prose">{linkify(p, `${i}-${k}-${j}`)}</p>)}
                            <Proofs refs={s.proofs} />
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                  {!secProofs && <Proofs refs={it.proofs} />}
                </section>
              );
            }
            if (shape === 'qa') {
              return (
                <article key={i} id={id} data-idx={i} className={`${cls(id)} qa`} aria-labelledby={`${id}-h`}>
                  <h3 id={`${id}-h`}>{it.n && it.n !== '?' && <span className="num">Q. {it.n}</span>}{tidyTitle(it.title)}</h3>
                  {it.text ? (
                    paras(it.text).map((p, k) => (
                      <p key={k} className="cr-answer">{k === 0 && <span className="cr-a" aria-label="Answer">A.</span>}{linkify(p, `${i}-${k}`)}</p>
                    ))
                  ) : (
                    <p className="small faint cr-noanswer">This edition gives the answer by its Scripture proofs alone.</p>
                  )}
                  {it.sub?.length > 0 && <SubQuestions sub={it.sub} forced={expandAll} keyBase={`${i}`} />}
                  <Proofs refs={it.proofs} />
                </article>
              );
            }
            return (
              <article key={i} id={id} data-idx={i} className={`${cls(id)} qa cr-article`} aria-labelledby={`${id}-h`}>
                <h3 id={`${id}-h`}>{showArticleNum(it) && <span className="num">{it.n}</span>}{tidyTitle(it.title) || `Article ${it.n}`}</h3>
                {paras(it.text).map((p, k) => <p key={k} className="cr-prose">{linkify(p, `${i}-${k}`)}</p>)}
                <Proofs refs={it.proofs} />
              </article>
            );
          })}
        </div>

        {multi && (
          <aside className="cr-toc-wrap" aria-label="Contents">
            <Toc entries={entries} active={active} onPick={goTo} shape={mainShape} />
          </aside>
        )}
      </div>

      <footer className="cr-foot">
        <p>
          {doc.attribution ? <>Text: {doc.attribution}. </> : null}
          {doc.source && (/^https?:/.test(doc.source)
            ? <>Source: <a href={doc.source} target="_blank" rel="noreferrer">{hostOf(doc.source)}</a>, </>
            : <>Source: {doc.source}, </>)}
          via the <a href="https://github.com/NonlinearFruit/Creeds.json" target="_blank" rel="noreferrer">Creeds.json</a> collection.
          Scripture proofs open in the reader; hover or focus one to preview it.
        </p>
        {(neighbours.prev || neighbours.next) && (
          <nav className="cr-pn" aria-label="Earlier and later documents">
            {neighbours.prev ? (
              <Link to={`/creeds/${neighbours.prev.id}`} className="cr-pn-link">
                <small><ChevronLeft size={13} aria-hidden="true" /> Earlier &middot; {docYear(neighbours.prev)}</small>
                <b>{neighbours.prev.title}</b>
              </Link>
            ) : <span />}
            {neighbours.next ? (
              <Link to={`/creeds/${neighbours.next.id}`} className="cr-pn-link next">
                <small>Later &middot; {docYear(neighbours.next)} <ChevronRight size={13} aria-hidden="true" /></small>
                <b>{neighbours.next.title}</b>
              </Link>
            ) : <span />}
          </nav>
        )}
      </footer>
    </div>
  );
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/* ------------------------------------------------------------------ pieces */
function Proofs({ refs }) {
  const [all, setAll] = useState(false);
  const list = useMemo(() => [...new Set((refs || []).filter(Boolean))], [refs]);
  if (!list.length) return null;
  const LIMIT = 8;
  const shown = all ? list : list.slice(0, LIMIT);
  return (
    <div className="cr-proofs">
      <span className="cr-proofs-label">Scripture</span>
      {shown.map((r) => <VerseRef key={r} refStr={r} className="chip cr-proof">{shortRef(r)}</VerseRef>)}
      {list.length > LIMIT && (
        <button type="button" className="chip cr-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `+${list.length - LIMIT} more`}
        </button>
      )}
    </div>
  );
}

function SubQuestions({ sub, forced, keyBase }) {
  const [open, setOpen] = useState(forced);
  useEffect(() => setOpen(forced), [forced]);
  const listId = `sub-${keyBase}`;
  return (
    <div className="cr-sub">
      <button type="button" className="cr-sub-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={16} aria-hidden="true" />
        {open ? 'Hide' : 'Show'} {sub.length} follow-up question{sub.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ol className="cr-sub-list" id={listId}>
          {sub.map((s, k) => (
            <li key={k}>
              <p className="cr-sub-q">{s.q}</p>
              <p className="cr-sub-a">{linkify(s.a, `${keyBase}-s${k}`)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ItemFinder({ entries, onPick, unit }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const blurTimer = useRef();
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const out = [];
    const seen = new Set();
    const num = t.replace(/^(q|question|ch|chapter|art|article|canon|no)\.?\s*/, '').trim();
    const [cn, sn] = num.split(/[.:]/);
    for (const e of entries) {
      if (e.n && e.n.toLowerCase() === cn) { out.push({ ...e, s: sn, snippet: '' }); seen.add(e.i); }
    }
    const words = t.split(/\s+/).filter((w) => w.length > 1);
    if (words.length) {
      for (const e of entries) {
        if (seen.has(e.i)) continue;
        if (words.every((w) => e.hay.includes(w))) out.push({ ...e, snippet: snippetOf(e.raw, words[0]) });
        if (out.length >= 40) break;
      }
    }
    return out;
  }, [entries, q]);

  const pick = (r) => {
    if (!r) return;
    setOpen(false);
    const s = r.s ? r.secs.findIndex((x) => x === r.s || x === `a${r.s}`) : -1;
    onPick(r.i, s);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[sel]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const showList = open && q.trim().length > 0;

  return (
    <div className="cr-finder">
      <Search size={16} aria-hidden="true" />
      <label htmlFor="cr-finder-input" className="lp-vh">Jump to a {unit} or search this document</label>
      <input
        id="cr-finder-input" className="input" type="search" value={q} autoComplete="off"
        placeholder="Jump to a number, or search…"
        role="combobox" aria-expanded={showList && results.length > 0} aria-controls="cr-finder-list" aria-autocomplete="list"
        aria-activedescendant={showList && results[sel] ? `cr-opt-${sel}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }}
        onFocus={() => { clearTimeout(blurTimer.current); setOpen(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 160); }}
        onKeyDown={onKey}
      />
      {showList && (
        <div className="suggest" id="cr-finder-list" role="listbox" aria-label="Matches">
          {results.length ? results.map((r, k) => (
            <button
              key={`${r.i}-${k}`} id={`cr-opt-${k}`} type="button" role="option" aria-selected={k === sel}
              className={k === sel ? 'on' : ''} tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setSel(k)} onClick={() => pick(r)}
            >
              <span className="cr-opt-num">{r.label || '•'}</span>
              <span className="cr-opt-text">
                <b>{r.title}</b>
                {r.snippet && <small>{r.snippet}</small>}
              </span>
            </button>
          )) : <div className="small faint" style={{ padding: '10px 14px' }}>No matches in this document.</div>}
        </div>
      )}
    </div>
  );
}

function Toc({ entries, active, onPick, shape }) {
  const box = useRef();
  useEffect(() => {
    const b = box.current;
    const a = b?.querySelector('[aria-current="true"]');
    if (!b || !a) return;
    const top = a.offsetTop;
    if (top < b.scrollTop + 8 || top > b.scrollTop + b.clientHeight - 48) b.scrollTop = Math.max(0, top - b.clientHeight / 3);
  }, [active]);
  return (
    <div className="cr-toc" ref={box}>
      <div className="section-label" style={{ margin: '6px 10px 8px' }}>{shape === 'qa' ? 'Questions' : 'Contents'}</div>
      <ol className="cr-toc-list">
        {entries.map((e) => (
          <li key={e.i}>
            <button type="button" aria-current={active === e.i ? 'true' : undefined} onClick={() => onPick(e.i)} title={e.title}>
              <span>{e.n && e.n !== '?' ? e.n : '•'}</span>
              <span>{e.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
