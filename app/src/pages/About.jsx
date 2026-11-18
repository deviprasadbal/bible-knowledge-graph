import { Link } from 'react-router-dom';
import { fetchJSON } from '../lib/data';
import { useAsync, useTitle } from '../components/ui';

const SOURCES = [
  ['Berean Standard Bible (BSB)', 'A modern, accurate English translation, dedicated to the public domain in 2023.', 'https://berean.bible', 'Public domain'],
  ['King James Version (KJV)', 'The classic 1611/1769 English Bible of the Protestant world.', 'https://github.com/scrollmapper/bible_databases', 'Public domain'],
  ['Theographic Bible Metadata', 'People, places, events, family links and verse-level tagging, compiled by Robert Rouse.', 'https://github.com/robertrouse/theographic-bible-metadata', 'CC BY-SA 4.0'],
  ['OpenBible.info cross-references', 'About 340,000 verse-to-verse links, ranked by reader votes.', 'https://www.openbible.info/labs/cross-references/', 'CC BY'],
  ['Creeds.json', 'Historic creeds, confessions and catechisms with proof texts. Only the public-domain texts are used here.', 'https://github.com/NonlinearFruit/Creeds.json', 'Public domain texts'],
  ["Easton's Bible Dictionary (1897)", 'A classic Protestant reference work by M. G. Easton, included in Theographic.', 'https://github.com/robertrouse/theographic-bible-metadata', 'Public domain'],
  ["The Pilgrim's Progress (1678)", 'John Bunyan’s allegory, from Project Gutenberg eBook #131.', 'https://www.gutenberg.org/ebooks/131', 'Public domain'],
  ['OpenStreetMap', 'Map tiles for the Map page.', 'https://www.openstreetmap.org/copyright', 'ODbL'],
];

const REL_EXPLAIN = {
  PARENT_OF: 'Person → Person', SIBLING_OF: 'Person ↔ Person', MARRIED_TO: 'Person ↔ Person', BORN_IN: 'Person → Place', DIED_IN: 'Person → Place',
  MEMBER_OF: 'Person → Group', APPEARS_IN: 'Person → Book', WROTE: 'Person → Book', MENTIONED_IN: 'Place → Book', PART_OF: 'Place → Place, Event → Event',
  PARTICIPATED_IN: 'Person/Group → Event', OCCURRED_AT: 'Event → Place', FOLLOWS: 'Event → Event', RECORDED_IN: 'Event → Book', CITES: 'Creed → Book',
  ECHOES: 'Book → Book (cross-references)', RELATED_TO: 'Theme ↔ Theme', EXEMPLIFIED_BY: 'Theme → Person', CONFESSED_IN: 'Theme → Creed', TAUGHT_IN: 'Theme → Book', EXPLORES: 'Book → Theme',
};

export default function About() {
  useTitle('About & Sources');
  const { data: stats } = useAsync(() => fetchJSON('stats.json'), []);
  return (
    <div className="container page narrow" style={{ maxWidth: 900 }}>
      <span className="eyebrow">About</span>
      <h1>About Lamplight</h1>
      <p className="lead">Lamplight is a knowledge graph of the Bible: a network where people, places, events, books, themes and creeds are <b>nodes</b>, and the facts that connect them are <b>edges</b>. You can follow these connections from any verse to the whole story.</p>

      <h2 style={{ marginTop: 36 }}>Point of view</h2>
      <p>Lamplight explains the Bible as historic, mainstream Protestant Christians read it. It uses the 66-book canon and follows the Reformation principles of Scripture, grace, faith and Christ, along with the confessions of the Reformed, Presbyterian and Baptist traditions. It is written for curious readers of any background, and especially for those coming from another faith. The <b>Bridges</b> notes compare ideas with Hindu philosophy respectfully, and you can turn them off.</p>
      <p>The theme essays, book introductions and journeys were written for this project and checked against the source texts. They are a starting point for your own reading, not a substitute for it.</p>

      <h2 style={{ marginTop: 36 }}>How the graph was built</h2>
      <ol className="prose">
        <li><b>Questions first.</b> Who is connected to whom? Where did it happen? What does the Bible say about grace? How did the Church confess it?</li>
        <li><b>Schema.</b> Seven node types (Person, Place, Event, Book, Theme, Creed, Group) and the relations listed below.</li>
        <li><b>Collect.</b> Free, authoritative sources only (listed below), with the license for each one kept.</li>
        <li><b>Extract and link.</b> Verse-level tags connect each verse to its people, places and events. Creed proof texts and cross-references connect books.</li>
        <li><b>Clean and merge.</b> Every node has a stable ID (for example <code>person:abraham_58</code>), so people with the same name stay distinct.</li>
        <li><b>Store and use.</b> The graph ships as static JSON and as Neo4j-ready CSV with Cypher examples in the project's <code>graph/</code> folder.</li>
      </ol>

      {stats && (
        <>
          <h3 style={{ marginTop: 28 }}>The graph in numbers</h3>
          <div className="grid grid-4">
            {Object.entries(stats.nodeTypes || {}).map(([k, v]) => <div key={k} className="card" style={{ padding: 14 }}><b className="serif" style={{ fontSize: '1.7rem' }}>{v.toLocaleString()}</b><div className="small faint">{k} nodes</div></div>)}
          </div>
          <h3 style={{ marginTop: 28 }}>Relations</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line-2)' }}><th style={{ padding: 8 }}>Relation</th><th style={{ padding: 8 }}>Connects</th><th style={{ padding: 8, textAlign: 'right' }}>Count</th></tr></thead>
              <tbody>
                {Object.entries(stats.relations || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 8 }}><code>{k}</code></td><td style={{ padding: 8 }} className="muted">{REL_EXPLAIN[k] || ''}</td><td style={{ padding: 8, textAlign: 'right' }}>{v.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 40 }}>Sources & licenses</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {SOURCES.map(([name, desc, url, lic]) => (
          <div key={name} className="card" style={{ padding: 16 }}>
            <div className="row"><b>{name}</b><span className="spacer" /><span className="badge">{lic}</span></div>
            <p className="small muted" style={{ margin: '4px 0' }}>{desc}</p>
            <a href={url} target="_blank" rel="noreferrer" className="md-link small">{url}</a>
          </div>
        ))}
      </div>
      <p className="small faint" style={{ marginTop: 20 }}>
        The graph data derived from Theographic is shared under CC BY-SA 4.0. Lamplight has no ads, no tracking and no accounts. Your notes stay in your browser.
      </p>
      <p><Link to="/start" className="btn">Start reading</Link></p>
    </div>
  );
}
