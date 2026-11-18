import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Pane, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { circleMarker, layerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronRight, MapPin, Search, X } from 'lucide-react';
import { fetchJSON, getPlace } from '../lib/data';
import { ErrorNote, Skeleton, useAsync, useTitle } from '../components/ui';

/* ------------------------------------------------------------------ constants */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const HOME = { center: [32, 35.5], zoom: 6 };

const VIEWS = [
  { id: 'land', label: 'Holy Land', center: [31.8, 35.25], zoom: 8 },
  { id: 'levant', label: 'Levant', center: HOME.center, zoom: HOME.zoom },
  { id: 'paul', label: "Paul's world", center: [37.4, 24], zoom: 5 },
  { id: 'empires', label: 'Rome to Persia', center: [35, 33], zoom: 4 },
];

const TYPE_ORDER = ['City', 'Region', 'Mountain', 'Water', 'Valley', 'Landmark', 'Island', 'Path', 'Other'];
const TYPE_LABEL = {
  City: 'Cities', Region: 'Regions', Mountain: 'Mountains', Water: 'Waters', Valley: 'Valleys',
  Landmark: 'Landmarks', Island: 'Islands', Path: 'Roads', Other: 'Other',
};

const PAGE = 60;

/* ------------------------------------------------------------------ helpers */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const radiusFor = (vc) => 2.6 + Math.log10((vc || 0) + 1) * 2.4;
const hasCoords = (p) => p.lat != null && p.lon != null;
const verseLabel = (n) => `${(n || 0).toLocaleString()} verse${n === 1 ? '' : 's'}`;
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Read CSS custom properties as real colors (Leaflet's canvas needs them) and follow theme changes. */
function useCssColors(spec) {
  const read = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const [key, [name, fallback]] of Object.entries(spec)) out[key] = cs.getPropertyValue(name).trim() || fallback;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const update = () => setColors((prev) => {
      const next = read();
      return Object.keys(next).some((k) => next[k] !== prev[k]) ? next : prev;
    });
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', update);
    update();
    return () => { mo.disconnect(); mq?.removeEventListener?.('change', update); };
  }, [read]);
  return colors;
}

const COLOR_SPEC = { place: ['--c-place', '#2f8a6b'], gold: ['--gold', '#b07a1f'] };

/* ------------------------------------------------------------------ page */
export default function Places() {
  useTitle('Map of the Bible');
  const { data, loading, error } = useAsync(() => fetchJSON('places.json'), []);
  if (error) return <div className="container page"><ErrorNote error={error} /></div>;
  if (loading || !data) return <div className="map-wrap"><div className="container page"><Skeleton lines={5} /></div></div>;
  return <Atlas places={data} />;
}

