import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronsDownUp, Hourglass, Network, Search, X } from 'lucide-react';
import { OSIS, bookByOsis, fetchJSON, formatRef, refLink, yearLabel } from '../lib/data';
import { ErrorNote, KeyVerse, Skeleton, VerseRef, useAsync, useLookup, useTitle } from '../components/ui';

/*
  Eras. The source data (Theographic) dates events by a traditional chronology in the line of Archbishop
  Ussher (e.g. the Exodus in 1490 BC, Saul crowned in 1094 BC, the kingdom divided in 974 BC, Jerusalem's fall
  in 585 BC, Pentecost in AD 30). Era boundaries are set on that same scale so each event lands in the era
  its story belongs to. `from` is the first year (inclusive) of the era.
*/
const ERAS = [
  {
    id: 'beginnings', title: 'Beginnings', range: 'Creation to c. 2000 BC', from: -Infinity,
    desc: 'Creation, the fall, the flood and the scattering at Babel: the opening chapters of Genesis tell where everything came from, and how the world God called good was broken by sin. Dates this early follow the traditional chronology of our source data; scholars and faithful readers differ widely on them.',
  },
  {
    id: 'patriarchs', title: 'The Patriarchs', range: 'c. 2000 to 1570 BC', from: -1996,
    desc: 'God calls Abraham and promises that through his family all the nations of the earth will be blessed. The promise passes to Isaac, Jacob and Joseph, and the story closes with Jacob’s family sheltering in Egypt.',
  },
  {
    id: 'exodus', title: 'Exodus & Conquest', range: 'c. 1570 to 1095 BC', from: -1570,
    desc: 'Through Moses, God rescues Israel from slavery, gives the Law at Sinai and dwells among his people in the tabernacle. Joshua leads them into Canaan, and the judges follow in a long cycle of straying, oppression and deliverance.',
  },
  {
    id: 'kingdom', title: 'The Kingdom', range: 'c. 1095 to 975 BC', from: -1095,
    desc: 'Israel asks for a king. Saul, David and Solomon reign over a united nation; God promises David a throne that will last forever, and Solomon builds the temple in Jerusalem.',
  },
  {
    id: 'divided', title: 'Divided Kingdom', range: 'c. 975 to 586 BC', from: -975,
    desc: 'After Solomon the kingdom splits in two: Israel in the north and Judah in the south. Prophets such as Elijah, Isaiah and Jeremiah call both back to God, until Assyria conquers the north and Babylon besieges Jerusalem.',
  },
  {
    id: 'exile', title: 'Exile & Return', range: '586 to c. 400 BC', from: -586,
    desc: 'Jerusalem falls and its people are carried away to Babylon. Under Persian rule a remnant returns to rebuild the temple and the city walls, with Ezra, Nehemiah, Esther and the last of the prophets.',
  },
  {
    id: 'between', title: 'Between the Testaments', range: 'c. 400 to 5 BC', from: -400,
    desc: 'Some four centuries the Protestant Old Testament does not narrate: Persian, Greek and then Roman rule, the Maccabean revolt, and the rise of the synagogue and the Pharisees. It was a long season of waiting for the promised Messiah.',
    empty: 'Scripture records no events in these years. The Old Testament closes with Malachi, and the story resumes in the Gospels.',
  },
  {
    id: 'jesus', title: 'Life of Jesus', range: 'c. 5 BC to AD 30', from: -5,
    desc: 'The Word becomes flesh. Jesus is born in Bethlehem, teaches and heals in Galilee and Judea, is crucified in Jerusalem, and rises from the dead on the third day.',
  },
  {
    id: 'church', title: 'The Early Church', range: 'AD 30 onward', from: 33,
    desc: 'The risen Christ ascends and the Holy Spirit comes at Pentecost. The good news spreads from Jerusalem to Judea, Samaria and on to Rome, carried by Peter, Paul and many believers whose names are known only to God.',
  },
];
const ERA_BY_ID = new Map(ERAS.map((e) => [e.id, e]));
const ACTS = OSIS.indexOf('Acts');

