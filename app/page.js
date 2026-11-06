'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// "KASUN PERERA" / "kasun perera" -> "Kasun Perera"
const nice = (s) => tidy(s).toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
const val = (k, v) => (/name/i.test(k) ? nice(v) : tidy(v));
const esc =(s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Hl({ text, terms, name }) {
  const t = name ? nice(text) : tidy(text);
  if (!terms.length) return t;
  const re = new RegExp('(' + terms.map(esc).join('|') + ')', 'gi');
  return t.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

export default function Home() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(null);
  const [adding, setAdding] = useState(false);
  const [cols, setCols] = useState({ columns: [], nameCol: '' });
  const [form, setForm] = useState({});
  const [mark, setMark] = useState(true);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [auth, setAuth] = useState(null);
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const seq = useRef(0);
  const input = useRef(null);

  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((j) => setAuth(!!j.ok)).catch(() => setAuth(false));
  }, []);

  const loadStats = useCallback(() => fetch('/api/stats').then((r) => {
    if (r.status === 401) { setAuth(false); return null; }
    return r.json();
  }).then((j) => j && setStats(j)).catch(() => {}), []);
  useEffect(() => { if (auth) loadStats(); }, [auth, loadStats]);

  const login = async (e) => {
    e.preventDefault();
    setLoginBusy(true); setLoginErr('');
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: pw }),
    });
    setLoginBusy(false);
    if (!res.ok) return setLoginErr('Invalid username or password.');
    setPw(''); setAuth(true);
  };
  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setAuth(false); setStats(null); setRows(null); setQ('');
  };

  const search = useCallback(async (text) => {
    const my = ++seq.current;
    if (!text.trim()) { setRows(null); setLoading(false); return; }
    setLoading(true);
    const res = await fetch('/api/search?q=' + encodeURIComponent(text));
    if (res.status === 401) { setAuth(false); setLoading(false); return; }
    const r = await res.json();
    if (my === seq.current) { setRows(r); setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 180);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const k = (e) => {
      if (e.key !== 'Escape') return;
      if (!busy) setSelected(null);
      if (!addBusy) setAdding(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [busy, addBusy]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };
  const pick = (r) => (r.marked_at ? notify(`${nice(r.name)} is already marked present`) : setSelected(r));

  const confirm = async () => {
    setBusy(true);
    const res = await fetch('/api/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: selected.id }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.status === 401) { setSelected(null); return setAuth(false); }
    if (res.ok) {
      setDone({ name: j.name, at: j.marked_at });
      setSelected(null);
      setQ(''); setRows(null); loadStats();
      setTimeout(() => { setDone(null); input.current?.focus(); }, 1800);
    } else {
      setSelected(null);
      notify(j.error);
      search(q);
    }
  };

  const openAdd = async () => {
    const cr = await fetch('/api/people');
    if (cr.status === 401) return setAuth(false);
    const c = await cr.json();
    setCols(c);
    setForm(Object.fromEntries(c.columns.map((k) => [k, k === c.nameCol ? nice(q) : ''])));
    setAddErr('');
    setAdding(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    setAddBusy(true); setAddErr('');
    const res = await fetch('/api/people', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: form, mark }),
    });
    const j = await res.json();
    setAddBusy(false);
    if (res.status === 401) { setAdding(false); return setAuth(false); }
    if (!res.ok) return setAddErr(j.error || 'Could not add this person.');
    setAdding(false); setQ(''); setRows(null); loadStats();
    if (j.marked_at) {
      setDone({ name: j.name, at: j.marked_at });
      setTimeout(() => { setDone(null); input.current?.focus(); }, 1800);
    } else notify(`${nice(j.name)} added to the list`);
  };

  const terms = q.trim().split(/\s+/).filter(Boolean);
  const pct = stats && stats.total ? Math.round((stats.present / stats.total) * 100) : 0;

  if (auth === null) return null;

  if (!auth) {
    return (
      <>
        <div className="hero small" />
        <main className="shell flat">
          <form className="glass panel login" onSubmit={login}>
            <div className="lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </div>
            <h1 className="title">Staff <span>Login</span></h1>
            <p className="sub">Sign in to mark attendance</p>
            <label className="field">Username
              <input autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} />
            </label>
            <label className="field">Password
              <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <div className="err">{loginErr}</div>
            <button className="btn" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="hero" />
      <main className="shell">
        <section className="glass panel">
          <header className="head">
            <h1>Mark <span>Attendance</span></h1>
            <div className="rule" />
          </header>

          <div className="searchrow">
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input ref={input} autoFocus autoComplete="off" spellCheck="false" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && rows?.[0] && pick(rows[0])}
                placeholder="Start typing to search…" />
              {q && <button className="clear" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Clear">✕</button>}
            </div>
            <button className={'addbtn' + (rows?.length === 0 ? ' pulse' : '')} onClick={openAdd} title="Not in the list? Add new person" aria-label="Add new person">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <div className="results">
            {loading && !rows && [0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
            {rows?.length === 0 && (
              <div className="empty">
                <div className="big">🔍</div>No one matches “{q}”
                <div><button className="btn" style={{ marginTop: 14 }} onClick={openAdd}>＋ Add “{nice(q)}” to the list</button></div>
              </div>
            )}
            {rows?.map((r, i) => {
              const serialKey = Object.keys(r.data).find((k) => /serial/i.test(k) && tidy(r.data[k]));
              const extra = Object.entries(r.data).filter(([k, v]) => v && k !== serialKey && tidy(v) !== tidy(r.name));
              return (
                <button key={r.id} className={'person' + (r.marked_at ? ' done' : '')} style={{ animationDelay: i * 30 + 'ms' }} onClick={() => pick(r)}>
                  {serialKey && <div className="serial" title={serialKey}><Hl text={r.data[serialKey]} terms={terms} /></div>}
                  <div className="pinfo">
                    <div className="pname"><Hl text={r.name} terms={terms} name /></div>
                    <div className="chips">
                      {extra.map(([k, v]) => <span className="chip" key={k}>{k}: <b><Hl text={v} terms={terms} name={/name/i.test(k)} /></b></span>)}
                    </div>
                  </div>
                  {r.marked_at ? <span className="tag ok">✓ Present</span> : <span className="tag go">Tap to mark →</span>}
                </button>
              );
            })}
          </div>
        </section>
        <button type="button" className="logout" onClick={logout}>Log out</button>
      </main>

      {selected && (
        <div className="modal" onClick={() => !busy && setSelected(null)}>
          <div className="glass box" onClick={(e) => e.stopPropagation()}>
            <h2 className="nm">{nice(selected.name)}</h2>
            <div className="who">Confirm this person is attending</div>
            <div className="details">
              {Object.entries(selected.data).map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{val(k, v)}</b></div>)}
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setSelected(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Saving…' : 'Confirm ✓'}</button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="modal" onClick={() => !addBusy && setAdding(false)}>
          <form className="glass box addform" onClick={(e) => e.stopPropagation()} onSubmit={submitAdd}>
            <h2>Add new person</h2>
            <div className="who">Not in the list? Add them here.</div>
            {cols.columns.map((k) => (
              <label className="field" key={k}>{k}{k === cols.nameCol && ' *'}
                <input type={/contact|phone|mobile/i.test(k) ? 'tel' : 'text'} inputMode={/contact|phone|mobile/i.test(k) ? 'tel' : undefined} value={form[k] ?? ''} autoFocus={k === cols.nameCol} maxLength={200} autoComplete="off"
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
            <label className="check-row">
              <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} />
              Mark present now
            </label>
            {addErr && <div className="err">{addErr}</div>}
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setAdding(false)} disabled={addBusy}>Cancel</button>
              <button className="btn" disabled={addBusy || !(form[cols.nameCol] || '').trim()}>{addBusy ? 'Saving…' : mark ? 'Add & mark ✓' : 'Add person'}</button>
            </div>
          </form>
        </div>
      )}

      {done && (
        <div className="modal">
          <div className="glass box">
            <svg className="check" viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" /><path d="M14 27l8 8 16-17" /></svg>
            <h2>Attendance marked</h2>
            <div className="who nm" style={{ marginTop: 8, fontSize: 16, color: '#fff' }}>{nice(done.name)}</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="counter" title={`${pct}% present today`}>
          <div className="cnum">{stats.present}<small> / {stats.total}</small></div>
          <div className="clbl">Present today</div>
          <div className="track"><div className="fill" style={{ width: pct + '%' }} /></div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