function Atlas({ places }) {
  const [params, setParams] = useSearchParams();
  const colors = useCssColors(COLOR_SPEC);
  const [map, setMap] = useState(null);
  const panelRef = useRef(null);
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [type, setType] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  // Selection: { id, via: 'list' | 'map' | 'url' }. Seeded from ?p=<id> so links like /places?p=bethel_219 work.
  const [sel, setSel] = useState(() => {
    const id = params.get('p');
    const p = id && places.find((x) => x.id === id && hasCoords(x));
    return p ? { id: p.id, via: 'url' } : null;
  });
  const selRef = useRef(null);
  selRef.current = sel?.id || null;
  const [open, setOpen] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches));

  const indexed = useMemo(() => places.map((p) => ({ ...p, ft: p.ft || 'Other', n: norm(p.l) })), [places]);
  const byId = useMemo(() => new Map(indexed.map((p) => [p.id, p])), [indexed]);
  const mappedCount = useMemo(() => indexed.filter(hasCoords).length, [indexed]);
  const typeCounts = useMemo(() => {
    const c = {};
    for (const p of indexed) if (hasCoords(p)) c[p.ft] = (c[p.ft] || 0) + 1;
    return TYPE_ORDER.filter((t) => c[t]).map((t) => [t, c[t]]);
  }, [indexed]);

  const results = useMemo(() => {
    const nq = norm(dq.trim());
    let list = type === 'all' ? indexed : indexed.filter((p) => p.ft === type);
    if (nq) {
      const starts = [];
      const inner = [];
      for (const p of list) {
        if (p.n.startsWith(nq) || p.n.includes(` ${nq}`) || p.n.includes(`(${nq}`)) starts.push(p);
        else if (p.n.includes(nq)) inner.push(p);
      }
      list = starts.concat(inner);
    }
    return list;
  }, [indexed, dq, type]);

  const dots = useMemo(() => results.filter(hasCoords), [results]);
  useEffect(() => setLimit(PAGE), [dq, type]);

  /** Move so the place lands in the centre of the part of the map the panel doesn't cover. */
  const flyTo = useCallback((p, animate = true) => {
    if (!map || !hasCoords(p)) return;
    const target = p.ft === 'Region' ? Math.min(Math.max(map.getZoom(), 6), 7) : Math.max(map.getZoom(), 9);
    let offset = [0, 0];
    const panel = panelRef.current;
    if (panel) {
      const mr = map.getContainer().getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      if (pr.width < mr.width * 0.6) offset = [(pr.right - mr.left) / 2, 0];
      else offset = [0, Math.min(pr.bottom - mr.top, mr.height * 0.6) / 2];
    }
    const center = map.unproject(map.project([p.lat, p.lon], target).subtract(offset), target);
    if (!animate || prefersReducedMotion()) map.setView(center, target, { animate: false });
    else map.flyTo(center, target, { duration: 0.9 });
  }, [map]);

  const pick = useCallback((p, via = 'list') => {
    setSel({ id: p.id, via });
    if (via !== 'map') {
      const small = window.matchMedia?.('(max-width: 760px)').matches;
      if (small) setOpen(false);
      // Wait for the panel to settle (it may have collapsed) before measuring it.
      requestAnimationFrame(() => requestAnimationFrame(() => flyTo(p)));
    }
  }, [flyTo]);

  const onDotClick = useCallback((id) => {
    const p = byId.get(id);
    if (p) pick(p, 'map');
  }, [byId, pick]);

  const closeSel = useCallback((id) => {
    if (selRef.current === id) setSel(null);
  }, []);

  // A place requested in the URL on arrival: centre on it as soon as the map exists.
  useEffect(() => {
    if (!map || sel?.via !== 'url') return;
    const p = byId.get(sel.id);
    if (p) flyTo(p, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Keep ?p=<id> in step with the selection so a place on the map can be shared or bookmarked.
  const urlId = params.get('p');
  useEffect(() => {
    if (!urlId || urlId === selRef.current) return;
    const p = byId.get(urlId);
    if (p && hasCoords(p)) pick(p, 'url');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId]);
  useEffect(() => {
    const cur = params.get('p');
    const want = sel?.id || null;
    if (cur === want) return;
    const next = new URLSearchParams(params);
    if (want) next.set('p', want); else next.delete('p');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const selected = sel ? byId.get(sel.id) : null;
  const shown = results.slice(0, limit);
  const filtered = dq.trim() || type !== 'all';

  const onSearchKey = (e) => {
    if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); }
    if (e.key === 'Enter' && results[0]) {
      e.preventDefault();
      const first = results.find(hasCoords);
      if (first) pick(first, 'list');
    }
  };

  const setView = (v) => {
    if (!map) return;
    if (prefersReducedMotion()) map.setView(v.center, v.zoom, { animate: false });
    else map.flyTo(v.center, v.zoom, { duration: 0.9 });
  };

  return (
    <div className="map-wrap atlas">
      <MapContainer
        ref={setMap}
        center={HOME.center}
        zoom={HOME.zoom}
        minZoom={3}
        maxZoom={17}
        preferCanvas
        zoomControl={false}
        worldCopyJump
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />
        <ZoomControl position="topright" />
        <PlaceDots places={dots} color={colors.place} onPick={onDotClick} />
        <Pane name="atlas-selected" style={{ zIndex: 450 }}>
          {selected && hasCoords(selected) && (
            <CircleMarker
              key={selected.id}
              center={[selected.lat, selected.lon]}
              radius={radiusFor(selected.vc) + 4}
              interactive={false}
              pathOptions={{ color: colors.gold, weight: 3, fillColor: colors.place, fillOpacity: 0.95, opacity: 1 }}
            />
          )}
        </Pane>
        {selected && hasCoords(selected) && (
          <Popup
            key={`${selected.id}-${sel.via}`}
            position={[selected.lat, selected.lon]}
            offset={[0, -radiusFor(selected.vc) - 2]}
            autoPan={sel.via === 'map'}
            autoPanPaddingTopLeft={[24, 24]}
            minWidth={250}
            maxWidth={250}
            eventHandlers={{ remove: () => closeSel(selected.id) }}
          >
            <PlacePopup place={selected} />
          </Popup>
        )}
      </MapContainer>

      <aside ref={panelRef} className="map-side glass atlas-panel" aria-label="Find a place">
        <div className="atlas-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="eyebrow">Atlas of the Bible</span>
            <h1>Places</h1>
          </div>
          <button
            type="button"
            className="icon-btn atlas-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="atlas-body"
            aria-label={open ? 'Hide filters and list' : 'Show filters and list'}
            title={open ? 'Hide list' : 'Show list'}
          >
            <ChevronDown size={20} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
        </div>
        <p className="small muted atlas-intro">
          {mappedCount.toLocaleString()} places named in Scripture, from Ur to Rome. Larger circles are mentioned in more verses.
        </p>

        <div className="atlas-search">
          <Search size={17} className="atlas-search-icon" aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); if (!open) setOpen(true); }}
            onKeyDown={onSearchKey}
            placeholder="Search places, e.g. Bethel"
            aria-label="Search places"
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button type="button" className="icon-btn atlas-clear" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>
          )}
        </div>

        <div id="atlas-body" hidden={!open} className="atlas-body">
          <div className="section-label" id="atlas-type-label" style={{ margin: '4px 0 8px' }}>Kind of place</div>
          <div className="chips atlas-chips" role="group" aria-labelledby="atlas-type-label">
            <button type="button" className={`chip${type === 'all' ? ' on' : ''}`} aria-pressed={type === 'all'} onClick={() => setType('all')}>All</button>
            {typeCounts.map(([t, n]) => (
              <button key={t} type="button" className={`chip${type === t ? ' on' : ''}`} aria-pressed={type === t} onClick={() => setType(type === t ? 'all' : t)}>
                {TYPE_LABEL[t] || t} <span className="faint" style={{ fontSize: '.92em' }}>{n}</span>
              </button>
            ))}
          </div>

          <div className="section-label" id="atlas-view-label" style={{ margin: '14px 0 8px' }}>Go to</div>
          <div className="chips atlas-chips" role="group" aria-labelledby="atlas-view-label">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className="chip" onClick={() => setView(v)}>{v.label}</button>
            ))}
          </div>

          <div className="section-label" style={{ margin: '16px 0 6px' }} aria-live="polite">
            {filtered ? `${results.length.toLocaleString()} match${results.length === 1 ? '' : 'es'}` : 'Most mentioned'}
          </div>
          {results.length === 0 ? (
            <p className="small faint" style={{ margin: '4px 0' }}>No places match “{dq}”. Try a shorter spelling; many names vary between translations.</p>
          ) : (
            <ul className="atlas-list">
              {shown.map((p) => (
                <li key={p.id}>
                  {hasCoords(p) ? (
                    <button
                      type="button"
                      className="list-item atlas-row"
                      onClick={() => pick(p, 'list')}
                      aria-current={sel?.id === p.id ? 'true' : undefined}
                    >
                      <span className="atlas-dot" style={{ background: 'var(--c-place)' }} aria-hidden="true" />
                      <span className="atlas-row-text">
                        <span className="atlas-row-name">{p.l}</span>
                        <span className="atlas-row-meta">{p.ft} · {verseLabel(p.vc)}</span>
                      </span>
                    </button>
                  ) : (
                    <Link to={`/places/${p.id}`} className="list-item atlas-row">
                      <span className="atlas-dot unmapped" aria-hidden="true" />
                      <span className="atlas-row-text">
                        <span className="atlas-row-name">{p.l}</span>
                        <span className="atlas-row-meta">Location unknown · {verseLabel(p.vc)}</span>
                      </span>
                      <ChevronRight size={16} className="faint" aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {results.length > limit && (
            <button type="button" className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({(results.length - limit).toLocaleString()} left)
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ markers */
/** All place circles drawn imperatively on the canvas renderer: fast for ~1,300 points. */
function PlaceDots({ places, color, onPick }) {
  const map = useMap();
  const groupRef = useRef(null);
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    const g = layerGroup().addTo(map);
    groupRef.current = g;
    return () => { g.remove(); groupRef.current = null; };
  }, [map]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.clearLayers();
    // Data is sorted by verse count (largest first), so small places are drawn on top and stay clickable.
    for (const p of places) {
      const r = radiusFor(p.vc);
      const m = circleMarker([p.lat, p.lon], {
        radius: r, color, weight: 1, opacity: 0.95, fillColor: color, fillOpacity: 0.5, bubblingMouseEvents: false,
      });
      m.bindTooltip(p.l, { direction: 'top', offset: [0, -r], className: 'place-tip', opacity: 1 });
      m.on('click', () => pickRef.current(p.id));
      g.addLayer(m);
    }
  }, [places, color, map]);

  return null;
}

function PlacePopup({ place }) {
  const { data, loading } = useAsync(() => getPlace(place.id), [place.id]);
  const blurb = useMemo(() => {
    const s = data?.summary || '';
    if (!s) return '';
    const first = s.match(/^.*?[.!?](?=\s|$)/)?.[0] || s;
    return first.length > 190 ? `${first.slice(0, 186).replace(/\s+\S*$/, '')}…` : first;
  }, [data]);
  return (
    <div className="place-pop">
      <div className="place-pop-type"><MapPin size={13} aria-hidden="true" /> {place.ft}</div>
      <h3>{place.l}</h3>
      <div className="place-pop-meta">Named in {verseLabel(place.vc)}</div>
      {loading ? <div className="skeleton" style={{ width: '85%' }} /> : blurb && <p>{blurb}</p>}
      <Link to={`/places/${place.id}`} className="place-pop-link">
        Open place profile <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
