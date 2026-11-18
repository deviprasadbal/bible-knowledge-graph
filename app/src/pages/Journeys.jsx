import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Footprints } from 'lucide-react';
import { fetchJSON } from '../lib/data';
import { useStore } from '../lib/store';
import { ErrorNote, Icon, KeyVerse, Skeleton, useAsync, useTitle } from '../components/ui';

const LEVELS = [
  { id: 'first-steps', title: 'First Steps', blurb: 'Short paths for anyone opening the Bible for the first time. No background needed.' },
  { id: 'deeper', title: 'Going Deeper', blurb: 'Longer readings for those ready to linger with harder passages and bigger questions.' },
];

function doneCount(progress, steps) {
  if (!progress || !steps?.length) return 0;
  return Object.keys(progress).filter((k) => progress[k] && +k >= 0 && +k < steps.length).length;
}

export default function Journeys() {
  useTitle('Guided Journeys');
  const { data, loading, error } = useAsync(() => fetchJSON('journeys.json'), []);
  const journeys = useMemo(() => (Array.isArray(data) ? data.filter((j) => j?.id) : []), [data]);
  const progress = useStore((s) => s.journeys);

  const groups = useMemo(() => {
    const known = LEVELS.map((l) => ({ ...l, items: journeys.filter((j) => j.level === l.id) }));
    const other = journeys.filter((j) => !LEVELS.some((l) => l.id === j.level));
    if (other.length) known.push({ id: 'more', title: 'More Journeys', blurb: '', items: other });
    return known.filter((g) => g.items.length);
  }, [journeys]);

  const started = journeys.filter((j) => doneCount(progress[j.id], j.steps) > 0);
  const finished = started.filter((j) => doneCount(progress[j.id], j.steps) >= (j.steps?.length || Infinity));

  return (
    <div className="container page">
      <header className="narrow">
        <span className="eyebrow">Guided reading</span>
        <h1>Journeys</h1>
        <p className="lead">
          A journey is a short path through Scripture, chosen and explained step by step. Read a passage, see what to
          notice, and pause to reflect before moving on. Your progress is kept on this device only.
        </p>
      </header>

      {error && <ErrorNote error={error} />}
      {loading && !data && <div style={{ marginTop: 28 }}><Skeleton lines={6} /></div>}

      {!loading && !error && journeys.length === 0 && <ComingSoon />}

      {journeys.length > 0 && started.length > 0 && (
        <p className="small muted jr-summary">
          <Footprints size={15} aria-hidden="true" />
          {summaryLine(finished.length, started.length - finished.length)}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.id} className="jr-group" aria-labelledby={`jr-${g.id}`}>
          <div className="cr-era-head">
            <h2 id={`jr-${g.id}`}>{g.title}</h2>
            <span className="badge">{g.items.length} {g.items.length === 1 ? 'journey' : 'journeys'}</span>
          </div>
          {g.blurb && <p className="cr-era-blurb">{g.blurb}</p>}
          <div className="grid grid-3">
            {g.items.map((j) => <JourneyCard key={j.id} j={j} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

const plural = (n) => `${n} ${n === 1 ? 'journey' : 'journeys'}`;
function summaryLine(done, going) {
  if (done && going) return `You have finished ${plural(done)}, with ${going} more under way.`;
  if (done) return `You have finished ${plural(done)}.`;
  return `You have ${plural(going)} under way.`;
}

function JourneyCard({ j }) {
  const progress = useStore((s) => s.journeys[j.id]);
  const steps = j.steps || [];
  const done = doneCount(progress, steps);
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const complete = steps.length > 0 && done >= steps.length;
  return (
    <Link to={`/journeys/${j.id}`} className="card link jr-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="card-icon"><Icon name={j.icon} /></span>
        {complete && <span className="badge jr-badge"><Check size={12} aria-hidden="true" /> Completed</span>}
        {!complete && done > 0 && <span className="badge">In progress</span>}
      </div>
      <h3>{j.title}</h3>
      {j.subtitle && <p className="muted small" style={{ margin: 0 }}>{j.subtitle}</p>}
      <div className="jr-card-foot">
        <div className="jr-meta">
          <span>{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
          {j.minutes ? <span><Clock size={13} aria-hidden="true" /> About {j.minutes} min</span> : null}
          {done > 0 && <span className="jr-done">{done} of {steps.length} read</span>}
        </div>
        <div className="bar" role="progressbar" aria-label={`${j.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}

function ComingSoon() {
  return (
    <div className="jr-soon">
      <div className="ornament" aria-hidden="true"><Icon name="compass" size={18} /></div>
      <h2>Journeys are being prepared</h2>
      <p className="muted">
        Guided paths through the Bible&rsquo;s big story, the life of Jesus, the Psalms of lament and more are being
        written with care. Until they are ready, you can begin reading on your own.
      </p>
      <div className="jr-soon-verse"><KeyVerse refStr="Ps.119.105" /></div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <Link className="btn primary" to="/start">New here? Start here</Link>
        <Link className="btn" to="/read/John/1">Read the Gospel of John</Link>
      </div>
    </div>
  );
}
