import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock, NotebookPen, RotateCcw } from 'lucide-react';
import { fetchJSON, formatRef, refLink, refVerses, stripMd } from '../lib/data';
import { addJournal, setSetting, toggleJourneyStep, update, useStore } from '../lib/store';
import { ErrorNote, Icon, KeyVerse, Skeleton, Toast, useAsync, useTitle } from '../components/ui';
import { Md } from '../lib/md';

const LEVEL_TITLES = { 'first-steps': 'First Steps', deeper: 'Going Deeper' };
const MAX_VERSES = 40;
// The KJV text marks translators' supplied words as _italic_; show them as the printed KJV does.
const kjvInline = (t) => String(t).split(/_([^_]+)_/g).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));

export default function Journey() {
  const { id } = useParams();
  const { data, loading, error } = useAsync(() => fetchJSON('journeys.json'), []);
  const list = Array.isArray(data) ? data : [];
  const j = list.find((x) => x?.id === id);
  useTitle(j?.title || 'Journey');

  if (loading && !data) return <div className="container page narrow"><Skeleton lines={8} /></div>;
  if (error) return <div className="container page"><ErrorNote error={error} /></div>;
  if (!j) {
    return (
      <div className="container page empty">
        <div className="ornament" aria-hidden="true"><Icon name="compass" size={18} /></div>
        <h2>{list.length ? 'We couldn’t find that journey' : 'Journeys are being prepared'}</h2>
        <p>{list.length ? 'The link may be mistyped, or the journey may have been renamed.' : 'Guided reading paths are still being written. Please come back soon.'}</p>
        <Link className="btn" to="/journeys"><ArrowLeft size={16} /> All journeys</Link>
      </div>
    );
  }
  return <JourneyView key={id} j={j} />;
}

