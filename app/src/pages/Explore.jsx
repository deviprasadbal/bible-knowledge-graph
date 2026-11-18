import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { ArrowRight, Focus, Route, Search, Sparkles, X } from 'lucide-react';
import { fetchJSON, nodePath, TYPE_META } from '../lib/data';
import { Skeleton, useAsync, useTitle } from '../components/ui';

const REL_LABEL = {
  APPEARS_IN: ['appears in', 'features'], BORN_IN: ['born in', 'birthplace of'], CITES: ['cites', 'cited by'],
  DIED_IN: ['died in', 'place of death of'], ECHOES: ['echoes', 'echoed by'], FOLLOWS: ['comes after', 'comes before'],
  MARRIED_TO: ['married to', 'married to'], MEMBER_OF: ['member of', 'has member'], MENTIONED_IN: ['mentioned in', 'mentions'],
  OCCURRED_AT: ['took place at', 'site of'], PARENT_OF: ['parent of', 'child of'], PARTICIPATED_IN: ['took part in', 'involved'],
  PART_OF: ['part of', 'includes'], RECORDED_IN: ['recorded in', 'records'], SIBLING_OF: ['sibling of', 'sibling of'],
  WROTE: ['wrote', 'written by'], RELATED_TO: ['related to', 'related to'], EXEMPLIFIED_BY: ['seen in the life of', 'embodies'],
  CONFESSED_IN: ['confessed in', 'confesses'], TAUGHT_IN: ['taught in', 'teaches'], EXPLORES: ['explores', 'explored in'],
};
// Relations that connect almost everything to a book; they make paths trivial, so paths avoid them by default.
const HUB_RELS = new Set(['APPEARS_IN', 'MENTIONED_IN', 'RECORDED_IN', 'TAUGHT_IN', 'EXPLORES', 'CITES', 'ECHOES']);

const QUESTIONS = [
  { q: 'How is Ruth connected to King David?', path: ['person:ruth_2450', 'person:david_994'] },
  { q: 'How is Abraham connected to Jesus?', path: ['person:abraham_58', 'person:jesus_905'] },
  { q: "Who was in Jacob's family?", focus: 'person:israel_682', types: ['P'] },
  { q: 'Where did the events of the Exodus happen?', focus: 'person:moses_2108', types: ['E', 'L', 'P'] },
  { q: 'Which books does the Westminster Confession cite?', focus: 'creed:westminster_confession_of_faith' },
  { q: 'Which books echo Isaiah most?', focus: 'book:Isa', types: ['B'] },
];

let colorCache = null;
function colors() {
  if (colorCache) return colorCache;
  const cs = getComputedStyle(document.documentElement);
  const g = (v) => cs.getPropertyValue(v).trim() || '#888';
  colorCache = {
    P: g('--c-person'), L: g('--c-place'), E: g('--c-event'), B: g('--c-book'), T: g('--c-theme'), C: g('--c-creed'),
    G: g('--c-group'), ink: g('--ink'), ink2: g('--ink-3'), line: g('--line-2'), gold: g('--gold'), bg: g('--bg'),
  };
  setTimeout(() => { colorCache = null; }, 1000);
  return colorCache;
}

function useGraph() {
  return useAsync(async () => {
    const g = await fetchJSON('graph.json');
    const byId = new Map();
    g.nodes.forEach((n, i) => { n.i = i; byId.set(n.id, n); });
    const adj = g.nodes.map(() => []);
    g.edges.forEach(([s, t, r, w], k) => {
      adj[s].push({ k, o: t, r: g.rels[r], out: true, w });
      adj[t].push({ k, o: s, r: g.rels[r], out: false, w });
    });
    return { ...g, byId, adj };
  }, []);
}

