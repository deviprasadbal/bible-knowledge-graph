import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Feather, X } from 'lucide-react';
import { fetchJSON, formatRef, refVerses, stripMd } from '../lib/data';
import { useStore } from '../lib/store';
import { ErrorNote, Skeleton, VerseRef, useAsync, useTitle } from '../components/ui';

const PP_KEY = 'lamplight.pp'; // { stage: number (-1 = The Author's Apology), t: timestamp }
const BASE = '/library/pilgrims-progress';
const APOLOGY_TITLE = 'The Author’s Apology for His Book';

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(PP_KEY) || 'null');
    return typeof v?.stage === 'number' ? v.stage : null;
  } catch {
    return null;
  }
}
function saveStage(stage) {
  try {
    localStorage.setItem(PP_KEY, JSON.stringify({ stage, t: Date.now() }));
  } catch {
    /* private mode: nothing to remember */
  }
}
const stageHref = (s) => `${BASE}?stage=${s === -1 ? 'apology' : s}`;

// Bunyan's speaker abbreviations, expanded for a tooltip.
const SPEAKERS = {
  'CHR.': 'Christian', 'HOPE.': 'Hopeful', 'FAITH.': 'Faithful', 'IGNOR.': 'Ignorance', 'TALK.': 'Talkative', 'PLI.': 'Pliable',
  'EVAN.': 'Evangelist', 'INTER.': 'The Interpreter', 'BY-ENDS.': 'Mr. By-ends', 'WORLD.': 'Mr. Worldly Wiseman',
  'GOOD-WILL.': 'Good-will', 'APOL.': 'Apollyon', 'PIETY.': 'Piety', 'SHEP.': 'The Shepherds', 'CHAR.': 'Charity',
  'OBST.': 'Obstinate', 'POR.': 'The Porter', 'PRUD.': 'Prudence', 'FORM.': 'Formalist', 'DEMAS.': 'Demas',
  'ATHEIST.': 'Atheist', 'JUDGE.': 'The Judge', 'MONEY-LOVE.': 'Mr. Money-love', 'HELP.': 'Help', 'ENVY.': 'Envy',
  'SAVE-ALL.': 'Mr. Save-all', 'SUPER.': 'Superstition', 'PICK.': 'Pickthank', 'HOLD-THE-WORLD.': 'Mr. Hold-the-world',
};
const SPEAKER_RE = /^([A-Z][A-Z-]+(?: [A-Z][A-Z-]+)*\.)\s+/;
const MARK_RE = /⟦(\d+)⟧/g;

