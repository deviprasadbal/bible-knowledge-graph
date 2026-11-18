import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { fetchJSON, yearLabel } from '../lib/data';
import { Avatar, Skeleton, useAsync, useTitle } from '../components/ui';

const FEATURED = [
  ['jesus_905', 'The centre of the Christian faith'], ['abraham_58', 'Father of the faithful'], ['moses_2108', 'Lawgiver and liberator'],
  ['david_994', 'Shepherd, poet, king'], ['ruth_2450', 'A foreigner who chose loyal love'], ['mary_1938', 'Mother of Jesus'],
  ['peter_2745', 'The fisherman who denied and was restored'], ['paul_2479', 'Persecutor turned apostle'], ['esther_1343', 'Courage in exile'],
  ['job_1639', 'Faith that wrestles'], ['elijah_1131', 'Prophet of fire and stillness'], ['john_1676', 'Voice in the wilderness'],
];

export default function People() {
  useTitle('People of the Bible');
  const { data, loading } = useAsync(() => fetchJSON('people.json'), []);
  const [q, setQ] = useState('');
  const [g, setG] = useState('');
  const [sort, setSort] = useState('vc');
  const [n, setN] = useState(90);
  const byId = useMemo(() => new Map((data || []).map((p) => [p.id, p])), [data]);
  const list = useMemo(() => {
    let l = data || [];
    if (q) {
      const s = q.toLowerCase();
      l = l.filter((p) => p.l.toLowerCase().includes(s) || (p.sub || '').toLowerCase().includes(s));
    }
    if (g) l = l.filter((p) => p.g === g);
    if (sort === 'az') l = [...l].sort((a, b) => a.l.localeCompare(b.l));
    return l;
  }, [data, q, g, sort]);
  return (
    <div className="container page">
      <span className="eyebrow">{data ? data.length.toLocaleString() : '3,000+'} people</span>
      <h1>People of the Bible</h1>
      <p className="lead">The Bible tells its story through people: kings and shepherds, prophets and fishermen, saints and sinners. Each profile links their family, the places they knew, and every verse where they appear.</p>

      <h2 style={{ marginTop: 34, fontSize: '1.5rem' }}>Begin with these lives</h2>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        {FEATURED.map(([id, tag]) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <Link key={id} to={`/people/${id}`} className="card link row" style={{ flexWrap: 'nowrap', padding: 14 }}>
              <Avatar name={p.l} />
              <div style={{ minWidth: 0 }}><b>{p.l}</b><div className="small faint">{tag}</div></div>
            </Link>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 40, gap: 10 }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-3)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by name…" value={q} onChange={(e) => { setQ(e.target.value); setN(90); }} aria-label="Search people" />
        </div>
        <div className="seg">
          {[['', 'All'], ['M', 'Men'], ['F', 'Women']].map(([k, l]) => <button key={k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>{l}</button>)}
        </div>
        <div className="seg">
          <button className={sort === 'vc' ? 'on' : ''} onClick={() => setSort('vc')}>Most mentioned</button>
          <button className={sort === 'az' ? 'on' : ''} onClick={() => setSort('az')}>A–Z</button>
        </div>
      </div>
      {loading ? <Skeleton lines={8} /> : (
        <>
          <div className="small faint" style={{ margin: '12px 0' }}>{list.length.toLocaleString()} people</div>
          <div className="grid grid-3" style={{ gap: 4 }}>
            {list.slice(0, n).map((p) => (
              <Link key={p.id} to={`/people/${p.id}`} className="list-item">
                <Avatar name={p.l} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{p.l}</div>
                  <div className="small faint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.vc} verse{p.vc === 1 ? '' : 's'}{p.y0 != null ? ` · ${yearLabel(p.y0)}` : ''}{p.sub ? ` · ${p.sub}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {list.length > n && <div className="center" style={{ marginTop: 20 }}><button className="btn" onClick={() => setN(n + 150)}>Show more</button></div>}
        </>
      )}
    </div>
  );
}
