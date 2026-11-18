import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookText, Feather, Info, ScrollText } from 'lucide-react';
import { fetchJSON } from '../lib/data';
import { Skeleton, VerseRef, useAsync, useLookup, useTitle } from '../components/ui';

const PP_KEY = 'lamplight.pp';
function readPP() {
  try {
    const raw = localStorage.getItem(PP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v?.stage === 'number' ? v : null;
  } catch {
    return null;
  }
}

export default function Library() {
  useTitle('Library');
  const { data: pp, loading } = useAsync(() => fetchJSON('library/pilgrims-progress.json'), []);
  const creeds = useLookup('creeds/index.json');
  const stats = useLookup('stats.json');
  const saved = useMemo(() => readPP(), []);
  const resume = pp && saved && (saved.stage === -1 || pp.stages?.[saved.stage]) ? saved : null;
  const resumeTitle = resume ? (resume.stage === -1 ? 'The Author’s Apology' : pp.stages[resume.stage].title) : '';

  return (
    <div className="container page">
      <header className="narrow">
        <span className="eyebrow">The Library</span>
        <h1>Books for the Road</h1>
        <p className="lead">
          Beside the Bible, Christians have long kept a few other books close: summaries of the faith to learn by heart,
          a dictionary for unfamiliar words, and stories that show what faith looks like on a long journey.
        </p>
        <p className="muted">
          They are offered here as companions to Scripture, not substitutes for it. Each one points beyond itself, back to
          the Book it serves.
        </p>
      </header>

      <section aria-label="The Pilgrim's Progress" style={{ marginTop: 34 }}>
        <Link to="/library/pilgrims-progress" className="card link lib-feature">
          <div className="lib-cover" aria-hidden="true">
            <svg viewBox="0 0 120 160" role="presentation">
              <rect x="6" y="6" width="108" height="148" rx="6" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".55" />
              <path d="M20 128 C 40 118, 52 132, 64 116 S 92 98, 100 74" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 5" />
              <path d="M88 60 l12 -22 l12 22 z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <circle cx="100" cy="30" r="5" fill="currentColor" opacity=".8" />
              <circle cx="20" cy="128" r="3.2" fill="currentColor" />
            </svg>
          </div>
          <div className="lib-feature-body">
            <span className="eyebrow">An allegory &middot; {pp?.year || 1678}</span>
            <h2>{pp?.title || 'The Pilgrim’s Progress'}</h2>
            <p className="lib-sub">{pp?.subtitle || 'From This World to That Which Is to Come'}</p>
            <div className="meta" style={{ marginBottom: 12 }}>
              {pp?.author || 'John Bunyan'}
              {pp?.stages?.length ? <> &middot; {pp.stages.length} stages, with Bunyan&rsquo;s Scripture notes</> : null}
            </div>
            {loading && !pp ? <Skeleton lines={3} /> : <p className="muted">{pp?.about}</p>}
            <span className="cr-go">
              {resume ? <>Continue: {resumeTitle}</> : <>Begin the journey</>}
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>

      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Link to="/creeds" className="card link lib-card">
          <span className="card-icon"><ScrollText size={20} strokeWidth={1.7} /></span>
          <h3>Creeds &amp; Confessions</h3>
          <p className="muted small">
            {creeds?.length ? `${creeds.length} historic` : 'Historic'} creeds, confessions and catechisms, from the early church
            rules of faith to the Westminster and Heidelberg catechisms, with their Scripture proofs.
          </p>
          <span className="cr-go">Browse <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
        <Link to="/dictionary" className="card link lib-card">
          <span className="card-icon"><BookText size={20} strokeWidth={1.7} /></span>
          <h3>Easton&rsquo;s Bible Dictionary</h3>
          <p className="muted small">
            {stats?.dictionary ? `${stats.dictionary.toLocaleString()} entries` : 'Thousands of entries'} on the people, places,
            customs and words of the Bible, from Matthew George Easton&rsquo;s classic of 1897.
          </p>
          <span className="cr-go">Look something up <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
        <Link to="/about" className="card link lib-card">
          <span className="card-icon"><Info size={20} strokeWidth={1.7} /></span>
          <h3>About &amp; Sources</h3>
          <p className="muted small">
            Where every text in Lamplight comes from: public-domain Bibles, open data, and the old books on this shelf,
            with their licenses.
          </p>
          <span className="cr-go">Read the notes <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
      </div>

      <div className="ornament" aria-hidden="true"><Feather size={18} strokeWidth={1.7} /></div>
      <p className="center faint small" style={{ maxWidth: 560, margin: '0 auto' }}>
        &ldquo;Of making many books there is no end&rdquo; (<VerseRef refStr="Eccl.12.12">Ecclesiastes 12:12</VerseRef>, KJV). These few are here because they have
        helped generations of readers find their way back to the one Book that matters most.
      </p>
    </div>
  );
}
