import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CalendarClock, Library, Map as MapIcon, Network, Route, ScrollText, Users,
} from 'lucide-react';
import { fetchJSON, formatRef, refLink, THEME_CATEGORIES } from '../lib/data';
import { useStore } from '../lib/store';
import { Icon, useAsync, useTitle, VerseText } from '../components/ui';
import { Md } from '../lib/md';

function Constellation() {
  const ref = useRef();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w, h, raf;
    const N = Math.min(70, Math.floor(window.innerWidth / 18));
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025, r: Math.random() * 1.8 + 0.6 }));
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      const cs = getComputedStyle(document.documentElement);
      const gold = cs.getPropertyValue('--gold').trim();
      const line = cs.getPropertyValue('--line-2').trim();
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; }
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i]; const b = pts[j];
          const dx = (a.x - b.x) * w; const dy = (a.y - b.y) * h;
          const d = Math.hypot(dx, dy);
          if (d < 140) {
            ctx.globalAlpha = (1 - d / 140) * 0.5;
            ctx.strokeStyle = line;
            ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = gold;
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

const EXPLORE = [
  { to: '/explore', icon: Network, title: 'The Knowledge Graph', text: 'Thousands of people, places, events and ideas, and how they connect. Find the chain that links any two.' },
  { to: '/read', icon: BookOpen, title: 'Read & Reflect', text: 'A calm reader with two translations. Tap a verse to see its echoes across Scripture.' },
  { to: '/places', icon: MapIcon, title: 'Map of the Bible', text: 'Over a thousand places, from Ur to Rome, plotted and linked to every verse.' },
  { to: '/timeline', icon: CalendarClock, title: 'Timeline', text: 'Five hundred events from Creation to the early Church, in order.' },
  { to: '/people', icon: Users, title: 'People', text: 'Family trees, life stories and every verse, for more than 3,000 people.' },
  { to: '/creeds', icon: ScrollText, title: 'Creeds & Confessions', text: 'How Protestants have summed up the faith, from the Apostles’ Creed to Westminster.' },
  { to: '/journeys', icon: Route, title: 'Guided Journeys', text: 'Short reading paths for first-time readers and deep thinkers.' },
  { to: '/library', icon: Library, title: 'Library', text: 'The Pilgrim’s Progress, Easton’s Bible Dictionary and more classics.' },
];

export default function Home() {
  useTitle('');
  const { data } = useAsync(async () => {
    const [stats, votd, themes, intro, journeys] = await Promise.all([
      fetchJSON('stats.json'), fetchJSON('votd.json'), fetchJSON('themes.json'), fetchJSON('intro.json'), fetchJSON('journeys.json'),
    ]);
    return { stats, votd, themes, intro, journeys };
  }, []);
  const tr = useStore((s) => s.settings.translation);
  const today = useMemo(() => {
    if (!data?.votd?.length) return null;
    const d = new Date();
    const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    return data.votd[(day * 37) % data.votd.length];
  }, [data]);
  const s = data?.stats;
  const bigQ = (data?.themes || []).filter((t) => t.category === 'big-questions').slice(0, 9);
  const acts = data?.intro?.storyActs || [];
  const firstJourneys = (data?.journeys || []).slice(0, 4);

  return (
    <>
      <section className="hero">
        <Constellation />
        <div className="hero-glow" />
        <div className="container">
          <span className="eyebrow">A knowledge graph of the Bible · from a Protestant point of view</span>
          <h1>Ancient words. <em>Living connections.</em></h1>
          <p className="lead">
            Explore the 66 books of the Bible through the people, places, events and big questions that tie them
            together, the way the Bible has been read since the Reformation. Come curious, with your questions.
          </p>
          <div className="row" style={{ marginTop: 26 }}>
            <Link to="/start" className="btn primary">New here? Start here <ArrowRight size={16} /></Link>
            <Link to="/explore" className="btn"><Network size={16} /> Explore the graph</Link>
            <Link to="/read/John/1" className="btn ghost"><BookOpen size={16} /> Read John 1</Link>
          </div>
          {s && (
            <div className="stat-row">
              {[['books', 'books'], ['verses', 'verses'], ['people', 'people'], ['places', 'places'], ['events', 'events'], ['crossrefs', 'cross-references'], ['edges', 'graph links']].map(([k, l]) => (
                <div className="stat" key={k}><b>{Number(s[k]).toLocaleString()}</b><span>{l}</span></div>
              ))}
            </div>
          )}
          {today && (
            <div className="votd">
              <span className="eyebrow">Verse for today</span>
              <blockquote><VerseText refStr={today} tr={tr === 'kjv' ? 'kjv' : 'bsb'} max={3} as="span" /></blockquote>
              <Link to={refLink(today)} className="md-link small">{formatRef(today)} · read in context</Link>
            </div>
          )}
        </div>
      </section>

      <section className="container" style={{ padding: '64px 20px 10px' }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            <span className="eyebrow">Philosophy meets Scripture</span>
            <h2>The Big Questions</h2>
            <p className="muted" style={{ maxWidth: 620 }}>{THEME_CATEGORIES[0].blurb} Each one includes an optional <b>Bridges</b> note that compares it, gently and honestly, with ideas from Hindu thought.</p>
          </div>
          <span className="spacer" />
          <Link to="/themes" className="btn sm">All themes <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-3" style={{ marginTop: 20 }}>
          {bigQ.length === 0 && <div className="panel small muted">Themes are being prepared.</div>}
          {bigQ.map((t) => (
            <Link key={t.id} to={`/themes/${t.id}`} className="card link">
              <div className="card-icon"><Icon name={t.icon} /></div>
              <h3>{t.title}</h3>
              <p className="serif" style={{ fontSize: '1.15rem', fontStyle: 'italic', margin: 0, color: 'var(--ink-2)' }}>{t.hook}</p>
            </Link>
          ))}
        </div>
      </section>

      {acts.length > 0 && (
        <section className="container" style={{ padding: '56px 20px 10px' }}>
          <span className="eyebrow">One story, many books</span>
          <h2>The Story in {acts.length} Acts</h2>
          <p className="muted" style={{ maxWidth: 640 }}>Protestant readers see the whole Bible as a single unfolding drama of creation and redemption, with Christ at its centre. Here it is, act by act.</p>
          <div className="act-strip" style={{ marginTop: 16 }}>
            {acts.map((a) => (
              <Link key={a.act} to={refLink(a.ref)} className="card link" style={{ minHeight: 210 }}>
                <div className="act-num">{a.act}</div>
                <h3 style={{ marginTop: 6 }}>{a.title}</h3>
                <p className="small muted" style={{ marginBottom: 8 }}>{a.text}</p>
                <span className="small" style={{ color: 'var(--gold)' }}>{formatRef(a.ref)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container" style={{ padding: '56px 20px 10px' }}>
        <span className="eyebrow">Ways in</span>
        <h2>Explore</h2>
        <div className="grid grid-4" style={{ marginTop: 18 }}>
          {EXPLORE.map(({ to, icon: I, title, text }) => (
            <Link key={to} to={to} className="card link">
              <div className="card-icon"><I size={20} strokeWidth={1.7} /></div>
              <h3 style={{ fontSize: '1.25rem' }}>{title}</h3>
              <p className="small muted" style={{ margin: 0 }}>{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {firstJourneys.length > 0 && (
        <section className="container" style={{ padding: '56px 20px 10px' }}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div><span className="eyebrow">Guided reading</span><h2>Begin a Journey</h2></div>
            <span className="spacer" />
            <Link to="/journeys" className="btn sm">All journeys <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            {firstJourneys.map((j) => (
              <Link key={j.id} to={`/journeys/${j.id}`} className="card link row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 16 }}>
                <div className="card-icon" style={{ margin: 0, flexShrink: 0 }}><Icon name={j.icon} /></div>
                <div>
                  <h3 style={{ fontSize: '1.3rem' }}>{j.title}</h3>
                  <p className="small muted" style={{ margin: '0 0 6px' }}>{j.subtitle}</p>
                  <span className="small faint">{j.steps?.length} steps · about {j.minutes} minutes</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data?.intro?.forSeekers && (
        <section className="container narrow" style={{ padding: '64px 20px 40px' }}>
          <div className="ornament">✦</div>
          <span className="eyebrow center" style={{ display: 'block' }}>A note for seekers</span>
          <div className="prose serif-body"><Md text={data.intro.forSeekers} /></div>
        </section>
      )}
    </>
  );
}
