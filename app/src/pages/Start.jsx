import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { books, fetchJSON, formatRef, refLink } from '../lib/data';
import { setSetting, useStore } from '../lib/store';
import { Skeleton, useAsync, useTitle, VerseRef } from '../components/ui';
import { Md } from '../lib/md';

export default function Start() {
  useTitle('Start Here');
  const { data, loading } = useAsync(() => fetchJSON('intro.json'), []);
  const bridges = useStore((s) => s.settings.bridges);
  const [q, setQ] = useState('');
  const gloss = useMemo(() => (data?.glossary || []).filter((g) => !q || (g.term + g.definition).toLowerCase().includes(q.toLowerCase())), [data, q]);
  const starters = books().filter((b) => b.startHere);
  if (loading) return <div className="container page"><Skeleton lines={8} /></div>;
  const sections = data?.sections || [];
  return (
    <div className="container page">
      <div className="two-col">
        <div>
          <span className="eyebrow">Start here</span>
          <h1>A first look at the Bible</h1>
          <p className="lead">What the Bible is, how Protestant Christians read it, and how to find your way around this graph. Read it in ten minutes, or come back to it any time.</p>

          {sections.map((s) => (
            <section key={s.id} id={s.id} style={{ marginTop: 40, scrollMarginTop: 90 }}>
              <h2>{s.title}</h2>
              <div className="prose"><Md text={s.body} /></div>
              {s.refs?.length > 0 && (
                <div className="chips" style={{ marginTop: 8 }}>
                  {s.refs.map((r) => <VerseRef key={r} refStr={r} className="chip" />)}
                </div>
              )}
            </section>
          ))}

          {starters.length > 0 && (
            <section style={{ marginTop: 44 }}>
              <h2>Good places to begin reading</h2>
              <div className="grid grid-2" style={{ marginTop: 12 }}>
                {starters.map((b) => (
                  <Link key={b.osis} to={`/read/${b.osis}/1`} className="card link">
                    <h3>{b.name}</h3>
                    <p className="small muted" style={{ margin: '0 0 6px' }}>{b.oneLine}</p>
                    {b.readingTip && <p className="small" style={{ margin: 0 }}>{b.readingTip}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section id="glossary" style={{ marginTop: 44, scrollMarginTop: 90 }}>
            <h2>Glossary</h2>
            <p className="muted">Words you'll meet often, in plain English.</p>
            <input className="input" placeholder="Filter terms…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360, marginBottom: 14 }} />
            <dl style={{ margin: 0 }}>
              {gloss.map((g) => (
                <div key={g.term} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <dt className="serif" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{g.term}</dt>
                  <dd style={{ margin: '2px 0 0' }} className="muted">{g.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="sticky-side">
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>On this page</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {sections.map((s) => <a key={s.id} href={`#/start`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="md-link small" style={{ border: 0 }}>{s.title}</a>)}
              <a href="#/start" onClick={(e) => { e.preventDefault(); document.getElementById('glossary')?.scrollIntoView({ behavior: 'smooth' }); }} className="md-link small" style={{ border: 0 }}>Glossary</a>
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}>The Bridges lens</div>
            <p className="small muted">Theme pages can include a short, honest comparison with ideas from Hindu philosophy: where they resonate, and where they truly differ.</p>
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={bridges} onChange={(e) => setSetting('bridges', e.target.checked)} />
              Show Bridges on theme pages
            </label>
          </div>
          {data?.storyActs?.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-label" style={{ marginTop: 0 }}>The story in {data.storyActs.length} acts</div>
              <ol style={{ margin: 0, paddingLeft: 18 }} className="small">
                {data.storyActs.map((a) => <li key={a.act} style={{ marginBottom: 4 }}><Link className="md-link" to={refLink(a.ref)}>{a.title}</Link> <span className="faint">· {formatRef(a.ref, true)}</span></li>)}
              </ol>
            </div>
          )}
          <Link to="/themes" className="btn gold" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>Explore the Big Questions <ArrowRight size={15} /></Link>
        </aside>
      </div>
    </div>
  );
}
