import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { formatRef, refLink, stripMd } from '../lib/data';
import { parseHumanRef, searchAll, searchVerses } from '../lib/search';
import { Skeleton, useTitle } from '../components/ui';

function highlight(text, words) {
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} style={{ background: 'var(--hl-gold)', color: 'inherit', borderRadius: 3 }}>{p}</mark> : p));
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [ents, setEnts] = useState([]);
  const [verses, setVerses] = useState(null);
  const [tr, setTr] = useState('bsb');
  const nav = useNavigate();
  useTitle(q ? `Search: ${q}` : 'Search');
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    let live = true;
    if (!q) { setEnts([]); setVerses([]); return undefined; }
    setVerses(null);
    searchAll(q, 24).then((r) => live && setEnts(r));
    searchVerses(q, 300, tr).then((r) => live && setVerses(r));
    return () => { live = false; };
  }, [q, tr]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const submit = (e) => {
    e.preventDefault();
    const ref = parseHumanRef(input);
    if (ref) nav(refLink(ref));
    else setParams({ q: input.trim() });
  };
  return (
    <div className="container page narrow" style={{ maxWidth: 900 }}>
      <h1>Search</h1>
      <form onSubmit={submit} className="row" style={{ flexWrap: 'nowrap' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={17} style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink-3)' }} />
          <input className="input" style={{ paddingLeft: 38 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Words, names, or a reference like Romans 8:28" aria-label="Search" autoFocus />
        </div>
        <button className="btn primary" type="submit">Search</button>
      </form>
      {q && (
        <>
          {ents.length > 0 && (
            <>
              <div className="section-label">In the graph</div>
              <div className="chips">
                {ents.map((r) => <Link key={r.id} to={r.to} className="chip"><span className="badge" style={{ padding: '0 5px' }}>{r.kind}</span>{r.title}</Link>)}
              </div>
            </>
          )}
          <div className="row" style={{ marginTop: 28 }}>
            <div className="section-label" style={{ margin: 0 }}>In Scripture {verses && <span className="badge">{verses.length}{verses.length >= 300 ? '+' : ''}</span>}</div>
            <span className="spacer" />
            <div className="seg"><button className={tr === 'bsb' ? 'on' : ''} onClick={() => setTr('bsb')}>BSB</button><button className={tr === 'kjv' ? 'on' : ''} onClick={() => setTr('kjv')}>KJV</button></div>
          </div>
          {!verses ? <><p className="small faint">Searching all 31,102 verses…</p><Skeleton lines={5} /></> : verses.length === 0 ? <p className="muted">No verses contain all of those words.</p> : (
            <div style={{ marginTop: 10 }}>
              {verses.map((v) => {
                const text = stripMd(v.text);
                return (
                  <Link key={v.ref} to={refLink(v.ref)} className="xref">
                    <b>{formatRef(v.ref)}</b>
                    <p>{highlight(text, words)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