export default function Explore() {
  useTitle('Knowledge Graph');
  const { data: G, loading } = useGraph();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('focus') || 'person:jesus_905';
  const pathParam = params.get('path');
  const [types, setTypes] = useState(() => new Set(['P', 'L', 'E', 'B', 'T', 'C', 'G']));
  const [depth, setDepth] = useState(1);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [mode, setMode] = useState(pathParam ? 'path' : 'focus');
  const [pathEnds, setPathEnds] = useState(() => (pathParam ? pathParam.split(',') : ['person:ruth_2450', 'person:david_994']));
  const [viaBooks, setViaBooks] = useState(false);
  const fgRef = useRef();
  const wrapRef = useRef();
  const [size, setSize] = useState({ w: 800, h: 600 });
  const nav = useNavigate();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const pathResult = useMemo(() => {
    if (!G || mode !== 'path') return null;
    const [a, b] = pathEnds.map((id) => G.byId.get(id));
    if (!a || !b) return null;
    return shortestPath(G, a.i, b.i, viaBooks);
  }, [G, mode, pathEnds, viaBooks]);

  const graphData = useMemo(() => {
    if (!G) return { nodes: [], links: [] };
    let keep;
    if (mode === 'path') {
      if (!pathResult) return { nodes: [], links: [] };
      keep = new Set(pathResult.nodes);
      // add a little context around the path
      for (const i of pathResult.nodes) {
        G.adj[i].filter((e) => !HUB_RELS.has(e.r)).slice(0, 3).forEach((e) => keep.add(e.o));
      }
    } else if (mode === 'overview') {
      keep = new Set();
      G.nodes.forEach((n) => {
        if (!types.has(n.t)) return;
        if (n.t === 'B' || n.t === 'T' || n.t === 'C') keep.add(n.i);
        else if (n.t === 'P' && n.s > 120) keep.add(n.i);
        else if (n.t === 'L' && n.s > 90) keep.add(n.i);
      });
    } else {
      const f = G.byId.get(focusId);
      if (!f) return { nodes: [], links: [] };
      keep = new Set([f.i]);
      let frontier = [f.i];
      for (let d = 0; d < depth; d++) {
        const next = [];
        for (const i of frontier) {
          const nb = G.adj[i]
            .filter((e) => types.has(G.nodes[e.o].t))
            .sort((x, y) => (G.nodes[y.o].s || 0) - (G.nodes[x.o].s || 0))
            .slice(0, d === 0 ? 90 : 12);
          nb.forEach((e) => { if (!keep.has(e.o)) { keep.add(e.o); next.push(e.o); } });
        }
        frontier = next;
        if (keep.size > 260) break;
      }
    }
    const nodes = [...keep].map((i) => G.nodes[i]);
    const pathEdges = new Set(pathResult?.edges || []);
    const links = [];
    for (const i of keep) {
      for (const e of G.adj[i]) {
        if (!e.out || !keep.has(e.o)) continue;
        if (mode === 'overview' && !['ECHOES', 'CITES', 'RELATED_TO', 'TAUGHT_IN', 'EXPLORES', 'CONFESSED_IN', 'EXEMPLIFIED_BY', 'WROTE', 'PARENT_OF'].includes(e.r)) continue;
        links.push({ source: G.nodes[i].id, target: G.nodes[e.o].id, r: e.r, onPath: pathEdges.has(e.k) });
      }
    }
    return { nodes: nodes.map((n) => ({ ...n })), links };
  }, [G, mode, focusId, depth, types, pathResult]);

  useEffect(() => {
    if (!G) return;
    setSelected(mode === 'focus' ? G.byId.get(focusId) : null);
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 60), 900);
    return () => clearTimeout(t);
  }, [G, focusId, mode, graphData.nodes.length]);

  const focusOn = useCallback((id) => {
    setMode('focus');
    setParams({ focus: id });
  }, [setParams]);

  const paint = useCallback((node, ctx, scale) => {
    const c = colors();
    const isFocus = mode === 'focus' && node.id === focusId;
    const onPath = pathResult?.nodes.includes(node.i);
    const r = node.t === 'B' || node.t === 'T' ? 5 + Math.log2((node.s || 1) + 1) * 0.6 : 2.5 + Math.log2((node.s || 1) + 1) * 0.7;
    const sel = selected?.id === node.id || hover?.id === node.id;
    ctx.beginPath();
    if (node.t === 'T') {
      // themes as diamonds
      ctx.moveTo(node.x, node.y - r * 1.25); ctx.lineTo(node.x + r * 1.25, node.y); ctx.lineTo(node.x, node.y + r * 1.25); ctx.lineTo(node.x - r * 1.25, node.y); ctx.closePath();
    } else if (node.t === 'B' || node.t === 'C') {
      const s = r * 1.7;
      ctx.roundRect ? ctx.roundRect(node.x - s / 2, node.y - s / 2, s, s, 2) : ctx.rect(node.x - s / 2, node.y - s / 2, s, s);
    } else ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = c[node.t] || c.ink2;
    ctx.globalAlpha = hover && !sel ? 0.85 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (isFocus || onPath || sel) {
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = c.gold;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4 / scale + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = c.gold;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const showLabel = isFocus || onPath || sel || scale > 2.2 || (scale > 1.1 && (node.s || 0) > 60) || node.t === 'T' || (node.t === 'B' && scale > 0.8);
    if (showLabel) {
      const fs = Math.max(10 / scale, (isFocus ? 5 : 3.2));
      ctx.font = `${isFocus || sel ? 600 : 500} ${fs}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = node.l.length > 28 ? node.l.slice(0, 26) + '…' : node.l;
      ctx.lineWidth = 3 / scale;
      ctx.strokeStyle = c.bg;
      ctx.strokeText(label, node.x, node.y + r + 2);
      ctx.fillStyle = c.ink;
      ctx.fillText(label, node.x, node.y + r + 2);
    }
  }, [focusId, mode, selected, hover, pathResult]);

  if (loading || !G) return <div className="container page"><Skeleton lines={8} /></div>;

  return (
    <div className="explorer" ref={wrapRef}>
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(n) => `${n.l}${n.sub ? ' · ' + n.sub : ''} (${TYPE_META[n.t]?.key})`}
        nodeCanvasObject={paint}
        nodePointerAreaPaint={(node, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x, node.y, 7, 0, 2 * Math.PI); ctx.fill(); }}
        linkColor={(l) => (l.onPath ? colors().gold : colors().line)}
        linkWidth={(l) => (l.onPath ? 2.5 : 0.6)}
        linkDirectionalParticles={(l) => (l.onPath ? 3 : 0)}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalArrowLength={mode === 'focus' && depth === 1 ? 2.5 : 0}
        linkDirectionalArrowRelPos={0.9}
        cooldownTicks={140}
        maxZoom={5}
        minZoom={0.2}
        d3VelocityDecay={0.3}
        onNodeHover={setHover}
        onNodeClick={(n) => { setSelected(G.byId.get(n.id)); fgRef.current?.centerAt(n.x, n.y, 500); }}
        onNodeRightClick={(n) => focusOn(n.id)}
        onBackgroundClick={() => setSelected(null)}
      />

      <div className="explorer-ui">
        <div className="glass">
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <div className="seg" role="group" aria-label="Graph mode">
              <button className={mode === 'focus' ? 'on' : ''} onClick={() => setMode('focus')}><Focus size={13} /> Focus</button>
              <button className={mode === 'path' ? 'on' : ''} onClick={() => setMode('path')}><Route size={13} /> Connect</button>
              <button className={mode === 'overview' ? 'on' : ''} onClick={() => setMode('overview')}><Sparkles size={13} /> Overview</button>
            </div>
          </div>
          {mode === 'focus' && (
            <>
              <NodeSearch G={G} placeholder="Find a person, place, book, theme…" onPick={(n) => focusOn(n.id)} />
              <div className="row small" style={{ marginTop: 10, gap: 8 }}>
                <span className="faint">Depth</span>
                <div className="seg">
                  {[1, 2].map((d) => <button key={d} className={depth === d ? 'on' : ''} onClick={() => setDepth(d)}>{d} hop{d > 1 ? 's' : ''}</button>)}
                </div>
                <span className="faint">{graphData.nodes.length} nodes · {graphData.links.length} links</span>
              </div>
            </>
          )}
          {mode === 'path' && (
            <>
              <div className="small faint" style={{ marginBottom: 6 }}>Find the shortest chain of facts that links two things.</div>
              <NodeSearch G={G} value={G.byId.get(pathEnds[0])?.l} placeholder="From…" onPick={(n) => setPathEnds([n.id, pathEnds[1]])} />
              <div style={{ height: 6 }} />
              <NodeSearch G={G} value={G.byId.get(pathEnds[1])?.l} placeholder="To…" onPick={(n) => setPathEnds([pathEnds[0], n.id])} />
              <label className="row small" style={{ marginTop: 8, gap: 6 }}>
                <input type="checkbox" checked={viaBooks} onChange={(e) => setViaBooks(e.target.checked)} /> allow links through books and themes
              </label>
            </>
          )}
          {mode === 'overview' && <div className="small muted">The constellation: all 66 books, every theme and creed, and the most-mentioned people and places. Lines show how books echo one another and what themes they teach.</div>}
          <div className="legend" style={{ marginTop: 12 }}>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <button key={k} className={`chip${types.has(k) ? '' : ''}`} style={{ opacity: types.has(k) ? 1 : 0.4 }}
                onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                aria-pressed={types.has(k)}>
                <span className="dot" style={{ background: m.color }} />{m.label}
              </button>
            ))}
          </div>
        </div>
        {mode === 'path' && pathResult && <PathCard G={G} path={pathResult} />}
        {mode === 'path' && !pathResult && <div className="glass small">No chain found. Try allowing links through books and themes.</div>}
        {mode !== 'path' && (
          <div className="glass small">
            <div className="section-label" style={{ marginTop: 0 }}>Ask the graph</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {QUESTIONS.map((x) => (
                <button key={x.q} className="btn ghost sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    if (x.path) { setPathEnds(x.path); setMode('path'); }
                    else { if (x.types) setTypes(new Set(x.types)); else setTypes(new Set(Object.keys(TYPE_META))); focusOn(x.focus); }
                  }}>
                  <ArrowRight size={13} /> {x.q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="explorer-info glass">
          <NodeInfo G={G} node={selected} onClose={() => setSelected(null)} onFocus={focusOn} onOpen={(n) => nav(nodePath(n))} />
        </div>
      )}
    </div>
  );
}

function NodeSearch({ G, onPick, placeholder, value }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const results = useMemo(() => {
    if (q.length < 2) return [];
    const s = q.toLowerCase();
    return G.nodes
      .filter((n) => n.l.toLowerCase().includes(s))
      .sort((a, b) => (b.l.toLowerCase().startsWith(s) - a.l.toLowerCase().startsWith(s)) || (b.s || 0) - (a.s || 0))
      .slice(0, 12);
  }, [G, q]);
  const pick = (n) => { onPick(n); setQ(''); setOpen(false); };
  return (
    <div style={{ position: 'relative' }}>
      <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)' }} />
      <input className="input" style={{ paddingLeft: 36 }} placeholder={value || placeholder} value={q}
        aria-label={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && results[hi]) pick(results[hi]);
        }} />
      {open && results.length > 0 && (
        <div className="suggest">
          {results.map((n, i) => (
            <button key={n.id} className={i === hi ? 'on' : ''} onMouseDown={() => pick(n)}>
              <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: TYPE_META[n.t]?.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{n.l}{n.sub && <span className="small faint"> · {n.sub.slice(0, 40)}</span>}</span>
              <span className="small faint">{TYPE_META[n.t]?.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeInfo({ G, node, onClose, onFocus, onOpen }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of G.adj[node.i]) {
      const label = (REL_LABEL[e.r] || [e.r, e.r])[e.out ? 0 : 1];
      if (!m.has(label)) m.set(label, []);
      m.get(label).push({ n: G.nodes[e.o], w: e.w });
    }
    for (const v of m.values()) v.sort((a, b) => (b.w || 0) - (a.w || 0) || (b.n.s || 0) - (a.n.s || 0));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [G, node]);
  const meta = TYPE_META[node.t];
  return (
    <div>
      <div className="row" style={{ gap: 8 }}>
        <span className="badge" style={{ background: 'transparent', border: `1px solid ${meta.color}`, color: meta.color }}>{meta.key}</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
      </div>
      <h3 style={{ margin: '6px 0 2px' }}>{node.l}</h3>
      {node.sub && <div className="small faint">{node.sub}</div>}
      <div className="small faint" style={{ marginTop: 4 }}>{G.adj[node.i].length} connections</div>
      <div className="row" style={{ gap: 6, margin: '12px 0' }}>
        <button className="btn sm" onClick={() => onFocus(node.id)}><Focus size={14} /> Focus here</button>
        {meta.path !== null && <button className="btn sm gold" onClick={() => onOpen(node)}>Open page <ArrowRight size={14} /></button>}
      </div>
      {groups.slice(0, 8).map(([label, items]) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div className="section-label" style={{ margin: '8px 0 6px' }}>{label} <span className="badge">{items.length}</span></div>
          <div className="chips">
            {items.slice(0, 10).map(({ n }) => (
              <button key={n.id} className="chip" onClick={() => onFocus(n.id)} title={n.sub || n.l}>
                <span className="dot" style={{ background: TYPE_META[n.t]?.color }} />{n.l.length > 26 ? n.l.slice(0, 24) + '…' : n.l}
              </button>
            ))}
            {items.length > 10 && <span className="small faint" style={{ alignSelf: 'center' }}>+{items.length - 10}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PathCard({ G, path }) {
  return (
    <div className="glass">
      <div className="section-label" style={{ marginTop: 0 }}>A chain of {path.nodes.length - 1} fact{path.nodes.length > 2 ? 's' : ''}</div>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
        {path.steps.map((s, i) => (
          <li key={i} className="small">
            <Link to={nodePath(G.nodes[s.a])} className="md-link">{G.nodes[s.a].l}</Link>{' '}
            <span className="faint">{s.label}</span>{' '}
            <Link to={nodePath(G.nodes[s.b])} className="md-link">{G.nodes[s.b].l}</Link>
          </li>
        ))}
      </ol>
      <p className="small faint" style={{ margin: '10px 0 0' }}>Each line is one triple (subject, relation, object), as in the graph's sources.</p>
    </div>
  );
}

// Weighted shortest path (Dijkstra). Family/event links are cheap; group membership is costlier,
// so the answer prefers meaningful chains (Ruth -> Obed -> Jesse -> David) over "both in a group".
const REL_COST = { MEMBER_OF: 2.6, PART_OF: 1.6, FOLLOWS: 1.4, SIBLING_OF: 1.2 };
function shortestPath(G, a, b, viaHubs) {
  const dist = new Map([[a, 0]]);
  const prev = new Map([[a, null]]);
  const done = new Set();
  const heap = [[0, a]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, i] = pop();
    if (done.has(i)) continue;
    done.add(i);
    if (i === b) break;
    for (const e of G.adj[i]) {
      if (!viaHubs && HUB_RELS.has(e.r)) continue;
      const nd = d + (REL_COST[e.r] || 1);
      if (nd < (dist.get(e.o) ?? Infinity)) { dist.set(e.o, nd); prev.set(e.o, { from: i, e }); push([nd, e.o]); }
    }
  }
  if (!prev.has(b)) return null;
  const nodes = [];
  const steps = [];
  const edges = [];
  let cur = b;
  while (cur !== a) {
    const p = prev.get(cur);
    nodes.unshift(cur);
    edges.unshift(p.e.k);
    const [fwd] = REL_LABEL[p.e.r] || [p.e.r];
    steps.unshift(p.e.out ? { a: p.from, b: cur, label: fwd } : { a: cur, b: p.from, label: fwd });
    cur = p.from;
  }
  nodes.unshift(a);
  return { nodes, edges, steps };
}
