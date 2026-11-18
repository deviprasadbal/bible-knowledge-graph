import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Anchor, Baby, Bird, BookOpen, Church, Clock, Compass, Cross, Crown, DoorOpen, Droplets, Eye, Feather, Flame, Gift,
  Globe, HandHeart, Heart, Hourglass, Infinity as InfinityIcon, Key, Lamp, Leaf, Lightbulb, Link as LinkIcon, Map, Moon,
  Mountain, Music, Scale, Scroll, Shield, Skull, Sparkles, Sprout, Star, Sun, Sunrise, TreePine, User, Users, Waves, Wind,
} from 'lucide-react';
import { fetchJSON, formatRef, refLink, refVerses, stripMd } from '../lib/data';
import { useStore } from '../lib/store';

const ICONS = {
  sparkles: Sparkles, sun: Sun, moon: Moon, star: Star, mountain: Mountain, flame: Flame, droplets: Droplets, wind: Wind,
  leaf: Leaf, sprout: Sprout, 'tree-pine': TreePine, heart: Heart, 'hand-heart': HandHeart, hands: HandHeart, gift: Gift,
  crown: Crown, cross: Cross, scroll: Scroll, 'book-open': BookOpen, feather: Feather, key: Key, compass: Compass, map: Map,
  hourglass: Hourglass, clock: Clock, infinity: InfinityIcon, eye: Eye, shield: Shield, scale: Scale, anchor: Anchor, lamp: Lamp,
  waves: Waves, dove: Bird, church: Church, bird: Bird, users: Users, user: User, baby: Baby, skull: Skull,
  'door-open': DoorOpen, link: LinkIcon, globe: Globe, music: Music, lightbulb: Lightbulb, sunrise: Sunrise,
};

export function Icon({ name, size = 20, ...rest }) {
  const C = ICONS[name] || Sparkles;
  return <C size={size} strokeWidth={1.7} {...rest} />;
}

export function BrandMark({ className = 'brand-mark' }) {
  // An oil lamp whose flame is a small graph: three nodes, two links.
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold-2)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
      <path d="M5 21c0 3 4.5 5 11 5s11-2 11-5H5z" fill="var(--ink)" />
      <path d="M24 21c2-1 4-1 4-3" stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <line x1="16" y1="17" x2="12" y2="10" stroke="url(#lg-flame)" strokeWidth="1.4" />
      <line x1="16" y1="17" x2="20" y2="8" stroke="url(#lg-flame)" strokeWidth="1.4" />
      <line x1="12" y1="10" x2="20" y2="8" stroke="url(#lg-flame)" strokeWidth="1.4" />
      <circle cx="16" cy="17" r="2.3" fill="url(#lg-flame)" />
      <circle cx="12" cy="10" r="1.8" fill="url(#lg-flame)" />
      <circle cx="20" cy="8" r="2" fill="url(#lg-flame)" />
    </svg>
  );
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fn())
      .then((data) => live && setState({ loading: false, data, error: null }))
      .catch((error) => live && setState({ loading: false, data: null, error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Skeleton({ lines = 3 }) {
  return <div aria-busy="true">{Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />)}</div>;
}

export function ErrorNote({ error }) {
  return <div className="panel small">Couldn't load this content. {String(error?.message || '')}</div>;
}

export function useTitle(t) {
  useEffect(() => {
    document.title = t ? `${t} · Lamplight` : 'Lamplight · A Knowledge Graph of the Bible';
  }, [t]);
}

/** Reference with a hover/tap preview of the verse text. */
export function VerseRef({ refStr, children, className = 'md-link' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const tr = useStore((s) => s.settings.translation);
  const timer = useRef();
  const anchor = useRef();
  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setPos({ x: Math.min(r.left, window.innerWidth - 412), y: r.bottom + 8 > window.innerHeight - 220 ? r.top - 8 : r.bottom + 8, up: r.bottom + 8 > window.innerHeight - 220 });
      setOpen(true);
    }, 250);
  };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };
  return (
    <>
      <Link ref={anchor} to={refLink(refStr)} className={className} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
        {children || formatRef(refStr)}
      </Link>
      {open && (
        <div className="popover" style={{ left: Math.max(12, pos.x), top: pos.y, transform: pos.up ? 'translateY(-100%)' : undefined }}
          onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={hide}>
          <VerseText refStr={refStr} tr={tr === 'kjv' ? 'kjv' : 'bsb'} max={4} />
          <div className="small faint">{formatRef(refStr)} · {tr === 'kjv' ? 'KJV' : 'BSB'}</div>
        </div>
      )}
    </>
  );
}

export function VerseText({ refStr, tr = 'bsb', max = 6, as = 'p' }) {
  const { data, loading } = useAsync(() => refVerses(refStr, tr, max + 1), [refStr, tr]);
  if (loading) return <Skeleton lines={2} />;
  if (!data?.length) return null;
  const Tag = as;
  const vs = data.slice(0, max);
  return (
    <Tag className="scripture">
      {vs.map((v, i) => (
        <span key={v.ref}>{data.length > 1 && <sup className="faint" style={{ fontSize: '.65em', marginRight: 2 }}>{v.v}</sup>}{stripMd(v.text)}{i < vs.length - 1 ? ' ' : ''}</span>
      ))}
      {data.length > max ? ' …' : ''}
    </Tag>
  );
}

export function KeyVerse({ refStr }) {
  const tr = useStore((s) => s.settings.translation);
  return (
    <Link to={refLink(refStr)} className="keyverse">
      <VerseText refStr={refStr} tr={tr === 'kjv' ? 'kjv' : 'bsb'} max={5} />
      <b>{formatRef(refStr)}</b>
    </Link>
  );
}

export function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

const AVATAR_COLORS = ['#3f6fb0', '#2f8a6b', '#c0642e', '#8a5a2b', '#a8458c', '#6b5bb5', '#7d8a2f', '#b07a1f'];
export function Avatar({ name, size = 40 }) {
  const n = (name || '?').trim();
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, background: AVATAR_COLORS[h % AVATAR_COLORS.length] }}>
      {n[0]}
    </span>
  );
}

export function useLookup(file) {
  const { data } = useAsync(() => fetchJSON(file), [file]);
  return data;
}

export function useScrollTop(dep) {
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [dep]);
}
