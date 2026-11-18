import { Link } from 'react-router-dom';
import { fetchJSON, THEME_CATEGORIES } from '../lib/data';
import { Icon, Skeleton, useAsync, useTitle } from '../components/ui';

export default function Themes() {
  useTitle('Big Questions & Themes');
  const { data, loading } = useAsync(() => fetchJSON('themes.json'), []);
  return (
    <div className="container page">
      <span className="eyebrow">Themes · philosophy · doctrine</span>
      <h1>Big Questions</h1>
      <p className="lead">
        Why is there anything at all? What is a human being? Why do we suffer? Each theme sets out what Protestant
        Christians believe and why, follows the question into philosophy, and lets you check every claim against the text itself.
      </p>
      {loading && <Skeleton lines={6} />}
      {!loading && !data?.length && <div className="panel" style={{ marginTop: 20 }}>The themes are still being written. Please check back soon.</div>}
      {THEME_CATEGORIES.map((cat) => {
        const items = (data || []).filter((t) => t.category === cat.id);
        if (!items.length) return null;
        return (
          <section key={cat.id} style={{ marginTop: 44 }}>
            <h2>{cat.title}</h2>
            <p className="muted" style={{ maxWidth: 640 }}>{cat.blurb}</p>
            <div className="grid grid-3" style={{ marginTop: 14 }}>
              {items.map((t) => (
                <Link key={t.id} to={`/themes/${t.id}`} className="card link">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="card-icon"><Icon name={t.icon} /></div>
                    <span className="spacer" />
                    {t.bridge && <span className="badge" title="Includes a Bridges comparison">Bridges</span>}
                  </div>
                  <h3>{t.title}</h3>
                  <p className="serif" style={{ fontStyle: 'italic', fontSize: '1.12rem', color: 'var(--ink-2)', margin: 0 }}>{t.hook}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
