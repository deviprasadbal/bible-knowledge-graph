import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Upload } from 'lucide-react';
import { books, formatRef, refLink } from '../lib/data';
import { addJournal, deleteJournal, exportState, importState, setNote, toggleBookmark, useStore } from '../lib/store';
import { useTitle } from '../components/ui';

export default function MyJourney() {
  useTitle('My Journey');
  const s = useStore();
  const [tab, setTab] = useState('progress');
  const [entry, setEntry] = useState('');
  const fileRef = useRef();
  const all = books();
  const totalCh = all.reduce((a, b) => a + b.chapters, 0);
  const readCount = Object.keys(s.read).length;
  const bookmarks = Object.entries(s.bookmarks).sort((a, b) => b[1] - a[1]);
  const notes = Object.entries(s.notes).sort((a, b) => b[1].t - a[1].t);
  const highlights = Object.entries(s.highlights);
  const pct = (readCount / totalCh) * 100;

  const doExport = () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lamplight-journey-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { importState(await f.text()); alert('Your journey was restored.'); } catch { alert('That file could not be read.'); }
  };

  return (
    <div className="container page">
      <span className="eyebrow">Private to this device</span>
      <h1>My Journey</h1>
      <p className="lead">Your reading progress, saved verses, notes and reflections. Everything is stored only in this browser. Nothing is sent anywhere. Use Export to keep a backup or move it to another device.</p>
      <div className="row" style={{ margin: '14px 0 26px' }}>
        <button className="btn sm" onClick={doExport}><Download size={15} /> Export</button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import</button>
        <input type="file" accept="application/json" ref={fileRef} onChange={doImport} hidden />
      </div>

      <div className="tabs" role="tablist">
        {[['progress', 'Reading progress'], ['saved', `Saved (${bookmarks.length})`], ['notes', `Notes (${notes.length})`], ['journal', `Journal (${s.journal.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'progress' && (
        <>
          <div className="row" style={{ gap: 30, alignItems: 'center' }}>
            <Ring pct={pct} />
            <div>
              <h2 style={{ margin: 0 }}>{readCount} of {totalCh.toLocaleString()} chapters</h2>
              <p className="muted" style={{ margin: 0 }}>{highlights.length} highlights · {notes.length} notes · {Object.keys(s.journeys).length} journeys begun</p>
            </div>
          </div>
          <div className="grid grid-4" style={{ marginTop: 24, gap: 8 }}>
            {all.map((b) => {
              const n = Object.keys(s.read).filter((k) => k.startsWith(b.osis + '.')).length;
              return (
                <Link key={b.osis} to={`/read/${b.osis}/1`} className="list-item" style={{ display: 'block', border: '1px solid var(--line)' }}>
                  <div className="row small" style={{ gap: 6 }}><b>{b.name}</b><span className="spacer" /><span className="faint">{n}/{b.chapters}</span></div>
                  <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${(n / b.chapters) * 100}%` }} /></div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {tab === 'saved' && (bookmarks.length === 0 ? <Empty text="Tap any verse in the reader and choose Save." /> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {bookmarks.map(([r]) => (
            <div key={r} className="row xref" style={{ flexWrap: 'nowrap' }}>
              <Link to={refLink(r)} className="md-link" style={{ flex: 1 }}>{formatRef(r)}</Link>
              {s.highlights[r] && <span className="swatch" style={{ width: 14, height: 14, background: `var(--hl-${s.highlights[r]})` }} />}
              <button className="icon-btn" onClick={() => toggleBookmark(r)} aria-label="Remove"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ))}

      {tab === 'notes' && (notes.length === 0 ? <Empty text="Notes you write on verses will appear here." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {notes.map(([r, n]) => (
            <div key={r} className="card" style={{ padding: 14 }}>
              <div className="row"><Link to={refLink(r)} className="md-link"><b>{formatRef(r)}</b></Link><span className="spacer" /><span className="small faint">{new Date(n.t).toLocaleDateString()}</span>
                <button className="icon-btn" onClick={() => setNote(r, '')} aria-label="Delete note"><Trash2 size={15} /></button></div>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{n.text}</p>
            </div>
          ))}
        </div>
      ))}

      {tab === 'journal' && (
        <>
          <div className="panel">
            <span className="eyebrow">New entry</span>
            <textarea className="input" placeholder="What are you wondering about today?" value={entry} onChange={(e) => setEntry(e.target.value)} />
            <button className="btn sm gold" style={{ marginTop: 8 }} disabled={!entry.trim()} onClick={() => { addJournal(entry, ''); setEntry(''); }}>Save entry</button>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {s.journal.map((j) => (
              <div key={j.id} className="card" style={{ padding: 16 }}>
                <div className="row"><span className="small faint">{new Date(j.t).toLocaleString()}</span><span className="spacer" /><button className="icon-btn" onClick={() => deleteJournal(j.id)} aria-label="Delete entry"><Trash2 size={15} /></button></div>
                {j.prompt && <div className="small" style={{ color: 'var(--gold)', marginBottom: 4 }}>{j.prompt}</div>}
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{j.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ text }) { return <div className="empty">{text}</div>; }

function Ring({ pct }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" aria-label={`${pct.toFixed(1)}% read`}>
      <circle cx="55" cy="55" r={r} stroke="var(--line)" strokeWidth="9" fill="none" />
      <circle cx="55" cy="55" r={r} stroke="var(--gold)" strokeWidth="9" fill="none" strokeLinecap="round" className="progress-ring"
        style={{ transformOrigin: 'center' }} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      <text x="55" y="61" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fontWeight="700" fill="var(--ink)">{pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</text>
    </svg>
  );
}