function parseParagraph(p, counter) {
  let t = String(p.t || '').replace(/--/g, '—');
  let speaker = null;
  const m = SPEAKER_RE.exec(t);
  if (m) {
    speaker = m[1];
    t = t.slice(m[0].length);
  }
  const plain = t.replace(MARK_RE, '').trim();
  // Bunyan's marginal glosses ("Christian's choice") arrive as short unpunctuated paragraphs.
  const note = !speaker && plain.length > 0 && plain.length < 90 && !/[.?!:;,"'’”—)\]]$/.test(plain);
  const segs = [];
  let last = 0;
  let k;
  MARK_RE.lastIndex = 0;
  while ((k = MARK_RE.exec(t))) {
    if (k.index > last) segs.push(t.slice(last, k.index));
    const mi = +k[1];
    const refs = (p.r?.[mi] || []).filter(Boolean);
    if (refs.length) segs.push({ mi, num: ++counter.n, refs });
    last = MARK_RE.lastIndex;
  }
  if (last < t.length) segs.push(t.slice(last));
  return { speaker, note, segs, plain };
}

export default function Pilgrim() {
  const { data, loading, error } = useAsync(() => fetchJSON('library/pilgrims-progress.json'), []);
  useTitle(data?.title || 'The Pilgrim’s Progress');
  if (loading && !data) return <div className="container page narrow"><Skeleton lines={10} /></div>;
  if (error || !data) return <div className="container page"><ErrorNote error={error} /></div>;
  return <PilgrimReader book={data} />;
}

function PilgrimReader({ book }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('stage');
  const stages = useMemo(() => book.stages || [], [book]);
  const hasApology = (book.apology || []).length > 0;
  const total = stages.length;
  const valid = (s) => s != null && ((s === -1 && hasApology) || (s >= 0 && s < total));
  const parse = (v) => {
    if (v == null) return null;
    if (v === 'apology' || v === '-1') return hasApology ? -1 : 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(Math.max(0, n), Math.max(0, total - 1)) : 0;
  };
  // With no ?stage= in the URL, open where this reader last left off.
  const savedStage = raw == null ? readSaved() : null;
  const resumeStage = valid(savedStage) && savedStage !== 0 ? savedStage : null;
  const cur = raw != null ? parse(raw) : resumeStage ?? 0;
  const [resumed, setResumed] = useState(null);
  const fontScale = useStore((s) => s.settings.fontScale) || 1;
  const [tocOpen, setTocOpen] = useState(false);
  const [open, setOpen] = useState(null); // { pi, num }
  const headRef = useRef();
  const firstRender = useRef(true);

  // Keep the URL in step with a resumed stage so it can be shared or bookmarked.
  useEffect(() => {
    if (raw != null || resumeStage == null) return;
    setResumed(resumeStage);
    setParams({ stage: resumeStage === -1 ? 'apology' : String(resumeStage) }, { replace: true });
  }, [raw, resumeStage, setParams]);

  useEffect(() => {
    saveStage(cur);
    setOpen(null);
    setTocOpen(false);
    if (firstRender.current) { firstRender.current = false; return; }
    headRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [cur]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isApology = cur === -1;
  const title = isApology ? APOLOGY_TITLE : stages[cur]?.title || '';
  const source = isApology ? book.apology : stages[cur]?.paragraphs || [];
  const paras = useMemo(() => {
    const counter = { n: 0 };
    return source
      .map((p) => parseParagraph(p, counter))
      .filter((p, i) => !(i === 0 && p.plain.replace(/\.$/, '').toLowerCase() === title.toLowerCase()));
  }, [source, title]);
  const minutes = useMemo(() => {
    const words = paras.reduce((n, p) => n + p.plain.split(/\s+/).length, 0);
    return Math.max(1, Math.round(words / 230));
  }, [paras]);

  const prev = isApology ? null : cur === 0 ? (hasApology ? -1 : null) : cur - 1;
  const next = isApology ? (total ? 0 : null) : cur < total - 1 ? cur + 1 : null;
  const titleOf = (s) => (s === -1 ? 'The Author’s Apology' : stages[s]?.title);
  const firstDrop = paras.findIndex((p) => !p.note);

  return (
    <div className="container page">
      <Link to="/library" className="lp-back"><ArrowLeft size={15} /> Library</Link>
      <header className="pp-head">
        <span className="eyebrow">{book.author} &middot; {book.year}</span>
        <h1>{book.title}</h1>
        <p className="pp-sub">{book.subtitle}</p>
        {cur <= 0 && book.about && <p className="muted pp-about">{book.about}</p>}
      </header>

      <div className="pp-layout">
        <nav className={`pp-toc${tocOpen ? ' open' : ''}`} aria-label="Stages of the journey">
          <button type="button" className="pp-toc-toggle" aria-expanded={tocOpen} aria-controls="pp-toc-list" onClick={() => setTocOpen((o) => !o)}>
            <span>
              <small>Contents</small>
              {isApology ? 'Preface' : `Stage ${cur + 1} of ${total}`}: {title}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          <ol className="pp-toc-list" id="pp-toc-list">
            {hasApology && (
              <li>
                <Link to={stageHref(-1)} aria-current={isApology ? 'page' : undefined} className="pp-toc-apology">
                  <span className="pp-n" aria-hidden="true"><Feather size={14} strokeWidth={1.8} /></span>
                  <span>The Author&rsquo;s Apology <small>Optional preface, in verse</small></span>
                </Link>
              </li>
            )}
            {stages.map((s, i) => (
              <li key={i}>
                <Link to={stageHref(i)} aria-current={cur === i ? 'page' : undefined}>
                  <span className="pp-n">{i + 1}</span>
                  <span>{s.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <article className="pp-main" aria-labelledby="pp-stage-title">
          <header className="pp-stage-head" ref={headRef}>
            <span className="eyebrow">{isApology ? 'Before the story · in verse' : `Stage ${cur + 1} of ${total}`}</span>
            <h2 id="pp-stage-title">{title}</h2>
            <div className="pp-progress">
              {!isApology && (
                <div className="bar" role="progressbar" aria-label="Progress through the book" aria-valuemin={1} aria-valuemax={total} aria-valuenow={cur + 1}>
                  <i style={{ width: `${((cur + 1) / total) * 100}%` }} />
                </div>
              )}
              <span className="small faint">About {minutes} min read</span>
            </div>
          </header>

          {resumed != null && cur === resumed && (
            <p className="panel small pp-resume">
              Welcome back. You are reading from where you left off.{' '}
              <Link className="md-link" to={stageHref(0)}>Start from the beginning</Link>
            </p>
          )}
          {isApology && (
            <p className="small faint pp-intro-note">
              Bunyan opened his book with this playful defence, in rhyming couplets, of teaching truth through a story. Read it
              now, or <Link className="md-link" to={stageHref(0)}>go straight to the dream</Link>.
            </p>
          )}

          <div className={`pp-text${isApology ? ' pp-verse' : ''}`} style={{ '--fs': fontScale }}>
            {paras.map((p, pi) => {
              const openSeg = open?.pi === pi ? p.segs.find((s) => typeof s === 'object' && s.num === open.num) : null;
              const cls = p.note ? 'pp-note' : pi === firstDrop && !p.speaker && /^[A-Za-z]/.test(p.plain) ? 'pp-drop' : undefined;
              return (
                <Fragment key={pi}>
                  <p className={cls}>
                    {p.speaker && <><abbr className="pp-speaker" title={SPEAKERS[p.speaker]}>{p.speaker}</abbr>{' '}</>}
                    {p.segs.map((s, k) => (typeof s === 'string' ? (
                      <Fragment key={k}>{s}</Fragment>
                    ) : (
                      <button
                        key={k} type="button" className={`tag-ref${openSeg === s ? ' on' : ''}`}
                        aria-expanded={openSeg === s} aria-controls={openSeg === s ? `pp-refs-${pi}` : undefined}
                        aria-label={`Scripture note ${s.num}: ${s.refs.map((r) => formatRef(r)).join(', ')}`}
                        onClick={() => setOpen((o) => (o?.pi === pi && o.num === s.num ? null : { pi, num: s.num }))}
                      >
                        {s.num}
                      </button>
                    )))}
                  </p>
                  {openSeg && <RefPanel id={`pp-refs-${pi}`} num={openSeg.num} refs={openSeg.refs} onClose={() => setOpen(null)} />}
                </Fragment>
              );
            })}
          </div>

          {next == null && !isApology && (
            <div className="pp-end">
              <div className="ornament" aria-hidden="true"><Feather size={18} strokeWidth={1.7} /></div>
              <p>Here ends the first part of Bunyan&rsquo;s dream.</p>
              <p className="small faint">
                Six years later, in 1684, Bunyan published a second part, following Christian&rsquo;s wife Christiana and their
                children along the same road.
              </p>
              <Link className="btn" to="/library">Back to the Library</Link>
            </div>
          )}

          <nav className="pp-nav" aria-label="Previous and next stage">
            {prev != null ? (
              <Link className="pp-nav-link" to={stageHref(prev)}>
                <small><ChevronLeft size={13} aria-hidden="true" /> {prev === -1 ? 'Preface' : `Stage ${prev + 1}`}</small>
                <b>{titleOf(prev)}</b>
              </Link>
            ) : <span />}
            {next != null ? (
              <Link className="pp-nav-link next" to={stageHref(next)}>
                <small>{`Stage ${next + 1}`} <ChevronRight size={13} aria-hidden="true" /></small>
                <b>{titleOf(next)}</b>
              </Link>
            ) : <span />}
          </nav>

          <p className="small faint pp-source">
            Text: {book.source}. Bunyan&rsquo;s own Scripture notes appear as numbered tags; open one to read the verses
            in the King James Version.
          </p>
        </article>
      </div>
    </div>
  );
}

function RefPanel({ id, num, refs, onClose }) {
  return (
    <aside id={id} className="pp-refs" aria-label={`Scripture note ${num}`}>
      <div className="pp-refs-head">
        <span>Bunyan&rsquo;s note {num}</span>
        <span className="spacer" />
        <button type="button" className="icon-btn pp-close" onClick={onClose} aria-label="Close note"><X size={16} /></button>
      </div>
      {refs.map((r) => (
        <div key={r} className="pp-ref">
          <VerseRef refStr={r} />
          <KjvVerses refStr={r} max={3} />
        </div>
      ))}
      <div className="pp-refs-foot">King James Version, the translation Bunyan most often quoted.</div>
    </aside>
  );
}

// The KJV text marks translators' supplied words as _italic_; show them as the printed KJV does.
const kjvInline = (t) => String(t).split(/_([^_]+)_/g).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));

function KjvVerses({ refStr, max = 3 }) {
  const { data, loading } = useAsync(() => refVerses(refStr, 'kjv', max + 1), [refStr]);
  if (loading && !data) return <Skeleton lines={2} />;
  if (!data?.length) return null;
  const vs = data.slice(0, max);
  return (
    <p className="scripture">
      {vs.map((v, i) => (
        <span key={v.ref}>
          {vs.length > 1 && <sup className="faint pp-vn">{v.v}</sup>}
          {kjvInline(stripMd(v.text))}
          {i < vs.length - 1 ? ' ' : ''}
        </span>
      ))}
      {data.length > max ? ' \u2026' : ''}
    </p>
  );
}
