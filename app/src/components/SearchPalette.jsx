import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CornerDownLeft, Search, X } from 'lucide-react';
import { formatRef, refLink, TYPE_META } from '../lib/data';
import { parseHumanRef, searchAll } from '../lib/search';

const KIND_COLOR = {
  Person: 'var(--c-person)', Place: 'var(--c-place)', Event: 'var(--c-event)', Book: 'var(--c-book)', Theme: 'var(--c-theme)',
  Creed: 'var(--c-creed)', Journey: 'var(--gold)', Dictionary: 'var(--ink-3)',
};

export default function SearchPalette({ onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [hi, setHi] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef();
  const ref = useMemo(() => parseHumanRef(q), [q]);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k); };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    if (q.trim().length < 2) { setRes([]); return undefined; }
    const t = setTimeout(() => searchAll(q, 14).then((r) => live && (setRes(r), setHi(0))), 90);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const items = [
    ...(ref ? [{ id: 'ref', kind: 'Passage', title: formatRef(ref), sub: 'Open in the reader', to: refLink(ref) }] : []),
    ...res,
    ...(q.trim().length >= 3 ? [{ id: 'verses', kind: 'Search', title: `Search verses for “${q.trim()}”`, sub: 'Full-text search of the Bible', to: `/search?q=${encodeURIComponent(q.trim())}` }] : []),
  ];
  const go = (it) => { nav(it.to); onClose(); };

  return (
    <div className="drawer-backdrop" style={{ display: 'grid', placeItems: 'start center', paddingTop: '10vh', zIndex: 80 }} onClick={onClose}>
      <div className="card" style={{ width: 'min(640px, calc(100vw - 24px))', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Search">
        <div className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
          <Search size={18} className="faint" />
          <input ref={inputRef} className="input" style={{ border: 0, boxShadow: 'none', background: 'transparent', padding: '8px 4px' }}
            placeholder="Search people, places, themes… or type John 3:16" value={q} aria-label="Search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === 'Enter' && items[hi]) go(items[hi]);
            }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && (
            <div className="small faint" style={{ padding: '18px 14px' }}>
              Try <b>grace</b>, <b>Abraham</b>, <b>Jerusalem</b>, <b>Exodus</b>, <b>Heidelberg</b>, or a reference like <b>Psalm 23</b>.
            </div>
          )}
          {items.map((it, i) => (
            <button key={it.id} onClick={() => go(it)} onMouseEnter={() => setHi(i)}
              className="list-item" style={{ width: '100%', border: 0, background: i === hi ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              {it.kind === 'Passage' ? <BookOpen size={18} style={{ color: 'var(--gold)' }} />
                : <span style={{ width: 10, height: 10, borderRadius: '50%', background: KIND_COLOR[it.kind] || 'var(--gold)', flexShrink: 0, margin: '0 4px' }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{it.title}</span>
                {it.sub && <span className="small faint" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>}
              </span>
              <span className="badge">{it.kind}</span>
              {i === hi && <CornerDownLeft size={14} className="faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TYPE_META };