const yearOf = (ev) => (ev.year != null ? ev.year : Math.floor(ev.sort));
function eraOf(ev) {
  const y = yearOf(ev);
  let era = ERAS[0];
  for (const e of ERAS) if (y >= e.from) era = e;
  // The source places the Ascension, Pentecost and the first days of the church in AD 30, the same year as the
  // crucifixion. Events told in Acts or later books therefore open the Early Church era.
  if (era.id === 'jesus' && OSIS.indexOf(ev.book) >= ACTS) era = ERA_BY_ID.get('church');
  return era.id;
}

const UNITS = { Y: ['year', 'years'], M: ['month', 'months'], W: ['week', 'weeks'], D: ['day', 'days'] };
/** "52Y" -> "52 years", "3M10D" -> "3 months, 10 days". Single-day spans are treated as moments and hidden. */
function durationLabel(d) {
  if (!d || d === '1D') return '';
  const parts = [];
  for (const [, n, u] of String(d).matchAll(/(\d+(?:\.\d+)?)([YMWD])/g)) parts.push(`${n} ${UNITS[u][+n === 1 ? 0 : 1]}`);
  return parts.join(', ');
}

/** Split an event's verse list into runs of consecutive verses within one chapter: ["Gen.1.1-Gen.1.8", ...]. */
function runsOf(verses) {
  const runs = [];
  let cur = null;
  for (const r of verses || []) {
    const [b, c, v] = r.split('.');
    if (cur && cur.b === b && cur.c === c && +v === cur.end + 1) { cur.end = +v; continue; }
    cur = { b, c, start: +v, end: +v, first: r };
    runs.push(cur);
  }
  return runs.map((x) => (x.end > x.start ? `${x.first}-${x.b}.${x.c}.${x.end}` : x.first));
}