function JourneyView({ j }) {
  const steps = j.steps || [];
  const n = steps.length;
  const progress = useStore((s) => s.journeys[j.id]);
  const done = progress || {};
  const doneCount = steps.filter((_, i) => done[i]).length;
  const allDone = n > 0 && doneCount >= n;
  const [params, setParams] = useSearchParams();
  const [initialStep] = useState(() => {
    const first = steps.findIndex((_, i) => !done[i]);
    return first >= 0 ? first : 0;
  });
  const raw = params.get('step');
  const parsed = raw != null ? parseInt(raw, 10) : NaN;
  const cur = Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), Math.max(0, n - 1)) : initialStep;
  const step = steps[cur];
  const headRef = useRef();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const el = headRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [cur]);

  const go = useCallback((i) => {
    setParams((p) => { const next = new URLSearchParams(p); next.set('step', String(i)); return next; }, { replace: true });
  }, [setParams]);

  const markAndContinue = () => {
    if (!done[cur]) toggleJourneyStep(j.id, cur);
    if (cur < n - 1) go(cur + 1);
  };
  const reset = () => {
    if (window.confirm(`Clear your progress on “${j.title}”? Your journal entries will be kept.`)) {
      update((s) => { delete s.journeys[j.id]; });
      go(0);
    }
  };
  const pct = n ? Math.round((doneCount / n) * 100) : 0;

  return (
    <div className="container page">
      <Link to="/journeys" className="lp-back"><ArrowLeft size={15} /> All journeys</Link>
      <header className="jr-head">
        <span className="card-icon jr-head-icon"><Icon name={j.icon} size={24} /></span>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{LEVEL_TITLES[j.level] || 'Journey'}</span>
          <h1>{j.title}</h1>
          {j.subtitle && <p className="lead">{j.subtitle}</p>}
          <div className="jr-meta" style={{ marginTop: 10 }}>
            <span>{n} {n === 1 ? 'step' : 'steps'}</span>
            {j.minutes ? <span><Clock size={13} aria-hidden="true" /> About {j.minutes} min</span> : null}
            <span>{doneCount} of {n} read</span>
          </div>
          <div className="bar jr-head-bar" role="progressbar" aria-label="Journey progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {n === 0 ? (
        <div className="empty"><p>The steps for this journey are still being written.</p></div>
      ) : (
        <div className="two-col jr-layout">
          <article className="jr-main" aria-labelledby="jr-step-title">
            <header className="jr-step-head" ref={headRef}>
              <span className="eyebrow">Step {cur + 1} of {n}{done[cur] ? ' · read' : ''}</span>
              <h2 id="jr-step-title">{step.title}</h2>
              <Link className="md-link jr-ref" to={refLink(step.ref)}><BookOpen size={15} aria-hidden="true" /> {formatRef(step.ref)}</Link>
            </header>

            {step.note && (
              <div className="panel jr-note">
                <div className="section-label" style={{ marginTop: 0 }}>What to notice</div>
                <Md text={step.note} />
              </div>
            )}

            <Passage refStr={step.ref} />

            <Reflect key={cur} j={j} step={step} />

            <div className="jr-actions">
              <button type="button" className="btn ghost" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Previous step">
                <ChevronLeft size={16} /> <span className="jr-hide-sm">Previous</span>
              </button>
              {done[cur] ? (
                <button type="button" className="btn" aria-pressed="true" onClick={() => toggleJourneyStep(j.id, cur)}>
                  <Check size={16} /> Marked as read <span className="faint small">&middot; undo</span>
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={markAndContinue}>
                  <Check size={16} /> Mark as read{cur < n - 1 && <span className="jr-hide-sm">&nbsp;and continue</span>}
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => go(cur + 1)} disabled={cur >= n - 1} aria-label="Next step">
                <span className="jr-hide-sm">Next</span> <ChevronRight size={16} />
              </button>
            </div>

            {allDone && (
              <div className="jr-complete" role="status">
                <span className="card-icon"><Icon name="sunrise" /></span>
                <h3>You have walked the whole path</h3>
                <p className="muted">
                  Every step of &ldquo;{j.title}&rdquo; is read. Before you move on, sit for a moment with this promise.
                </p>
                <KeyVerse refStr="Isa.55.11" />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <Link className="btn" to="/journeys">Choose another journey <ArrowRight size={15} /></Link>
                  <Link className="btn ghost" to="/my">Open my journal</Link>
                </div>
              </div>
            )}
          </article>

          <aside className="sticky-side jr-side" aria-label="Steps in this journey">
            <div className="section-label" style={{ marginTop: 0 }}>The path</div>
            <ol className="jr-steps">
              {steps.map((s, i) => (
                <li key={i} className={`jr-step${i === cur ? ' current' : ''}`}>
                  <button
                    type="button" className="jr-check" aria-pressed={!!done[i]}
                    aria-label={`${done[i] ? 'Mark as unread' : 'Mark as read'}: step ${i + 1}, ${s.title}`}
                    onClick={() => toggleJourneyStep(j.id, i)}
                  >
                    {done[i] ? <Check size={15} strokeWidth={2.4} /> : <span aria-hidden="true">{i + 1}</span>}
                  </button>
                  <button type="button" className="jr-step-btn" aria-current={i === cur ? 'step' : undefined} onClick={() => go(i)}>
                    <b>{s.title}</b>
                    <small>{formatRef(s.ref)}</small>
                  </button>
                </li>
              ))}
            </ol>
            {doneCount > 0 && (
              <button type="button" className="btn ghost sm jr-reset" onClick={reset}><RotateCcw size={14} /> Start over</button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Passage({ refStr }) {
  const setting = useStore((s) => s.settings.translation);
  const fontScale = useStore((s) => s.settings.fontScale) || 1;
  const tr = setting === 'kjv' ? 'kjv' : 'bsb';
  const { data, loading, error } = useAsync(() => refVerses(refStr, tr, MAX_VERSES + 1), [refStr, tr]);
  const verses = (data || []).slice(0, MAX_VERSES);
  const more = (data || []).length > MAX_VERSES;
  const multiCh = new Set(verses.map((v) => v.c)).size > 1;
  return (
    <section className="jr-passage-wrap" aria-label={`Passage: ${formatRef(refStr)}`}>
      <div className="jr-passage-bar">
        <span className="section-label" style={{ margin: 0 }}>The passage</span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Translation">
          <button type="button" className={tr === 'bsb' ? 'on' : ''} aria-pressed={tr === 'bsb'} onClick={() => setSetting('translation', 'bsb')}>BSB</button>
          <button type="button" className={tr === 'kjv' ? 'on' : ''} aria-pressed={tr === 'kjv'} onClick={() => setSetting('translation', 'kjv')}>KJV</button>
        </div>
      </div>
      {loading && !data ? <Skeleton lines={5} /> : error || !verses.length ? (
        <p className="small faint">This passage could not be loaded here. <Link className="md-link" to={refLink(refStr)}>Open it in the reader</Link>.</p>
      ) : (
        <div className="jr-passage" style={{ '--fs': fontScale }}>
          {verses.map((v, i) => (
            <Fragment key={v.ref}>
              {multiCh && (i === 0 || verses[i - 1].c !== v.c) && <span className="jr-ch">Chapter {v.c}</span>}
              <span className="jr-v"><sup>{v.v}</sup>{kjvInline(stripMd(v.text))}{' '}</span>
            </Fragment>
          ))}
          {more && <span className="faint">&hellip;</span>}
        </div>
      )}
      <div className="jr-passage-foot">
        <span className="small faint">{formatRef(refStr)} &middot; {tr === 'kjv' ? 'King James Version' : 'Berean Standard Bible'}{more ? ` · first ${MAX_VERSES} verses shown` : ''}</span>
        <Link className="btn sm" to={refLink(refStr)}>Continue in reader <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}

function Reflect({ j, step }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const clear = useCallback(() => setMsg(''), []);
  const save = () => {
    const t = text.trim();
    if (!t) return;
    addJournal(t, `Journey: ${j.title} — ${step.title}`);
    setText('');
    setMsg('Saved to your journal');
  };
  return (
    <section className="jr-reflect" aria-labelledby="jr-reflect-h">
      <h3 id="jr-reflect-h"><NotebookPen size={18} aria-hidden="true" /> Reflect</h3>
      <label htmlFor="jr-reflect-text" className="muted small">
        What stays with you from this passage? A question, a phrase, a prayer: a sentence or two is enough.
      </label>
      <textarea
        id="jr-reflect-text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Write freely. It stays on this device."
      />
      <div className="row">
        <button type="button" className="btn sm primary" onClick={save} disabled={!text.trim()}>Save to journal</button>
        <Link className="small md-link" to="/my">See my journal</Link>
      </div>
      <Toast msg={msg} onDone={clear} />
    </section>
  );
}
