import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { fetchJSON } from '../lib/data';
import { ErrorNote, Icon, Skeleton, VerseRef, useAsync, useTitle } from '../components/ui';
import {
  ERAS, FEATURED, FORMAT_ORDER, authorLine, docYear, eraOf, formatInfo, itemCountLabel,
} from '../lib/creedMeta';

export default function Creeds() {
  useTitle('Creeds, Confessions & Catechisms');
  const { data, loading, error } = useAsync(() => fetchJSON('creeds/index.json'), []);
  const [format, setFormat] = useState('all');
  const [q, setQ] = useState('');

  const docs = useMemo(() => data || [], [data]);
  const byId = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d])), [docs]);
  const counts = useMemo(() => {
    const c = {};
    for (const d of docs) c[d.format] = (c[d.format] || 0) + 1;
    return c;
  }, [docs]);
  const formats = useMemo(() => [
    ...FORMAT_ORDER.filter((f) => counts[f]),
    ...Object.keys(counts).filter((f) => !FORMAT_ORDER.includes(f)),
  ], [counts]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (format !== 'all' && d.format !== format) return false;
      if (!t) return true;
      return [d.title, d.location, d.language, ...(d.authors || [])].filter(Boolean).join(' ').toLowerCase().includes(t);
    });
  }, [docs, format, q]);

  const groups = useMemo(() => ERAS.map((era) => ({ era, docs: filtered.filter((d) => eraOf(d.year).id === era.id) })), [filtered]);

  const jump = (id) => {
    const el = document.getElementById(`era-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="container page">
      <header className="cr-intro">
        <span className="eyebrow">Creeds, confessions &amp; catechisms</span>
        <h1>The Faith, Handed Down</h1>
        <p className="lead">
          Christians have always needed short, shared words for what they believe. A <em>creed</em> (from the Latin
          <em> credo</em>, &ldquo;I believe&rdquo;) is a brief summary of the faith, often said aloud in worship.
          A <em>confession</em> is a longer statement in which a church sets out its teaching, chapter by chapter.
          A <em>catechism</em> teaches the same truths as questions and answers, so they can be learned by heart.
        </p>
        <p className="muted">
          Protestants treasure these documents, but they never set them beside the Bible as equals. The Reformers called
          Scripture the <em>norma normans</em>, the &ldquo;norming norm&rdquo; that judges every other teaching, and called
          the creeds <em>norma normata</em>, a &ldquo;normed norm&rdquo; that is trustworthy only where it agrees with
          Scripture. That is why so many of these texts are full of proof texts: each claim points back to the Bible, and you
          are invited to follow it there and test it for yourself, like the Bereans
          of <VerseRef refStr="Acts.17.11">Acts 17:11</VerseRef>.
        </p>
      </header>

      {error && <ErrorNote error={error} />}
      {loading && !data && <div style={{ marginTop: 28 }}><Skeleton lines={6} /></div>}

      {data && (
        <>
          <section aria-labelledby="cr-featured" style={{ marginTop: 34 }}>
            <h2 id="cr-featured" className="section-label">Begin with these four</h2>
            <div className="grid cr-featured-grid">
              {FEATURED.map((f) => {
                const d = byId[f.id];
                if (!d) return null;
                return (
                  <Link key={f.id} to={`/creeds/${d.id}`} className="card link cr-feature">
                    <div className="row" style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <span className="card-icon" style={{ marginBottom: 0, flexShrink: 0 }}><Icon name={f.icon} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="meta">{formatInfo(d.format).label} &middot; {docYear(d)}</div>
                        <h3>{d.title}</h3>
                      </div>
                    </div>
                    <p className="cr-feature-blurb">{f.blurb}</p>
                    <span className="cr-go">{itemCountLabel(d)} <span aria-hidden="true">&middot;</span> Read <ArrowRight size={15} aria-hidden="true" /></span>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="ornament" aria-hidden="true"><Icon name="scroll" size={18} /></div>

          <section aria-labelledby="cr-all">
            <div className="cr-era-head">
              <h2 id="cr-all">All {docs.length} documents</h2>
              <span className="faint small">From the second century to the nineteenth</span>
            </div>

            <div className="cr-tools">
              <div className="chips" role="group" aria-label="Filter by kind of document">
                <button type="button" className={`chip${format === 'all' ? ' on' : ''}`} aria-pressed={format === 'all'} onClick={() => setFormat('all')}>
                  All <span className="cr-count">{docs.length}</span>
                </button>
                {formats.map((f) => (
                  <button key={f} type="button" className={`chip${format === f ? ' on' : ''}`} aria-pressed={format === f} onClick={() => setFormat(f)}>
                    {formatInfo(f).plural} <span className="cr-count">{counts[f]}</span>
                  </button>
                ))}
              </div>
              <label className="cr-search">
                <span className="lp-vh">Filter by title, author or place</span>
                <Search size={16} aria-hidden="true" />
                <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author or place" />
              </label>
            </div>

            <nav className="cr-strip" aria-label="Jump to an era">
              {groups.map(({ era, docs: ds }) => (
                <button key={era.id} type="button" className="cr-era-btn" disabled={!ds.length} onClick={() => jump(era.id)}
                  aria-label={`${era.title}, ${era.range}: ${ds.length} document${ds.length === 1 ? '' : 's'}`}>
                  <b>{era.short}</b>
                  <span>{era.range} &middot; {ds.length}</span>
                  <span className="cr-track" aria-hidden="true">
                    {ds.map((d) => {
                      const x = Math.min(100, Math.max(0, ((d.year - era.from) / (era.to - era.from)) * 100));
                      return <i key={d.id} style={{ left: `${x}%` }} title={`${d.title} (${docYear(d)})`} />;
                    })}
                  </span>
                </button>
              ))}
            </nav>

            {filtered.length === 0 && (
              <div className="empty">
                <p>No documents match that filter.</p>
                <button type="button" className="btn sm" onClick={() => { setQ(''); setFormat('all'); }}>Clear filters</button>
              </div>
            )}

            {groups.filter((g) => g.docs.length).map(({ era, docs: ds }) => (
              <section key={era.id} id={`era-${era.id}`} className="cr-era" aria-labelledby={`era-h-${era.id}`}>
                <div className="cr-era-head">
                  <h2 id={`era-h-${era.id}`}>{era.title}</h2>
                  <span className="badge">{era.range}</span>
                </div>
                <p className="cr-era-blurb">{era.blurb}</p>
                <div className="grid grid-3">
                  {ds.map((d) => <CreedCard key={d.id} d={d} />)}
                </div>
              </section>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function CreedCard({ d }) {
  const who = authorLine(d.authors);
  const where = d.location && d.location !== 'None' ? d.location : '';
  return (
    <Link to={`/creeds/${d.id}`} className="card link cr-card">
      <div className="cr-card-top">
        <span className="badge">{formatInfo(d.format).label}</span>
        <span className="cr-year">{docYear(d)}</span>
      </div>
      <h3>{d.title}</h3>
      {(who || where) && <div className="meta">{[who, where].filter(Boolean).join(' · ')}</div>}
      <div className="meta cr-card-count">
        {itemCountLabel(d)}
        {d.proofCount > 0 && <> &middot; {d.proofCount.toLocaleString()} proof texts</>}
      </div>
    </Link>
  );
}
