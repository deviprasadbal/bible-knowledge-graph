import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Menu, Moon, Search, Sun, SunMoon, X } from 'lucide-react';
import { loadCore } from './lib/data';
import { setSetting, useStore } from './lib/store';
import { BrandMark, Skeleton } from './components/ui';
import SearchPalette from './components/SearchPalette';

const Home = lazy(() => import('./pages/Home'));
const Reader = lazy(() => import('./pages/Reader'));
const Explore = lazy(() => import('./pages/Explore'));
const People = lazy(() => import('./pages/People'));
const Person = lazy(() => import('./pages/Person'));
const Places = lazy(() => import('./pages/Places'));
const Place = lazy(() => import('./pages/Place'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Themes = lazy(() => import('./pages/Themes'));
const Theme = lazy(() => import('./pages/Theme'));
const Journeys = lazy(() => import('./pages/Journeys'));
const Journey = lazy(() => import('./pages/Journey'));
const Creeds = lazy(() => import('./pages/Creeds'));
const Creed = lazy(() => import('./pages/Creed'));
const Dictionary = lazy(() => import('./pages/Dictionary'));
const Library = lazy(() => import('./pages/Library'));
const Pilgrim = lazy(() => import('./pages/Pilgrim'));
const Start = lazy(() => import('./pages/Start'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const MyJourney = lazy(() => import('./pages/MyJourney'));
const About = lazy(() => import('./pages/About'));

const LINKS = [
  ['/start', 'Start Here'],
  ['/read', 'Read'],
  ['/themes', 'Big Questions'],
  ['/explore', 'Graph'],
  ['/people', 'People'],
  ['/places', 'Map'],
  ['/timeline', 'Timeline'],
  ['/journeys', 'Journeys'],
  ['/creeds', 'Creeds'],
  ['/library', 'Library'],
  ['/dictionary', 'Dictionary'],
];

function useThemeAttr() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);
  return theme;
}

function Layout() {
  const theme = useThemeAttr();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const nextTheme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  const ThemeIcon = theme === 'auto' ? SunMoon : theme === 'light' ? Sun : Moon;
  const fullBleed = /^\/(explore|places)\/?$/.test(loc.pathname);
  return (
    <>
      <a href="#main" className="sr-only" style={{ position: 'absolute', left: -9999 }}>Skip to content</a>
      <header className="nav">
        <div className="container" style={fullBleed ? { maxWidth: 'none' } : undefined}>
          <Link to="/" className="brand" aria-label="Lamplight home">
            <BrandMark />
            <span className="brand-name">Lamplight</span>
          </Link>
          <nav className="nav-links desktop" aria-label="Main">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{label}</NavLink>
            ))}
          </nav>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => setSearch(true)} aria-label="Search (⌘K)" title="Search  ⌘K"><Search size={19} /></button>
          <NavLink to="/my" className="icon-btn" aria-label="My journey" title="My journey">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
          </NavLink>
          <button className="icon-btn" onClick={() => setSetting('theme', nextTheme)} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}><ThemeIcon size={19} /></button>
          <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {menu && (
        <nav className="mobile-menu" aria-label="Main mobile">
          {[['/', 'Home'], ...LINKS, ['/my', 'My Journey'], ['/about', 'About & Sources']].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{label}</NavLink>
          ))}
        </nav>
      )}
      <main id="main">
        <Suspense fallback={<div className="container page"><Skeleton lines={6} /></div>}>
          <Outlet />
        </Suspense>
      </main>
      {!fullBleed && <Footer />}
      {search && <SearchPalette onClose={() => setSearch(false)} />}
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="row" style={{ alignItems: 'flex-start', gap: 40 }}>
          <div style={{ maxWidth: 420 }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}><BrandMark /><b className="serif" style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>Lamplight</b></div>
            <p>“Your word is a lamp to my feet and a light to my path.” (Psalm 119:105)</p>
            <p>A knowledge graph of the 66 books of the Protestant Bible, built from free, public-domain and openly licensed sources.</p>
          </div>
          <div className="spacer" />
          <div style={{ display: 'grid', gap: 6 }}>
            <Link to="/about">About, sources & licenses</Link>
            <Link to="/start">New here? Start here</Link>
            <Link to="/my">My journey (saved on this device)</Link>
          </div>
        </div>
        <p style={{ marginTop: 24 }}>
          Scripture: Berean Standard Bible (public domain) and King James Version. Data: Theographic Bible Metadata (CC BY-SA 4.0),
          OpenBible.info cross-references (CC BY), historic creeds (public domain), Easton's Bible Dictionary (1897).
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { loadCore().then(() => setReady(true)).catch(setErr); }, []);
  if (err) return <div className="container page">Couldn't start the app: {String(err.message)}</div>;
  if (!ready) return <div className="container page"><Skeleton lines={4} /></div>;
  return (
    <HashRouter>
      <ScrollReset />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="start" element={<Start />} />
          <Route path="read" element={<Reader />} />
          <Route path="read/:book" element={<Reader />} />
          <Route path="read/:book/:chapter" element={<Reader />} />
          <Route path="explore" element={<Explore />} />
          <Route path="people" element={<People />} />
          <Route path="people/:id" element={<Person />} />
          <Route path="places" element={<Places />} />
          <Route path="places/:id" element={<Place />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="themes" element={<Themes />} />
          <Route path="themes/:id" element={<Theme />} />
          <Route path="journeys" element={<Journeys />} />
          <Route path="journeys/:id" element={<Journey />} />
          <Route path="creeds" element={<Creeds />} />
          <Route path="creeds/:id" element={<Creed />} />
          <Route path="dictionary" element={<Dictionary />} />
          <Route path="dictionary/:id" element={<Dictionary />} />
          <Route path="library" element={<Library />} />
          <Route path="library/pilgrims-progress" element={<Pilgrim />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="my" element={<MyJourney />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<div className="container page empty"><h2>Page not found</h2><Link to="/">Go home</Link></div>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => { if (!pathname.startsWith('/read')) window.scrollTo(0, 0); }, [pathname]);
  return null;
}
