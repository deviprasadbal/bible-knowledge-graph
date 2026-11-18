import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Shuffle, X } from 'lucide-react';
import { fetchJSON, getDictEntry } from '../lib/data';
import { ErrorNote, Skeleton, useAsync, useLookup, useTitle } from '../components/ui';
import { Md } from '../lib/md';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STARTERS = [
  'grace', 'faith', 'covenant', 'atonement', 'justification', 'redemption', 'messiah', 'kingdom-of-god',
  'adoption', 'propitiation', 'sanctification', 'repentance', 'love', 'prayer', 'trinity', 'gospel',
];
const MAX_RESULTS = 300;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letterOf = (s) => (norm(s)[0] || 'a').toUpperCase();
/** Easton link lists sometimes arrive as fragments of a stringified list ("['tappuah_1136'"); clean and dedupe. */
const cleanLinks = (links) => [...new Set((links || []).map((l) => String(l).replace(/[[\]'"\s]/g, '')).filter(Boolean))];

export default function Dictionary() {
  useTitle('Bible Dictionary');
  const { id } = useParams();
  const { data: index, loading, error } = useAsync(() => fetchJSON('dictionary/index.json'), []);
  if (error) return <div className="container page"><ErrorNote error={error} /></div>;
  return (
    <div className="container page dict-page">
      <header className="dict-header">
        <span className="eyebrow">Reference · Easton's Bible Dictionary</span>
        <h1>Bible Dictionary</h1>
        <p className="lead">
          {index ? index.length.toLocaleString() : 'Nearly 4,000'} short articles on the people, places, customs and
          great words of Scripture. Every reference opens in the reader.
        </p>
      </header>
      {loading || !index ? <Skeleton lines={8} /> : <DictionaryBody index={index} id={id} />}
    </div>
  );
}

function DictionaryBody({ index, id }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [letter, setLetter] = useState(() => (id ? letterOf(index.find((d) => d.id === id)?.l || id) : 'A'));
  const listRef = useRef(null);

  const prepared = useMemo(() => index.map((d) => ({ ...d, n0: norm(d.l), L: letterOf(d.l) })), [index]);
  const pos = useMemo(() => new Map(prepared.map((d, i) => [d.id, i])), [prepared]);
  const counts = useMemo(() => {
    const c = {};
    for (const d of prepared) c[d.L] = (c[d.L] || 0) + 1;
    return c;
  }, [prepared]);

  // Follow the selected entry's letter when arriving from a link.
  useEffect(() => {
    if (!id) return;
    const d = prepared[pos.get(id)];
    if (d) setLetter(d.L);
  }, [id, prepared, pos]);

  const list = useMemo(() => {
    const nq = norm(dq.trim());
    if (!nq) return prepared.filter((d) => d.L === letter);
    const starts = [];
    const inner = [];
    for (const d of prepared) {
      if (d.n0.startsWith(nq)) starts.push(d);
      else if (d.n0.includes(nq)) inner.push(d);
    }
    return starts.concat(inner);
  }, [prepared, dq, letter]);
  const shown = list.slice(0, MAX_RESULTS);
  const searching = !!dq.trim();

  // Keep the current term visible inside the scrolling list (without scrolling the page).
  useEffect(() => {
    const box = listRef.current;
    if (!box || !id) return;
    const el = box.querySelector('[aria-current="page"]');
    if (!el) return;
    const top = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
    box.scrollTop = Math.max(0, top);
  }, [id, letter, searching]);

  const onSearchKey = (e) => {
    if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); }
    if (e.key === 'Enter' && shown[0]) { e.preventDefault(); navigate(`/dictionary/${shown[0].id}`); }
    if (e.key === 'ArrowDown' && shown[0]) {
      e.preventDefault();
      listRef.current?.querySelector('a')?.focus();
    }
  };
  const onListKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...(listRef.current?.querySelectorAll('a') || [])];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    links[Math.min(links.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  const random = () => {
    const d = prepared[Math.floor(Math.random() * prepared.length)];
    if (d) navigate(`/dictionary/${d.id}`);
  };

  const i = id != null ? pos.get(id) : undefined;
  const prev = i != null && i > 0 ? prepared[i - 1] : null;
  const next = i != null && i < prepared.length - 1 ? prepared[i + 1] : null;

  return (
    <div className={`two-col dict-cols${id ? ' has-entry' : ''}`}>
      <aside className="dict-index" aria-label="Dictionary terms">
        <div className="dict-search">
          <Search size={16} className="dict-search-icon" aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search terms, e.g. Covenant"
            aria-label="Search dictionary terms"
            aria-controls="dict-list"
            autoComplete="off"
            spellCheck={false}
          />
          {q && <button type="button" className="icon-btn dict-clear" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}
        </div>
        <div className="alpha" role="group" aria-label="Browse by letter">
          {LETTERS.map((L) => (
            <button
              key={L}
              type="button"
              className={!searching && letter === L ? 'on' : ''}
              aria-pressed={!searching && letter === L}
              aria-label={`${L}: ${counts[L] || 0} terms`}
              disabled={!counts[L]}
              onClick={() => { setLetter(L); setQ(''); if (listRef.current) listRef.current.scrollTop = 0; }}
            >
              {L}
            </button>
          ))}
        </div>
        <div className="small faint" aria-live="polite">
          {searching
            ? `${list.length.toLocaleString()} term${list.length === 1 ? '' : 's'} matching “${dq.trim()}”${list.length > MAX_RESULTS ? ` (first ${MAX_RESULTS} shown)` : ''}`
            : `${(counts[letter] || 0).toLocaleString()} terms under ${letter}`}
        </div>
        {shown.length === 0 ? (
          <p className="small muted dict-none">No terms match. Try another spelling: Easton often uses the King James forms of names.</p>
        ) : (
          <ul className="dict-list" id="dict-list" ref={listRef} onKeyDown={onListKey}>
            {shown.map((d) => (
              <li key={d.id}>
                <Link to={`/dictionary/${d.id}`} className="dict-term" aria-current={d.id === id ? 'page' : undefined}>
                  {d.l}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn sm ghost" onClick={random}><Shuffle size={15} aria-hidden="true" /> Surprise me</button>
      </aside>

      <div className="dict-main">
        {id ? (
          <Entry key={id} id={id} label={i != null ? prepared[i].l : null} prev={prev} next={next} />
        ) : (
          <Welcome index={prepared} pos={pos} />
        )}
      </div>
    </div>
  );
}

function Entry({ id, label, prev, next }) {
  const { data, loading, error } = useAsync(() => getDictEntry(id), [id]);
  const people = useLookup('people.json');
  const places = useLookup('places.json');
  useTitle(data?.term || label || 'Bible Dictionary');

  const graph = useMemo(() => {
    if (!data || !people || !places) return [];
    const pe = new Map(people.map((p) => [p.id, p]));
    const pl = new Map(places.map((p) => [p.id, p]));
    const out = [];
    for (const slug of cleanLinks(data.links)) {
      if (pe.has(slug)) {
        const p = pe.get(slug);
        out.push({ slug, kind: 'person', name: p.l, hint: p.sub ? p.sub.replace(/^[^(]*\(?/, '').replace(/\)\s*$/, '') : '', to: `/people/${slug}` });
      } else if (pl.has(slug)) {
        const p = pl.get(slug);
        out.push({ slug, kind: 'place', name: p.l, hint: p.ft && p.ft !== 'Other' ? p.ft.toLowerCase() : '', to: `/places/${slug}` });
      }
    }
    // Only add a hint when two links would otherwise read the same; number them if the hints match too.
    const groups = new Map();
    for (const g of out) groups.set(g.name, [...(groups.get(g.name) || []), g]);
    return out.map((g) => {
      const same = groups.get(g.name);
      if (same.length < 2) return { ...g, extra: '' };
      const hintsDistinct = new Set(same.map((x) => x.hint)).size === same.length && same.every((x) => x.hint);
      return { ...g, extra: hintsDistinct ? g.hint : [g.hint, same.indexOf(g) + 1].filter(Boolean).join(' ') };
    });
  }, [data, people, places]);

  return (
    <article className="card dict-entry">
      <Link to="/dictionary" className="btn sm ghost dict-back"><ArrowLeft size={15} aria-hidden="true" /> All terms</Link>
      <span className="eyebrow">Easton's Bible Dictionary · 1897</span>
      {error ? (
        <ErrorNote error={error} />
      ) : loading ? (
        <><h1>{label || ' '}</h1><Skeleton lines={7} /></>
      ) : !data ? (
        <div className="empty" style={{ padding: '30px 0' }}>
          <h2>No entry found</h2>
          <p>There is no article called “{id}”. Try searching the list.</p>
        </div>
      ) : (
        <>
          <h1>{data.term}</h1>
          <Md text={data.text} className="prose dict-text" />
          {graph.length > 0 && (
            <div className="dict-graph">
              <div className="section-label">In the graph</div>
              <div className="chips">
                {graph.map((g) => (
                  <Link key={g.slug} to={g.to} className="chip" title={g.hint || undefined}>
                    <span className="dot" style={{ background: g.kind === 'person' ? 'var(--c-person)' : 'var(--c-place)' }} aria-hidden="true" />
                    {g.name}
                    {g.extra && <span className="faint">({g.extra})</span>}
                    <span className="sr-label">{g.kind === 'person' ? ', person' : ', place'}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <nav className="dict-pager" aria-label="Neighbouring entries">
        {prev ? (
          <Link to={`/dictionary/${prev.id}`} className="btn sm"><ChevronLeft size={15} aria-hidden="true" /> {prev.l}</Link>
        ) : <span />}
        {next && (
          <Link to={`/dictionary/${next.id}`} className="btn sm">{next.l} <ChevronRight size={15} aria-hidden="true" /></Link>
        )}
      </nav>
    </article>
  );
}

function Welcome({ index, pos }) {
  useTitle('Bible Dictionary');
  const starters = STARTERS.filter((s) => pos.has(s)).map((s) => index[pos.get(s)]);
  return (
    <div className="dict-welcome">
      <div className="card dict-entry">
        <span className="eyebrow">About this dictionary</span>
        <h2>A wise old companion</h2>
        <div className="prose">
          <p>
            <em>Easton's Bible Dictionary</em> was compiled by Matthew George Easton (1823–1894), a Scottish Presbyterian
            minister and scholar, and published in the edition of 1897. For more than a century it has helped ordinary
            readers understand the names, places, customs and key words they meet in Scripture.
          </p>
          <p>
            It is now in the public domain. Because it was written in the 1890s, some of its archaeology, place
            identifications and dates have since been revised, and a few turns of phrase reflect its own era. Read it as a
            knowledgeable friend from another age: always worth hearing, never the final word over the Bible itself.
          </p>
        </div>
      </div>
      {starters.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div className="section-label">Great words of the faith</div>
          <div className="chips">
            {starters.map((d) => <Link key={d.id} to={`/dictionary/${d.id}`} className="chip">{d.l}</Link>)}
          </div>
        </section>
      )}
    </div>
  );
}
