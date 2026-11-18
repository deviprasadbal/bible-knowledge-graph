// Tiny markdown renderer for curated text and dictionary entries.
// Supports paragraphs, **bold**, *italic*, [text](link) and "- " lists. Links in Theographic/Easton
// text look like "/rev#Rev.1.8" or "/person/god_1324" and are mapped to in-app routes.
import { Link } from 'react-router-dom';
import { refLink } from './data';

function mapHref(href) {
  if (!href) return null;
  const hash = href.split('#')[1];
  if (hash && /^[1-3]?[A-Za-z]+\.\d+(\.\d+)?/.test(hash)) return refLink(hash);
  let m = href.match(/^\/person\/(.+)$/);
  if (m) return `/people/${m[1]}`;
  m = href.match(/^\/place\/(.+)$/);
  if (m) return `/places/${m[1]}`;
  if (href.startsWith('/')) return href;
  return null;
}

function inline(text, keyBase = '') {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = keyBase + i++;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else {
      const to = mapHref(m[5]);
      if (to) out.push(<Link key={k} to={to} className="md-link">{m[4]}</Link>);
      else if (/^https?:/.test(m[5])) out.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer">{m[4]}</a>);
      else out.push(m[4]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text, className = '' }) {
  if (!text) return null;
  const blocks = String(text).replace(/\r/g, '').split(/\n\s*\n/);
  return (
    <div className={`md ${className}`}>
      {blocks.map((b, i) => {
        const lines = b.trim().split('\n');
        if (lines.every((l) => /^\s*[-*] /.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ''), `${i}-${j}-`)}</li>)}</ul>;
        }
        const h = b.match(/^(#{2,4}) (.*)/);
        if (h) return <h3 key={i}>{inline(h[2])}</h3>;
        return b.trim() ? <p key={i}>{inline(b.trim().replace(/\n/g, ' '), `${i}-`)}</p> : null;
      })}
    </div>
  );
}

export { inline as mdInline };