/** The opening passage (the run containing the event's first verse) and any other accounts of it. */
function passagesOf(ev) {
  const runs = runsOf(ev.verses?.length ? ev.verses : [ev.first]);
  const i = Math.max(0, runs.findIndex((r) => r === ev.first || r.startsWith(`${ev.first}-`)));
  const main = runs[i] || ev.first;
  const others = runs.filter((_, j) => j !== i);
  return { main, others };
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Timeline() {
  useTitle('Timeline');
  const { data, loading, error } = useAsync(() => fetchJSON('events.json'), []);
  if (error) return <div className="container page"><ErrorNote error={error} /></div>;
  return (
    <div className="container page timeline-page">
      <header style={{ marginBottom: 18 }}>
        <span className="eyebrow">Timeline{data ? ` · ${data.length} events` : ''}</span>
        <h1>The Story Through Time</h1>
        <p className="lead">
          From Creation to the first churches, the Bible tells one unfolding story. Follow it era by era, and open any
          event to meet the people, the places and the passage where it is told.
        </p>
        <p className="small faint" style={{ maxWidth: 720 }}>
          Dates follow the traditional chronology used by our source data (in the line of Archbishop Ussher). Dates before
          about 1000 BC are especially uncertain, and careful scholars differ on them; read them as a guide to the order
          of events rather than as settled fact. Events marked “c.” have no exact year in the source.
        </p>
      </header>
      {loading || !data ? <Skeleton lines={8} /> : <TimelineBody events={data} />}
    </div>
  );
}

function TimelineBody({ events }) {
  const [params] = useSearchParams();
  const focus = params.get('e');
  const people = useLookup('people.json');
  const places = useLookup('places.json');
  const peopleById = useMemo(() => new Map((people || []).map((p) => [p.id, p])), [people]);
  const placeById = useMemo(() => new Map((places || []).map((p) => [p.id, p])), [places]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [era, setEra] = useState('all');
  const [open, setOpen] = useState(() => new Set());
  const [flash, setFlash] = useState(null);
  const [scrollReq, setScrollReq] = useState(null); // { el, focus? }
  const barRef = useRef(null);

  const items = useMemo(() => events.map((ev) => ({ ev, era: eraOf(ev) })), [events]);
  const eraCounts = useMemo(() => {
    const c = {};
    for (const it of items) c[it.era] = (c[it.era] || 0) + 1;
    return c;
  }, [items]);

  const haystack = useMemo(() => {
    const m = new Map();
    for (const { ev } of items) {
      const names = [
        ev.title,
        bookByOsis(ev.book)?.name,
        ...(ev.people || []).map((id) => peopleById.get(id)?.l),
        ...(ev.places || []).map((id) => placeById.get(id)?.l),
      ];
      m.set(ev.id, norm(names.filter(Boolean).join(' | ')));
    }
    return m;
  }, [items, peopleById, placeById]);

  const groups = useMemo(() => {
    const nq = norm(dq.trim());
    const byEra = new Map(ERAS.map((e) => [e.id, []]));
    for (const it of items) {
      if (era !== 'all' && it.era !== era) continue;
      if (nq && !haystack.get(it.ev.id).includes(nq)) continue;
      byEra.get(it.era).push(it.ev);
    }
    return ERAS
      .filter((e) => era === 'all' || e.id === era)
      .map((e) => ({ era: e, events: byEra.get(e.id) }))
      .filter((g) => g.events.length || (!nq && g.era.empty));
  }, [items, era, dq, haystack]);
  const matchCount = groups.reduce((n, g) => n + g.events.length, 0);

  const toggle = useCallback((id) => {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  // ?e=<eventId>: open that event, make sure no filter hides it, and bring it into view.
  useEffect(() => {
    if (!focus || !eventById.has(focus)) return;
    setOpen((s) => (s.has(focus) ? s : new Set(s).add(focus)));
    setEra('all');
    setQ('');
    setFlash(focus);
    setScrollReq({ el: `ev-${focus}` });
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [focus, eventById]);

  // Carry out a requested scroll once the DOM reflects the latest filters (the text filter is deferred,
  // so the target may only appear a render later; `groups` changing re-runs this).
  useEffect(() => {
    if (!scrollReq) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(scrollReq.el);
      if (!el) return;
      // Land just below the sticky nav + filter bar, whatever height they wrap to at this width.
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
      const barH = barRef.current?.offsetHeight || 0;
      const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 14;
      window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      if (scrollReq.focus) el.querySelector(scrollReq.focus)?.focus({ preventScroll: true });
      setScrollReq(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollReq, groups]);

  const jumpTo = (id) => {
    if (!id) return;
    if (era !== 'all' && era !== id) setEra('all');
    if (q) setQ('');
    setScrollReq({ el: `era-${id}`, focus: 'h2' });
  };

  const filtering = dq.trim() || era !== 'all';

  return (
    <>
      <div className="tl-bar" ref={barRef}>
        <div className="tl-bar-row">
          <div className="tl-search">
            <Search size={16} className="tl-search-icon" aria-hidden="true" />
            <input
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); } }}
              placeholder="Filter by event, person or place"
              aria-label="Filter events by title, person or place"
              autoComplete="off"
            />
            {q && <button type="button" className="icon-btn tl-clear" onClick={() => setQ('')} aria-label="Clear filter"><X size={16} /></button>}
          </div>
          <select className="input tl-jump" value="" onChange={(e) => jumpTo(e.target.value)} aria-label="Jump to era">
            <option value="">Jump to era…</option>
            {ERAS.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {open.size > 0 && (
            <button type="button" className="btn sm ghost" onClick={() => setOpen(new Set())}>
              <ChevronsDownUp size={15} aria-hidden="true" /> Collapse all
            </button>
          )}
        </div>
        <div className="chips tl-eras" role="group" aria-label="Show era">
          <button type="button" className={`chip${era === 'all' ? ' on' : ''}`} aria-pressed={era === 'all'} onClick={() => setEra('all')}>All eras</button>
          {ERAS.map((e) => (
            <button key={e.id} type="button" className={`chip${era === e.id ? ' on' : ''}`} aria-pressed={era === e.id}
              onClick={() => setEra(era === e.id ? 'all' : e.id)}>
              {e.title} <span className="tl-chip-n">{eraCounts[e.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="small faint" aria-live="polite" style={{ margin: '10px 0 0' }}>
        {filtering ? `${matchCount} event${matchCount === 1 ? '' : 's'} shown` : ''}
      </p>

      {groups.length === 0 ? (
        <div className="empty">
          <Hourglass size={28} aria-hidden="true" />
          <p>No events match “{dq}”.</p>
          <button type="button" className="btn sm" onClick={() => { setQ(''); setEra('all'); }}>Clear filters</button>
        </div>
      ) : (
        <div className="tl">
          {groups.map(({ era: e, events: evs }) => (
            <section key={e.id} id={`era-${e.id}`} className="tl-section" aria-labelledby={`era-h-${e.id}`}>
              <div className="tl-era">
                <span className="pill">{e.range}</span>
                <h2 id={`era-h-${e.id}`} tabIndex={-1}>{e.title}</h2>
                <span className="small faint">{evs.length ? `${evs.length} event${evs.length === 1 ? '' : 's'}` : ''}</span>
              </div>
              <p className="tl-era-desc">{e.desc}</p>
              {evs.length === 0 && e.empty && <div className="tl-quiet">{e.empty}</div>}
              {evs.map((ev) => (
                <EventItem
                  key={ev.id}
                  ev={ev}
                  open={open.has(ev.id)}
                  flash={flash === ev.id}
                  onToggle={toggle}
                  peopleById={peopleById}
                  placeById={placeById}
                  parent={ev.partOf?.[0] ? eventById.get(ev.partOf[0]) : null}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

const EventItem = memo(function EventItem({ ev, open, flash, onToggle, peopleById, placeById, parent }) {
  const year = yearOf(ev);
  const label = `${ev.year == null ? 'c. ' : ''}${yearLabel(year)}`;
  const dur = durationLabel(ev.duration);
  const bodyId = `evd-${ev.id}`;
  return (
    <article id={`ev-${ev.id}`} className={`tl-item${open ? ' open' : ''}${flash ? ' tl-flash' : ''}`}>
      <div className="card">
        <button type="button" className="tl-head" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(ev.id)}>
          <span className="tl-year">{label}</span>
          <span className="tl-title">{ev.title}</span>
          <span className="tl-dur">
            {dur && <span>{dur}</span>}
            <ChevronDown size={18} className="tl-chev" aria-hidden="true" />
          </span>
        </button>
        {open && <EventDetail ev={ev} id={bodyId} peopleById={peopleById} placeById={placeById} parent={parent} />}
      </div>
    </article>
  );
});

function EventDetail({ ev, id, peopleById, placeById, parent }) {
  const { main: passage, others } = useMemo(() => passagesOf(ev), [ev]);
  const note = (ev.notes || '').trim();
  const count = ev.verseCount || ev.verses?.length || 0;
  return (
    <div className="tl-body" id={id}>
      {ev.summary && <p className="tl-summary">{ev.summary}</p>}
      {note && <p className="small faint"><b>Chronology note:</b> {note}</p>}

      {passage && (
        <>
          <div className="section-label" style={{ marginTop: 14 }}><BookOpen size={14} aria-hidden="true" /> The passage</div>
          <KeyVerse refStr={passage} />
          {others.length > 0 && (
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span className="small faint">Also told in</span>
              <div className="chips">
                {others.slice(0, 6).map((r) => <VerseRef key={r} refStr={r} className="chip" />)}
                {others.length > 6 && <span className="small faint" style={{ alignSelf: 'center' }}>and {others.length - 6} more</span>}
              </div>
            </div>
          )}
        </>
      )}

      {(ev.people || []).length > 0 && (
        <>
          <div className="section-label">People</div>
          <div className="chips">
            {ev.people.map((pid) => {
              const p = peopleById.get(pid);
              return (
                <Link key={pid} to={`/people/${pid}`} className="chip" title={p?.sub || undefined}>
                  <span className="dot" style={{ background: 'var(--c-person)' }} aria-hidden="true" />{p?.l || pid.replace(/_\d+$/, '')}
                </Link>
              );
            })}
          </div>
        </>
      )}
      {(ev.places || []).length > 0 && (
        <>
          <div className="section-label">Places</div>
          <div className="chips">
            {ev.places.map((pid) => (
              <Link key={pid} to={`/places/${pid}`} className="chip">
                <span className="dot" style={{ background: 'var(--c-place)' }} aria-hidden="true" />{placeById.get(pid)?.l || pid.replace(/_\d+$/, '')}
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="row tl-actions">
        {ev.first && (
          <Link to={refLink(passage)} className="btn sm primary"><BookOpen size={15} aria-hidden="true" /> Read {formatRef(passage)}</Link>
        )}
        <Link to={`/explore?focus=event:${ev.id}`} className="btn sm"><Network size={15} aria-hidden="true" /> See in the graph</Link>
        {parent && (
          <Link to={`/timeline?e=${parent.id}`} className="btn sm ghost">Part of: {parent.title}</Link>
        )}
        {count > 1 && <span className="small faint">{count} verses in all</span>}
      </div>
    </div>
  );
}
