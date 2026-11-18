import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Network, PenLine } from 'lucide-react';
import { books, fetchJSON, THEME_CATEGORIES } from '../lib/data';
import { addJournal, setSetting, useStore } from '../lib/store';
import { Avatar, Icon, KeyVerse, Skeleton, useAsync, useTitle } from '../components/ui';
import { Md } from '../lib/md';

export default function Theme() {
  const { id } = useParams();
  const { data, loading } = useAsync(async () => {
    const [themes, people] = await Promise.all([fetchJSON('themes.json'), fetchJSON('people.json')]);
    return { themes, people: new Map(people.map((p) => [p.id, p])) };
  }, []);
  const t = data?.themes.find((x) => x.id === id);
  useTitle(t?.title || 'Theme');
  const bridgesOn = useStore((s) => s.settings.bridges);
  if (loading) return <div className="container page"><Skeleton lines={8} /></div>;
  if (!t) return <div className="container page empty"><h2>Theme not found</h2><Link to="/themes">All themes</Link></div>;
  const cat = THEME_CATEGORIES.find((c) => c.id === t.category);
  const related = (t.related || []).map((r) => data.themes.find((x) => x.id === r)).filter(Boolean);
  const inBooks = books().filter((b) => b.themes?.includes(t.id));
  return (
    <>
      <section className="theme-hero">
        <div className="container narrow" style={{ maxWidth: 900 }}>
          <Link to="/themes" className="eyebrow" style={{ textDecoration: 'none' }}>{cat?.title || 'Theme'}</Link>
          <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'nowrap' }}>
            <div className="card-icon" style={{ width: 54, height: 54, margin: 0, flexShrink: 0 }}><Icon name={t.icon} size={26} /></div>
            <h1 style={{ margin: 0 }}>{t.title}</h1>
          </div>
          <p className="hook" style={{ marginTop: 18 }}>{t.hook}</p>
        </div>
      </section>
      <div className="container page" style={{ maxWidth: 1100 }}>
        <div className="two-col">
          <article>
            <span className="eyebrow">What Protestants believe</span>
            <div className="prose"><Md text={t.summary} /></div>

            <span className="eyebrow" style={{ marginTop: 34 }}>Thinking it through</span>
            <div className="prose"><Md text={t.philosophy} /></div>

            {t.bridge && bridgesOn && <Bridge b={t.bridge} />}
            {t.bridge && !bridgesOn && (
              <button className="btn sm" style={{ marginTop: 24 }} onClick={() => setSetting('bridges', true)}>Show the Bridges comparison</button>
            )}

            <h2 style={{ marginTop: 40 }}>In the words of Scripture</h2>
            {(t.keyVerses || []).map((r) => <KeyVerse key={r} refStr={r} />)}

            {t.creeds?.length > 0 && (
              <>
                <h2 style={{ marginTop: 40 }}>As the churches have confessed it</h2>
                <p className="muted small">Protestant creeds and catechisms sum up what they believe Scripture teaches. They are always held as subordinate to the Bible itself.</p>
                {t.creeds.map((c) => <CreedQuote key={c.creed + c.item} c={c} />)}
              </>
            )}

            <Reflect t={t} />
          </article>

          <aside className="sticky-side" style={{ display: 'grid', gap: 16 }}>
            <Link to={`/explore?focus=theme:${t.id}`} className="btn" style={{ justifyContent: 'center' }}><Network size={16} /> See this theme in the graph</Link>
            {related.length > 0 && (
              <div className="card">
                <div className="section-label" style={{ marginTop: 0 }}>Related themes</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {related.map((r) => (
                    <Link key={r.id} to={`/themes/${r.id}`} className="list-item" style={{ padding: '8px 10px' }}>
                      <Icon name={r.icon} size={18} style={{ color: 'var(--gold)' }} />
                      <span><b>{r.title}</b><div className="small faint">{r.hook}</div></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {t.people?.length > 0 && (
              <div className="card">
                <div className="section-label" style={{ marginTop: 0 }}>Seen in the lives of</div>
                {t.people.map((p) => {
                  const pp = data.people.get(p);
                  return pp ? (
                    <Link key={p} to={`/people/${p}`} className="list-item" style={{ padding: '6px 8px' }}>
                      <Avatar name={pp.l} size={32} /><span>{pp.l}</span>
                    </Link>
                  ) : null;
                })}
              </div>
            )}
            {inBooks.length > 0 && (
              <div className="card">
                <div className="section-label" style={{ marginTop: 0 }}>Books that explore this</div>
                <div className="chips">
                  {inBooks.map((b) => <Link key={b.osis} to={`/read/${b.osis}/1`} className="chip">{b.name}</Link>)}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function Bridge({ b }) {
  return (
    <section className="bridge" style={{ marginTop: 36 }} aria-label="Bridges: a comparison with Hindu thought">
      <span className="eyebrow" style={{ color: 'var(--c-theme)' }}>Bridges · {b.tradition}</span>
      <h3 style={{ fontSize: '1.6rem' }}>{b.concept}</h3>
      <div className="bridge-cols">
        <div>
          <h4 style={{ color: 'var(--c-place)' }}>Where they resonate</h4>
          <div className="prose" style={{ fontSize: '.98rem' }}><Md text={b.resonance} /></div>
        </div>
        <div>
          <h4 style={{ color: 'var(--accent)' }}>Where they part ways</h4>
          <div className="prose" style={{ fontSize: '.98rem' }}><Md text={b.difference} /></div>
        </div>
      </div>
      {b.invitation && <p className="serif" style={{ fontStyle: 'italic', fontSize: '1.2rem', margin: '14px 0 0' }}>{b.invitation}</p>}
      <p className="small faint" style={{ margin: '12px 0 0' }}>
        Bridges notes compare ideas fairly and respectfully. They don't claim the traditions are the same, and they don't rank them.
      </p>
    </section>
  );
}

function CreedQuote({ c }) {
  const { data } = useAsync(() => fetchJSON(`creeds/${c.creed}.json`), [c.creed]);
  if (!data) return <Skeleton lines={2} />;
  const item = c.item ? data.content.find((x) => String(x.n) === String(c.item)) : data.content[0];
  if (!item) return null;
  const text = item.text || item.sections?.map((s) => s.text).join(' ') || '';
  const isQ = /Catechism/.test(data.format) || item.title?.endsWith('?');
  return (
    <Link to={`/creeds/${c.creed}${c.item ? `?item=${c.item}` : ''}`} className="keyverse" style={{ borderLeftColor: 'var(--c-creed)' }}>
      {isQ && item.title && <p style={{ fontWeight: 600, fontFamily: 'var(--font-ui)', fontSize: '.95rem' }}>{item.title}</p>}
      <p>{text.length > 480 ? text.slice(0, 470) + '…' : text}</p>
      <b style={{ color: 'var(--c-creed)' }}>{c.label || data.title} <ArrowRight size={12} /></b>
    </Link>
  );
}

function Reflect({ t }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [prompt, setPrompt] = useState(t.reflect?.[0] || '');
  if (!t.reflect?.length) return null;
  return (
    <section style={{ marginTop: 40 }} className="panel">
      <span className="eyebrow">Pause and reflect</span>
      <ul className="reflect" style={{ paddingLeft: 18, margin: '8px 0 14px' }}>
        {t.reflect.map((q) => (
          <li key={q}><button className="btn ghost" style={{ padding: 0, textAlign: 'left', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: q === prompt ? 600 : 400 }} onClick={() => setPrompt(q)}>{q}</button></li>
        ))}
      </ul>
      <textarea className="input" placeholder={`Write your thoughts on: ${prompt}`} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm gold" disabled={!text.trim()} onClick={() => { addJournal(text, `${t.title}: ${prompt}`); setText(''); setSaved(true); }}><PenLine size={14} /> Save to my journal</button>
        {saved && <span className="small faint">Saved privately on this device. <Link to="/my" className="md-link">Open journal</Link></span>}
      </div>
    </section>
  );
}
