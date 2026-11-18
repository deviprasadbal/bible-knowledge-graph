import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Network, Route } from 'lucide-react';
import { bookByOsis, fetchJSON, getPerson, yearLabel } from '../lib/data';
import { Avatar, KeyVerse, Skeleton, useAsync, useTitle, VerseRef } from '../components/ui';
import { Md } from '../lib/md';

export default function Person() {
  const { id } = useParams();
  const { data, loading } = useAsync(async () => {
    const [p, people, places, events] = await Promise.all([getPerson(id), fetchJSON('people.json'), fetchJSON('places.json'), fetchJSON('events.json')]);
    return { p, people: new Map(people.map((x) => [x.id, x])), places: new Map(places.map((x) => [x.id, x])), events };
  }, [id]);
  const [tab, setTab] = useState('story');
  const p = data?.p;
  useTitle(p?.name || 'Person');
  const evs = useMemo(() => (data ? data.events.filter((e) => e.people.includes(id) || p?.events?.includes(e.id)) : []), [data, id, p]);
  if (loading) return <div className="container page"><Skeleton lines={8} /></div>;
  if (!p) return <div className="container page empty"><h2>Person not found</h2><Link to="/people">All people</Link></div>;
  const name = (pid) => data.people.get(pid)?.l || pid;
  const maxBook = Math.max(1, ...Object.values(p.books || {}));
  const life = [p.born != null && `born ${yearLabel(p.born)}`, p.died != null && `died ${yearLabel(p.died)}`].filter(Boolean).join(' · ')
    || (p.minYear != null ? `appears c. ${yearLabel(p.minYear)}${p.maxYear !== p.minYear && p.maxYear != null ? `–${yearLabel(p.maxYear)}` : ''}` : '');

  return (
    <div className="container page">
      <div className="row" style={{ gap: 18, flexWrap: 'nowrap', alignItems: 'center' }}>
        <Avatar name={p.name} size={72} />
        <div>
          <Link to="/people" className="eyebrow" style={{ textDecoration: 'none', margin: 0 }}>Person</Link>
          <h1 style={{ margin: 0 }}>{p.name}</h1>
          <div className="muted small">{[p.subtitle, life, `${p.verseCount} verses`].filter(Boolean).join(' · ')}</div>
          {p.aka?.length > 0 && <div className="small faint">Also called {p.aka.join(', ')}</div>}
        </div>
      </div>
      <div className="row" style={{ margin: '18px 0 8px', gap: 8 }}>
        <Link className="btn sm" to={`/explore?focus=person:${id}`}><Network size={15} /> See in the graph</Link>
        {id !== 'jesus_905' && <Link className="btn sm" to={`/explore?path=person:${id},person:jesus_905`}><Route size={15} /> How is {p.name.split(' ')[0]} connected to Jesus?</Link>}
      </div>

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <div className="tabs" role="tablist">
            {[['story', 'Story'], ['verses', `Verses (${p.verseCount})`], ['dictionary', "Easton's Dictionary"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === 'story' && (
            <>
              {p.summary ? <div className="prose"><Md text={p.summary} /></div> : <p className="muted">No summary yet. See Easton's Dictionary or the verses.</p>}
              {p.verses?.length > 0 && (
                <>
                  <div className="section-label">First appearances</div>
                  {p.verses.slice(0, 3).map((r) => <KeyVerse key={r} refStr={r} />)}
                </>
              )}
              {evs.length > 0 && (
                <>
                  <div className="section-label">Events in their life</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {evs.map((e) => (
                      <Link key={e.id} to={`/timeline?e=${e.id}`} className="list-item" style={{ padding: '8px 12px', border: '1px solid var(--line)' }}>
                        <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--c-event)' }} />
                        <span style={{ flex: 1 }}>{e.title}</span>
                        <span className="small faint">{yearLabel(e.year)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {tab === 'verses' && (
            <div>
              <p className="small faint">Showing {Math.min(p.verses.length, 80)} of {p.verseCount} verses where {p.name} is named.</p>
              <div className="chips">{p.verses.map((r) => <VerseRef key={r} refStr={r} className="chip" />)}</div>
            </div>
          )}
          {tab === 'dictionary' && (p.easton ? <div className="prose"><Md text={p.easton} /><p className="small faint">From Easton's Bible Dictionary (1897).</p></div> : <p className="muted">No entry.</p>)}
        </div>

        <aside className="sticky-side" style={{ display: 'grid', gap: 16 }}>
          <FamilyTree p={p} name={name} />
          {(p.birthPlace.length > 0 || p.deathPlace.length > 0 || p.groups.length > 0) && (
            <div className="card">
              <dl className="kv">
                {p.birthPlace.length > 0 && <><dt>Born in</dt><dd>{p.birthPlace.map((x) => <Link key={x} className="md-link" to={`/places/${x}`}>{data.places.get(x)?.l || x}</Link>)}</dd></>}
                {p.deathPlace.length > 0 && <><dt>Died in</dt><dd>{p.deathPlace.map((x) => <Link key={x} className="md-link" to={`/places/${x}`}>{data.places.get(x)?.l || x}</Link>)}</dd></>}
                {p.groups.length > 0 && <><dt>Member of</dt><dd>{p.groups.map((g) => g.replace(/^g-/, '').replace(/-/g, ' ')).join(', ')}</dd></>}
              </dl>
            </div>
          )}
          {Object.keys(p.books || {}).length > 0 && (
            <div className="card">
              <div className="section-label" style={{ marginTop: 0 }}>Appears in</div>
              <div style={{ display: 'grid', gap: 7 }}>
                {Object.entries(p.books).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([b, n]) => (
                  <Link key={b} to={`/read/${b}/1`} style={{ textDecoration: 'none' }}>
                    <div className="row small" style={{ gap: 6 }}><span>{bookByOsis(b)?.name}</span><span className="spacer" /><span className="faint">{n}</span></div>
                    <div className="bar"><i style={{ width: `${(n / maxBook) * 100}%` }} /></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FamilyTree({ p, name }) {
  const parents = [...p.father, ...p.mother];
  const peers = [...p.partners.map((x) => ({ id: x, rel: 'spouse' })), ...p.siblings.slice(0, 10).map((x) => ({ id: x, rel: 'sibling' }))];
  if (!parents.length && !peers.length && !p.children.length) return null;
  const Node = ({ id, cls = '' }) => <Link to={`/people/${id}`} className={`fam-node ${cls}`}>{name(id)}</Link>;
  return (
    <div className="card">
      <div className="section-label" style={{ marginTop: 0 }}>Family</div>
      <div className="family">
        {parents.length > 0 && (<><span className="fam-label">Parents</span><div className="family-row">{parents.map((x) => <Node key={x} id={x} />)}</div><span className="faint">│</span></>)}
        <div className="family-row"><span className="fam-node me">{p.name}</span></div>
        {peers.length > 0 && (<><span className="fam-label">Spouses & siblings</span><div className="family-row">{peers.map((x) => <Node key={x.id + x.rel} id={x.id} cls={x.rel === 'spouse' ? 'spouse' : ''} />)}</div></>)}
        {p.children.length > 0 && (<><span className="faint">│</span><span className="fam-label">Children</span><div className="family-row">{p.children.slice(0, 16).map((x) => <Node key={x} id={x} />)}</div></>)}
      </div>
    </div>
  );
}
