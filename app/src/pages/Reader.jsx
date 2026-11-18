import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bookmark, BookmarkCheck, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Link2, Minus, Network, Plus, X,
} from 'lucide-react';
import { bookByOsis, books, fetchJSON, formatRef, getChapter, refLink, refVerses, stripMd } from '../lib/data';
import {
  markRead, setHighlight, setNote, setSetting, toggleBookmark, unmarkRead, update, useStore,
} from '../lib/store';
import { Avatar, Skeleton, Toast, useAsync, useTitle } from '../components/ui';
import { Md } from '../lib/md';

const HL = ['gold', 'sky', 'rose', 'sage'];
const SKIP_LINK = new Set(['god_1324', 'jesus_905', 'holy_spirit_7400']);

export default function Reader() {
  const { book, chapter } = useParams();
  if (!book || !bookByOsis(book)) return <BookIndex />;
  return <Chapter key={`${book}.${chapter || 1}`} osis={book} ch={Math.max(1, +chapter || 1)} />;
}

/* ------------------------------------------------------------------ book index */
function BookIndex() {
  useTitle('Read the Bible');
  const recent = useStore((s) => s.recent);
  const read = useStore((s) => s.read);
  const all = books();
  const sections = useMemo(() => {
    const m = new Map();
    for (const b of all) {
      const k = `${b.testament}|${b.section || b.division}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return [...m.entries()];
  }, [all]);
  return (
    <div className="container page">
      <span className="eyebrow">The Protestant canon · 66 books</span>
      <h1>Read the Bible</h1>
      <p className="lead">
        One book made of many: 39 books of the Old Testament (the Hebrew Scriptures) and 27 of the New Testament.
        Choose a book, or begin with one of the gentle starting points marked <span className="badge">Start here</span>.
      </p>
      {recent.length > 0 && (
        <div className="chips" style={{ margin: '18px 0 8px' }}>
          <span className="small faint" style={{ alignSelf: 'center' }}>Continue:</span>
          {recent.slice(0, 5).map((r) => {
            const [b, c] = r.split('.');
            return <Link key={r} className="chip" to={`/read/${b}/${c}`}>{bookByOsis(b)?.name} {c}</Link>;
          })}
        </div>
      )}
      {['OT', 'NT'].map((t) => (
        <section key={t} style={{ marginTop: 34 }}>
          <h2>{t === 'OT' ? 'Old Testament' : 'New Testament'}</h2>
          {sections.filter(([k]) => k.startsWith(t)).map(([k, bs]) => (
            <div key={k} style={{ marginBottom: 22 }}>
              <div className="section-label">{k.split('|')[1]}</div>
              <div className="grid grid-3">
                {bs.map((b) => {
                  const done = Object.keys(read).filter((r) => r.startsWith(b.osis + '.')).length;
                  return (
                    <Link key={b.osis} to={`/read/${b.osis}/1`} className="card link" style={{ padding: 16 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{b.name}</h3>
                        <span className="spacer" />
                        {b.startHere && <span className="badge" style={{ background: 'var(--gold-soft)' }}>Start here</span>}
                      </div>
                      {b.oneLine && <p className="small muted" style={{ margin: '6px 0 10px' }}>{b.oneLine}</p>}
                      <div className="row small faint" style={{ gap: 10 }}>
                        <span>{b.chapters} ch</span>
                        {b.genre && <span>· {b.genre}</span>}
                        <span className="spacer" />
                        {done > 0 && <span>{Math.round((done / b.chapters) * 100)}% read</span>}
                      </div>
                      {done > 0 && <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${(done / b.chapters) * 100}%` }} /></div>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ chapter */
function useNameIndex() {
  const { data } = useAsync(async () => {
    const [people, places] = await Promise.all([fetchJSON('people.json'), fetchJSON('places.json')]);
    const p = new Map(people.map((x) => [x.id, x]));
    const l = new Map(places.map((x) => [x.id, x]));
    return { p, l };
  }, []);
  return data;
}

function Chapter({ osis, ch }) {
  const b = bookByOsis(osis);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const settings = useStore((s) => s.settings);
  const highlights = useStore((s) => s.highlights);
  const notes = useStore((s) => s.notes);
  const isRead = useStore((s) => !!s.read[`${osis}.${ch}`]);
  const [picker, setPicker] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState('');
  const names = useNameIndex();
  const chapter = Math.min(ch, b.chapters);
  useTitle(`${b.name} ${chapter}`);

  const mode = settings.parallel ? 'both' : settings.translation;
  const { data, loading } = useAsync(async () => {
    const [bsb, kjv, links] = await Promise.all([
      getChapter('bsb', osis, chapter),
      mode !== 'bsb' ? getChapter('kjv', osis, chapter) : null,
      fetchJSON(`links/${osis}.json`),
    ]);
    return { bsb, kjv, links };
  }, [osis, chapter, mode]);

  // focus verse(s) from ?v=5 or ?v=5-8
  const focus = useMemo(() => {
    const v = params.get('v');
    if (!v) return null;
    const [a, z] = v.split('-').map(Number);
    return { a, z: z || a };
  }, [params]);
  useEffect(() => {
    if (!data) return;
    if (focus) {
      const el = document.getElementById(`v${focus.a}`);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 160;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    } else window.scrollTo(0, 0);
  }, [data, focus]);

  const go = useCallback((dir) => {
    const all = books();
    const i = all.findIndex((x) => x.osis === osis);
    let nb = b;
    let nc = chapter + dir;
    if (nc < 1) {
      if (i === 0) return;
      nb = all[i - 1];
      nc = nb.chapters;
    } else if (nc > b.chapters) {
      if (i === all.length - 1) return;
      nb = all[i + 1];
      nc = 1;
    }
    if (dir > 0) markRead(`${osis}.${chapter}`);
    nav(`/read/${nb.osis}/${nc}`);
  }, [osis, chapter, b, nav]);

  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(document.activeElement?.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  useEffect(() => {
    // remember position in "recent"
    const t = setTimeout(() => {
      update((s) => {
        const k = `${osis}.${chapter}`;
        s.recent = [k, ...s.recent.filter((r) => r !== k)].slice(0, 8);
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [osis, chapter]);

  const fs = settings.fontScale;

  return (
    <div className="reader">
      <div className="reader-bar">
        <div className="container narrow" style={{ maxWidth: mode === 'both' ? 1180 : 820 }}>
          <button className="btn sm" onClick={() => setPicker(true)} aria-label="Choose book and chapter">
            <b>{b.name} {chapter}</b> <ChevronDown size={15} />
          </button>
          <div className="seg" role="group" aria-label="Translation">
            <button className={mode === 'bsb' ? 'on' : ''} onClick={() => { setSetting('parallel', false); setSetting('translation', 'bsb'); }} title="Berean Standard Bible">BSB</button>
            <button className={mode === 'kjv' ? 'on' : ''} onClick={() => { setSetting('parallel', false); setSetting('translation', 'kjv'); }} title="King James Version">KJV</button>
            <button className={mode === 'both' ? 'on' : ''} onClick={() => setSetting('parallel', true)} title="Side by side">Both</button>
          </div>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => setSetting('fontScale', Math.max(0.85, +(fs - 0.1).toFixed(2)))} aria-label="Smaller text"><Minus size={17} /></button>
          <button className="icon-btn" onClick={() => setSetting('fontScale', Math.min(1.6, +(fs + 0.1).toFixed(2)))} aria-label="Larger text"><Plus size={17} /></button>
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous chapter"><ChevronLeft size={19} /></button>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Next chapter"><ChevronRight size={19} /></button>
        </div>
      </div>

      <div className="container narrow page" style={{ maxWidth: mode === 'both' ? 1180 : 820, paddingTop: 20 }}>
        {chapter === 1 && <BookIntro b={b} />}
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h1 className="chapter-title">{b.name} <span style={{ color: 'var(--gold)' }}>{chapter}</span></h1>
        </div>
        <div className="small faint" style={{ marginBottom: 18 }}>
          {mode === 'both' ? 'Berean Standard Bible · King James Version' : mode === 'kjv' ? 'King James Version (names link to the graph)' : 'Berean Standard Bible'} · tap any verse to explore its connections
        </div>

        {loading || !data ? <Skeleton lines={10} /> : (
          <div className={`passage${mode === 'both' ? ' parallel' : ''}`} style={{ '--fs': fs }}>
            {mode !== 'kjv' && (
              <div>
                {mode === 'both' && <div className="section-label">BSB</div>}
                <VerseList arr={data.bsb} tr="bsb" osis={osis} ch={chapter} links={data.links} names={names}
                  sel={sel} setSel={setSel} focus={focus} highlights={highlights} notes={notes} />
              </div>
            )}
            {mode !== 'bsb' && data.kjv && (
              <div>
                {mode === 'both' && <div className="section-label">KJV</div>}
                <VerseList arr={data.kjv} tr="kjv" osis={osis} ch={chapter} links={data.links} names={names} anchor={mode !== 'both'}
                  sel={sel} setSel={setSel} focus={focus} highlights={highlights} notes={notes} />
              </div>
            )}
          </div>
        )}

        <div className="chapter-nav">
          <button className="btn" onClick={() => go(-1)}><ChevronLeft size={16} /> Previous</button>
          <button className={`btn ${isRead ? '' : 'gold'}`} onClick={() => (isRead ? unmarkRead(`${osis}.${chapter}`) : markRead(`${osis}.${chapter}`))}>
            <Check size={16} /> {isRead ? 'Read' : 'Mark as read'}
          </button>
          <button className="btn" onClick={() => go(1)}>Next <ChevronRight size={16} /></button>
        </div>
      </div>

      {picker && <Picker current={osis} chapter={chapter} onClose={() => setPicker(false)} />}
      {sel && (
        <VerseDrawer refStr={`${osis}.${chapter}.${sel}`} links={data?.links?.[`${chapter}.${sel}`]} names={names}
          onClose={() => { setSel(null); if (params.get('v')) setParams({}, { replace: true }); }} onToast={setToast} />
      )}
      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}

function BookIntro({ b }) {
  const [open, setOpen] = useState(true);
  if (!b.summary) return null;
  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="eyebrow" style={{ margin: 0 }}>About {b.name}</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <>
          {b.oneLine && <p className="serif" style={{ fontSize: '1.3rem', margin: '8px 0', lineHeight: 1.35 }}>{b.oneLine}</p>}
          <p className="muted" style={{ marginBottom: 10 }}>{b.summary}</p>
          <dl className="kv small">
            {b.author && <><dt>Author</dt><dd>{b.author}</dd></>}
            {b.date && <><dt>Written</dt><dd>{b.date}</dd></>}
            {b.genre && <><dt>Genre</dt><dd>{b.genre}</dd></>}
          </dl>
          {b.readingTip && <p className="small" style={{ marginTop: 10, marginBottom: 0 }}><b>Reading tip:</b> {b.readingTip}</p>}
          {b.themes?.length > 0 && (
            <div className="chips" style={{ marginTop: 12 }}>
              {b.themes.map((t) => <Link key={t} to={`/themes/${t}`} className="chip">{t.replace(/-/g, ' ')}</Link>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function linkNames(text, verseLinks, names) {
  // Wrap the first occurrence of each tagged person/place name in a link (BSB text has no inline tags).
  if (!verseLinks || !names) return [text];
  const targets = [];
  for (const id of verseLinks[0] || []) {
    if (SKIP_LINK.has(id)) continue;
    const p = names.p.get(id);
    if (p?.l) targets.push({ name: p.l, to: `/people/${id}` });
  }
  for (const id of verseLinks[1] || []) {
    const p = names.l.get(id);
    if (p?.l) targets.push({ name: p.l, to: `/places/${id}` });
  }
  if (!targets.length) return [text];
  let parts = [text];
  const used = new Set();
  for (const t of targets.sort((a, b) => b.name.length - a.name.length)) {
    if (used.has(t.name)) continue;
    const re = new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const next = [];
    let done = false;
    for (const part of parts) {
      if (done || typeof part !== 'string') { next.push(part); continue; }
      const m = re.exec(part);
      if (!m) { next.push(part); continue; }
      next.push(part.slice(0, m.index), { name: m[0], to: t.to }, part.slice(m.index + m[0].length));
      done = true;
      used.add(t.name);
    }
    parts = next;
  }
  return parts;
}

function renderKjv(md) {
  // KJV text from Theographic: [Name](/person/slug) markdown
  const out = [];
  const re = /\[([^\]]+)\]\(\/(person|place)\/([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push(md.slice(last, m.index));
    if (SKIP_LINK.has(m[3])) out.push(m[1]);
    else out.push({ name: m[1], to: `/${m[2] === 'person' ? 'people' : 'places'}/${m[3]}` });
    last = re.lastIndex;
  }
  if (last < md.length) out.push(md.slice(last));
  // KJV italics (_word_) mark words the translators supplied; show them as real italics.
  return out.flatMap((p) => (typeof p === 'string' ? p.split(/_([^_]+)_/g).map((t, i) => (i % 2 ? { em: t } : t)) : [p]));
}

function VerseList({ arr, tr, osis, ch, links, names, sel, setSel, focus, highlights, notes, anchor = true }) {
  return (
    <div>
      {arr.map((text, i) => {
        if (text == null) return null;
        const v = i + 1;
        const ref = `${osis}.${ch}.${v}`;
        const parts = tr === 'kjv' ? renderKjv(text) : linkNames(text, links?.[`${ch}.${v}`], names);
        const hl = highlights[ref];
        const inFocus = focus && v >= focus.a && v <= focus.z;
        return (
          <Fragment key={v}>
            <span id={anchor ? `v${v}` : undefined}
              className={`verse${sel === v ? ' sel' : ''}${hl ? ` hl-${hl}` : ''}${inFocus ? ' flash' : ''}`}
              onClick={(e) => { if (e.target.closest('a')) return; setSel(sel === v ? null : v); }}
              role="button" tabIndex={0} aria-label={`Verse ${v}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(v); } }}>
              <sup>{v}</sup>
              {parts.map((p, j) => (typeof p === 'string' ? p : p.em ? <em key={j}>{p.em}</em> : <Link key={j} to={p.to} className="name-link">{p.name}</Link>))}
              {notes[ref] && <span className="has-note" title="You have a note here" />}
            </span>{' '}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ picker */
function Picker({ current, chapter, onClose }) {
  const [bk, setBk] = useState(current);
  const [q, setQ] = useState('');
  const read = useStore((s) => s.read);
  const nav = useNavigate();
  const b = bookByOsis(bk);
  const all = books().filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="picker" role="dialog" aria-label="Choose a passage">
      <div className="container">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Choose a passage</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <input className="input" placeholder="Filter books…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus style={{ marginBottom: 16 }} />
        <div className="two-col" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <div>
            {['OT', 'NT'].map((t) => (
              <div key={t} style={{ marginBottom: 16 }}>
                <div className="section-label">{t === 'OT' ? 'Old Testament' : 'New Testament'}</div>
                <div className="book-grid">
                  {all.filter((x) => x.testament === t).map((x) => (
                    <button key={x.osis} className={`book-btn${x.osis === bk ? ' on' : ''}`} onClick={() => setBk(x.osis)}>
                      {x.name}<small>{x.chapters} chapters</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sticky-side" style={{ top: 20 }}>
            <div className="section-label">{b.name}: chapters</div>
            <div className="ch-grid">
              {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => (
                <button key={c} className={`ch-btn${read[`${bk}.${c}`] ? ' read' : ''}`}
                  style={bk === current && c === chapter ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : undefined}
                  onClick={() => { nav(`/read/${bk}/${c}`); onClose(); }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ verse drawer */
function VerseDrawer({ refStr, links, names, onClose, onToast }) {
  const bookmarked = useStore((s) => !!s.bookmarks[refStr]);
  const hl = useStore((s) => s.highlights[refStr]);
  const note = useStore((s) => s.notes[refStr]?.text || '');
  const [draft, setDraft] = useState(note);
  const [showAll, setShowAll] = useState(false);
  const [b, c, v] = refStr.split('.');
  useEffect(() => setDraft(note), [refStr, note]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const { data: texts } = useAsync(async () => {
    const [bsb, kjv] = await Promise.all([refVerses(refStr, 'bsb', 1), refVerses(refStr, 'kjv', 1)]);
    return { bsb: bsb[0]?.text, kjv: kjv[0]?.text };
  }, [refStr]);
  const { data: xrefs, loading: xl } = useAsync(async () => {
    const x = await fetchJSON(`xref/${b}.json`);
    return x[`${c}.${v}`] || [];
  }, [refStr]);
  const { data: themes } = useAsync(() => fetchJSON('themes.json'), []);
  const { data: events } = useAsync(() => (links?.[2]?.length ? fetchJSON('events.json') : []), [refStr]);

  const relatedThemes = useMemo(() => (themes || []).filter((t) => (t.keyVerses || []).some((r) => covers(r, b, +c, +v))), [themes, b, c, v]);
  const evs = (events || []).filter((e) => links?.[2]?.includes(e.id));

  const copy = async () => {
    const t = `“${texts?.bsb}” (${formatRef(refStr)}, BSB)`;
    try { await navigator.clipboard.writeText(t); onToast('Verse copied'); } catch { onToast('Copy not available'); }
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}#${refLink(refStr)}`;
    try {
      if (navigator.share) await navigator.share({ title: formatRef(refStr), text: texts?.bsb, url });
      else { await navigator.clipboard.writeText(url); onToast('Link copied'); }
    } catch { /* dismissed */ }
  };

  const list = xrefs || [];
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label={`Verse ${formatRef(refStr)}`}>
        <div className="drawer-head">
          <h3 style={{ margin: 0 }}>{formatRef(refStr)}</h3>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {texts ? (
          <>
            <p className="scripture" style={{ fontSize: '1.15rem', lineHeight: 1.7, marginBottom: 6 }}>{texts.bsb}</p>
            <p className="scripture small muted" style={{ marginBottom: 4 }}><span className="badge">KJV</span> {stripMd(texts.kjv)}</p>
          </>
        ) : <Skeleton lines={3} />}

        <div className="row" style={{ marginTop: 14, gap: 6 }}>
          <button className={`btn sm${bookmarked ? ' gold' : ''}`} onClick={() => toggleBookmark(refStr)}>
            {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {bookmarked ? 'Saved' : 'Save'}
          </button>
          <button className="btn sm" onClick={copy}><Copy size={15} /> Copy</button>
          <button className="btn sm" onClick={share}><Link2 size={15} /> Share</button>
          <Link className="btn sm" to={`/explore?focus=book:${b}`}><Network size={15} /> Graph</Link>
        </div>

        <div className="section-label">Highlight</div>
        <div className="swatches">
          {HL.map((h) => (
            <button key={h} className={`swatch${hl === h ? ' on' : ''}`} style={{ background: `var(--hl-${h})` }}
              onClick={() => setHighlight(refStr, h)} aria-label={`Highlight ${h}`} aria-pressed={hl === h} />
          ))}
        </div>

        <div className="section-label">My note</div>
        <textarea className="input" placeholder="What do you notice? What questions does this raise?" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={() => setNote(refStr, draft)} />
        {draft !== note && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { setNote(refStr, draft); onToast('Note saved'); }}>Save note</button>}

        {(links?.[0]?.length || links?.[1]?.length || evs.length) ? (
          <>
            <div className="section-label">In this verse</div>
            <div className="chips">
              {(links?.[0] || []).map((id) => {
                const p = names?.p.get(id);
                return <Link key={id} to={`/people/${id}`} className="chip"><span className="dot" style={{ background: 'var(--c-person)' }} />{p?.l || id}</Link>;
              })}
              {(links?.[1] || []).map((id) => {
                const p = names?.l.get(id);
                return <Link key={id} to={`/places/${id}`} className="chip"><span className="dot" style={{ background: 'var(--c-place)' }} />{p?.l || id}</Link>;
              })}
              {evs.map((e) => <Link key={e.id} to={`/timeline?e=${e.id}`} className="chip"><span className="dot" style={{ background: 'var(--c-event)' }} />{e.title}</Link>)}
            </div>
          </>
        ) : null}

        {relatedThemes.length > 0 && (
          <>
            <div className="section-label">Big ideas in this verse</div>
            <div className="chips">
              {relatedThemes.map((t) => <Link key={t.id} to={`/themes/${t.id}`} className="chip"><span className="dot" style={{ background: 'var(--c-theme)' }} />{t.title}</Link>)}
            </div>
          </>
        )}

        <div className="section-label">Echoes across Scripture {list.length > 0 && <span className="badge">{list.length}</span>}</div>
        {xl ? <Skeleton lines={3} /> : list.length === 0 ? <p className="small faint">No cross-references for this verse.</p> : (
          <>
            {(showAll ? list : list.slice(0, 5)).map(([r, votes]) => <XRef key={r} r={r} votes={votes} />)}
            {list.length > 5 && !showAll && <button className="btn sm ghost" onClick={() => setShowAll(true)}>Show {list.length - 5} more</button>}
            <p className="small faint" style={{ marginTop: 10 }}>Cross-references from OpenBible.info, ranked by reader votes.</p>
          </>
        )}
        {names && links?.[0]?.length > 0 && (
          <>
            <div className="section-label">People here</div>
            {(links[0] || []).slice(0, 4).map((id) => {
              const p = names.p.get(id);
              return p ? (
                <Link key={id} to={`/people/${id}`} className="list-item">
                  <Avatar name={p.l} size={34} />
                  <div><b>{p.l}</b>{p.sub && <div className="small faint">{p.sub}</div>}<div className="small faint">{p.vc} verses</div></div>
                </Link>
              ) : null;
            })}
          </>
        )}
      </aside>
    </>
  );
}

function XRef({ r, votes }) {
  const { data } = useAsync(() => refVerses(r, 'bsb', 2), [r]);
  return (
    <Link to={refLink(r)} className="xref">
      <div className="row" style={{ gap: 6 }}><b>{formatRef(r)}</b><span className="spacer" /><span className="small faint">{votes} votes</span></div>
      <p>{data ? data.map((x) => x.text).join(' ').slice(0, 220) : '…'}</p>
    </Link>
  );
}

function covers(ref, b, c, v) {
  const [a, z] = ref.split('-');
  const pa = a.split('.');
  if (pa[0] !== b) return false;
  const key = (cc, vv) => cc * 1000 + vv;
  const s = key(+pa[1], +(pa[2] || 0));
  let e = s;
  if (z) {
    const pz = z.split('.');
    e = key(+pz[1], +(pz[2] || 999));
  } else if (!pa[2]) e = key(+pa[1], 999);
  const k = key(c, v);
  return k >= s && k <= e;
}

export { Md };
