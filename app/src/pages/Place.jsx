import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, BookOpen, CalendarClock, Map as MapIcon, MapPin, Network } from 'lucide-react';
import { OSIS, bookByOsis, fetchJSON, getPlace, refLink, yearLabel } from '../lib/data';
import { ErrorNote, KeyVerse, Skeleton, VerseRef, useAsync, useLookup, useTitle } from '../components/ui';
import { Md } from '../lib/md';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PRECISION_NOTE = {
  Rough: 'Approximate location: the exact site is uncertain.',
  'Related-Surrounding': 'Shown at the surrounding area; the exact site is uncertain.',
  'Related-Within': 'Shown at a related nearby site; the exact spot is uncertain.',
};
const ZOOM_FOR = { Region: 6, Water: 7, Mountain: 9, Valley: 9, Island: 8, City: 10, Landmark: 12 };

/** Read CSS custom properties as real colors (Leaflet paths need them) and follow theme changes. */
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

function km(a, b) {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const baseName = (s) => String(s || '').replace(/\s*\(.*\)\s*$/, '').trim();
const verseLabel = (n) => `${(n || 0).toLocaleString()} verse${n === 1 ? '' : 's'}`;

export default function Place() {
  const { id } = useParams();
  const { data, loading, error } = useAsync(() => getPlace(id), [id]);
  useTitle(data?.name || (loading ? 'Place' : 'Place not found'));
  if (error) return <div className="container page"><ErrorNote error={error} /></div>;
  if (loading) return <div className="container page"><Skeleton lines={8} /></div>;
  if (!data) {
    return (
      <div className="container page empty">
        <h2>We couldn't find that place</h2>
        <p>It may have been renamed or merged with another entry.</p>
        <Link to="/places" className="btn"><MapIcon size={16} /> Back to the map</Link>
      </div>
    );
  }
  return <PlaceProfile key={id} place={data} />;
}

function PlaceProfile({ place }) {
  const people = useLookup('people.json');
  const placesList = useLookup('places.json');
  const events = useLookup('events.json');
  const dictIndex = useLookup('dictionary/index.json');

  const peopleById = useMemo(() => new Map((people || []).map((p) => [p.id, p])), [people]);
  const placeById = useMemo(() => new Map((placesList || []).map((p) => [p.id, p])), [placesList]);
  const eventById = useMemo(() => new Map((events || []).map((e) => [e.id, e])), [events]);

  const type = place.featureType || 'Place';
  const located = place.lat != null && place.lon != null;
  const otherNames = useMemo(() => {
    const seen = new Set([place.name.toLowerCase(), baseName(place.name).toLowerCase()]);
    const out = [];
    const add = (n, tag) => {
      if (!n) return;
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(tag ? `${n} (${tag})` : n);
    };
    (place.aka || []).forEach((n) => add(n));
    add(place.kjvName, 'KJV');
    add(place.esvName, 'ESV');
    return out;
  }, [place]);

  const bookRows = useMemo(() => {
    const entries = Object.entries(place.books || {}).filter(([, n]) => n > 0);
    entries.sort((a, b) => OSIS.indexOf(a[0]) - OSIS.indexOf(b[0]));
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return entries.map(([osis, n]) => {
      const first = (place.verses || []).find((r) => r.startsWith(`${osis}.`));
      return { osis, n, pct: (n / max) * 100, name: bookByOsis(osis)?.name || osis, to: first ? refLink(first) : `/read/${osis}/1` };
    });
  }, [place]);

  const verses = place.verses || [];
  const keyRefs = verses.slice(0, 12);

  const placeEvents = useMemo(() => {
    if (!events) return [];
    return (place.events || []).map((id) => eventById.get(id)).filter(Boolean).sort((a, b) => a.sort - b.sort);
  }, [place, events, eventById]);

  const nearby = useMemo(() => {
    if (!located || !placesList) return [];
    return placesList
      .filter((p) => p.id !== place.id && p.lat != null && p.vc > 0)
      .map((p) => ({ ...p, d: km(place, p) }))
      .filter((p) => p.d > 0.4 && p.d < 60)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [located, placesList, place]);

  const dictId = useMemo(() => {
    if (!dictIndex) return null;
    const want = baseName(place.name).toLowerCase();
    return dictIndex.find((d) => d.l.toLowerCase() === want)?.id || null;
  }, [dictIndex, place]);

  const comment = place.comment && !/^https?:/i.test(place.comment.trim()) ? place.comment.replace(/^[;,\s]+/, '').trim() : '';
  const personChip = (pid) => {
    const p = peopleById.get(pid);
    return (
      <Link key={pid} to={`/people/${pid}`} className="chip" title={p?.sub || undefined}>
        <span className="dot" style={{ background: 'var(--c-person)' }} aria-hidden="true" />{p?.l || pid.replace(/_\d+$/, '')}
      </Link>
    );
  };

  return (
    <div className="container page place-page">
      <nav className="small" aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
        <Link to={located ? `/places?p=${place.id}` : '/places'} className="md-link"><ArrowLeft size={14} style={{ verticalAlign: '-2px' }} /> Map of the Bible</Link>
      </nav>

      <header className="place-head">
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <span className="badge place-badge"><MapPin size={12} aria-hidden="true" /> {type}{place.featureSubType ? ` · ${place.featureSubType}` : ''}</span>
          <span className="small faint">Named in {verseLabel(place.verseCount)}{bookRows.length ? ` across ${bookRows.length} book${bookRows.length === 1 ? '' : 's'}` : ''}</span>
        </div>
        <h1>{place.name}</h1>
        {otherNames.length > 0 && <p className="muted" style={{ marginTop: -4 }}>Also called {otherNames.join(', ')}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <Link to={`/explore?focus=place:${place.id}`} className="btn primary"><Network size={16} aria-hidden="true" /> See in the graph</Link>
          {located && <Link to={`/places?p=${place.id}`} className="btn"><MapIcon size={16} aria-hidden="true" /> Open in the atlas</Link>}
        </div>
      </header>

      <div className="two-col" style={{ marginTop: 30 }}>
        <div>
          {place.summary && (
            <section>
              <p className="prose place-summary">{place.summary}</p>
            </section>
          )}

          {keyRefs.length > 0 && (
            <section>
              <div className="section-label"><BookOpen size={14} aria-hidden="true" /> Key verses</div>
              {keyRefs.slice(0, 3).map((r) => <KeyVerse key={r} refStr={r} />)}
              {keyRefs.length > 3 && (
                <div className="chips" style={{ marginTop: 6 }}>
                  {keyRefs.slice(3).map((r) => <VerseRef key={r} refStr={r} className="chip" />)}
                </div>
              )}
              {place.verseCount > keyRefs.length && (
                <p className="small faint" style={{ marginTop: 10 }}>
                  Showing {keyRefs.length} of {verseLabel(place.verseCount)}. Hover or focus a reference to preview it.
                </p>
              )}
            </section>
          )}

          {place.easton && (
            <section className="place-easton">
              <div className="section-label">From Easton's Bible Dictionary (1897)</div>
              <Md text={place.easton} className="prose" />
              <p className="small faint">
                Easton wrote in the 1890s; some identifications and dates have since been revised.
                {dictId && <> <Link to={`/dictionary/${dictId}`} className="md-link">Open the full entry</Link>.</>}
              </p>
            </section>
          )}

          {placeEvents.length > 0 && (
            <section>
              <div className="section-label"><CalendarClock size={14} aria-hidden="true" /> What happened here</div>
              <div className="place-events">
                {placeEvents.map((e) => (
                  <Link key={e.id} to={`/timeline?e=${e.id}`} className="list-item place-event">
                    <span className="place-event-year">{e.year != null ? yearLabel(e.year) : `c. ${yearLabel(Math.floor(e.sort))}`}</span>
                    <span>{e.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {!events && (place.events || []).length > 0 && <Skeleton lines={3} />}
        </div>

        <aside className="sticky-side place-side">
          {located ? (
            <div className="card place-map-card">
              <MiniMap place={place} nearby={nearby} />
              {PRECISION_NOTE[place.precision] && <p className="small faint" style={{ margin: '10px 2px 0' }}>{PRECISION_NOTE[place.precision]}</p>}
            </div>
          ) : (
            <div className="panel">
              <b className="serif" style={{ fontSize: '1.15rem' }}>Location unknown</b>
              <p className="small muted" style={{ margin: '4px 0 0' }}>This site has not been identified with confidence, so it is not shown on the map.</p>
            </div>
          )}

          <dl className="kv" style={{ marginTop: 18 }}>
            <dt>Kind</dt><dd>{type}{place.featureSubType ? ` (${place.featureSubType.toLowerCase()})` : ''}</dd>
            {located && <><dt>Coordinates</dt><dd>{place.lat.toFixed(3)}, {place.lon.toFixed(3)}</dd></>}
            <dt>Mentions</dt><dd>{verseLabel(place.verseCount)}</dd>
            {comment && <><dt>Note</dt><dd>{comment}</dd></>}
          </dl>

          {(place.partOf || []).length > 0 && (
            <>
              <div className="section-label">Part of</div>
              <div className="chips">
                {place.partOf.map((pid) => (
                  <Link key={pid} to={`/places/${pid}`} className="chip">
                    <span className="dot" style={{ background: 'var(--c-place)' }} aria-hidden="true" />{placeById.get(pid)?.l || baseName(pid.replace(/_\d+$/, '').replace(/-/g, ' '))}
                  </Link>
                ))}
              </div>
            </>
          )}

          {(place.peopleBorn || []).length > 0 && (
            <>
              <div className="section-label">Born here</div>
              <div className="chips">{place.peopleBorn.map(personChip)}</div>
            </>
          )}
          {(place.peopleDied || []).length > 0 && (
            <>
              <div className="section-label">Died here</div>
              <div className="chips">{place.peopleDied.map(personChip)}</div>
            </>
          )}

          {nearby.length > 0 && (
            <>
              <div className="section-label">Nearby</div>
              <div className="chips">
                {nearby.map((p) => (
                  <Link key={p.id} to={`/places/${p.id}`} className="chip">
                    {p.l} <span className="faint">{p.d < 10 ? p.d.toFixed(1) : Math.round(p.d)} km</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {bookRows.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <div className="section-label">Appears in</div>
          <p className="small muted" style={{ marginTop: -4 }}>Verses naming {baseName(place.name)}, book by book in canonical order.</p>
          <div className="book-bars">
            {bookRows.map((b) => (
              <Link key={b.osis} to={b.to} className="book-bar" aria-label={`${b.name}: ${verseLabel(b.n)}`}>
                <span className="book-bar-name">{b.name}</span>
                <span className="bar" aria-hidden="true"><i style={{ width: `${Math.max(2, b.pct)}%` }} /></span>
                <span className="book-bar-n">{b.n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniMap({ place, nearby }) {
  const colors = useCssColors(COLOR_SPEC);
  const navigate = useNavigate();
  const zoom = ZOOM_FOR[place.featureType] || 9;
  const r = 7;
  return (
    <div className="place-mini">
      <MapContainer
        center={[place.lat, place.lon]}
        zoom={zoom}
        minZoom={3}
        maxZoom={16}
        scrollWheelZoom={false}
        preferCanvas
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />
        {nearby.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={4}
            pathOptions={{ color: colors.place, weight: 1, fillColor: colors.place, fillOpacity: 0.45 }}
            eventHandlers={{ click: () => navigate(`/places/${p.id}`) }}
          >
            <Tooltip direction="top" offset={[0, -4]} className="place-tip" opacity={1}>{p.l}</Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker
          center={[place.lat, place.lon]}
          radius={r}
          pathOptions={{ color: colors.gold, weight: 3, fillColor: colors.place, fillOpacity: 0.95 }}
        >
          <Tooltip direction="top" offset={[0, -r]} className="place-tip" opacity={1} permanent>{baseName(place.name)}</Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
