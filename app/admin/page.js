'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// "KASUN PERERA" / "kasun perera" -> "Kasun Perera"
const nice = (s) => tidy(s).toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
const val = (k, v) => (/name/i.test(k) ? nice(v) : tidy(v));
const localToday = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function Admin() {
  const [auth, setAuth] = useState(null);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ rows: [], totalPeople: 0 });

  useEffect(() => {
    setDate(localToday());
    fetch('/api/admin/me').then((r) => r.json()).then((j) => setAuth(j.admin));
  }, []);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ q });
    if (date) sp.set('date', date);
    const r = await fetch('/api/admin/attendance?' + sp);
    if (r.status === 401) return setAuth(false);
    setData(await r.json());
  }, [q, date]);

  useEffect(() => {
    if (!auth) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [auth, load]);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });
    setBusy(false);
    if (r.ok) { setErr(''); setP(''); setAuth(true); } else setErr('Invalid username or password');
  };
  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); setAuth(false); };
  const remove = async (id) => {
    if (!confirm('Remove this attendance record?')) return;
    await fetch('/api/admin/attendance/' + id, { method: 'DELETE' });
    load();
  };

  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('append');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const closeImport = () => { if (importing) return; setShowImport(false); setFile(null); setResult(null); };
  const runImport = async () => {
    if (!file) return setResult({ error: 'Choose a file first.' });
    if (mode === 'replace' && !confirm('Replace the list? People without attendance records will be removed first.')) return;
    if (mode === 'clear' && !confirm('Clear the ENTIRE existing list and ALL attendance records, then import this file?\n\nThis cannot be undone.')) return;
    setImporting(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file); fd.append('mode', mode);
    try {
      const r = await fetch('/api/admin/import', { method: 'POST', body: fd });
      if (r.status === 401) return setAuth(false);
      setResult(await r.json());
      if (r.ok) load();
    } catch {
      setResult({ error: 'Upload failed. Please try again.' });
    } finally {
      setImporting(false);
    }
  };

  const { rows, totalPeople } = data;
  const cols = [...new Set(rows.flatMap((x) => Object.keys(x.data)))];
  const nameCol = cols.find((c) => /name/i.test(c));
  const pct = totalPeople ? Math.round((rows.length / totalPeople) * 100) : 0;

  const exportCsv = () => {
    const c = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const lines = [['Date', 'Time', ...cols, 'Source', 'IP'].map(c).join(',')].concat(
      rows.map((x) => [x.marked_date, new Date(x.marked_at).toLocaleTimeString(), ...cols.map((k) => val(k, x.data[k])), x.manual ? 'Manual' : 'List', x.ip_address].map(c).join(','))
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
    a.download = `attendance-${date || 'all'}.csv`;
    a.click();
  };

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
            <h1 className="title">Admin <span>Login</span></h1>
            <p className="sub">Sign in to view attendance records</p>
            <label className="field">Username
              <input autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} />
            </label>
            <label className="field">Password
              <input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
            </label>
            <div className="err">{err}</div>
            <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <nav className="nav"><Link href="/">← Back to marking</Link></nav>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="hero small" />
      <main className="shell wide flat">
        <div className="top">
          <h1 className="title" style={{ margin: 0 }}>Attendance <span>Dashboard</span></h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setShowImport(true)}>⬆ Import list</button>
            <Link href="/"><button className="btn ghost">Marking page</button></Link>
            <button className="btn ghost" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="stats">
          <div className="glass stat"><div className="lbl">Present{date ? '' : ' (all)'}</div><div className="num ok">{rows.length}</div></div>
          <div className="glass stat" style={{ animationDelay: '60ms' }}><div className="lbl">Total people</div><div className="num">{totalPeople}</div></div>
          <div className="glass stat" style={{ animationDelay: '90ms' }}><div className="lbl">Added manually</div><div className="num" style={{ color: '#fbbf24' }}>{rows.filter((x) => x.manual).length}</div></div>
          <div className="glass stat" style={{ animationDelay: '120ms' }}><div className="lbl">Attendance rate</div><div className="num g">{date ? pct + '%' : '—'}</div></div>
        </div>

        <section className="glass panel" style={{ animationDelay: '.2s' }}>
          <div className="bar">
            <div><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grow"><label>Search</label><input placeholder="Search any field…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn ghost" onClick={() => setDate('')}>All dates</button>
            <button className="btn" onClick={exportCsv} disabled={!rows.length}>⬇ Export CSV</button>
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Time</th>{cols.map((c) => <th key={c}>{c}</th>)}<th>IP</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={x.id} className={x.manual ? 'manual-row' : ''}>
                    <td className="muted">{i + 1}</td>
                    <td>{x.marked_date}</td>
                    <td className="time">{new Date(x.marked_at).toLocaleTimeString()}</td>
                    {cols.map((c) => (
                      <td key={c}>
                        {c === nameCol
                          ? <div className="cellname">{nice(x.data[c])}{x.manual && <span className="manual" title="Added manually (not in the imported list)">＋ Manual</span>}</div>
                          : val(c, x.data[c])}
                      </td>
                    ))}
                    <td className="muted">{x.ip_address}</td>
                    <td><button className="btn sm danger" onClick={() => remove(x.id)}>Remove</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={cols.length + 5} className="empty">No attendance recorded{date ? ' for this date' : ''} yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showImport && (
        <div className="modal" onClick={closeImport}>
          <div className="glass box import" onClick={(e) => e.stopPropagation()}>
            <h2>Import list</h2>
            <p className="who">Upload a CSV or Excel file. The first row must be column headers; the column containing “name” is used as the person’s name.</p>

            <label className="drop">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }} />
              <span className="dropicon">📄</span>
              <b>{file ? file.name : 'Choose a .csv or .xlsx file'}</b>
              <small>{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Max 5 MB'}</small>
            </label>

            <div className="modes">
              <label className={mode === 'append' ? 'on' : ''}>
                <input type="radio" name="mode" checked={mode === 'append'} onChange={() => setMode('append')} />
                <b>Add to list</b><small>Keep everyone, add new people, skip duplicates</small>
              </label>
              <label className={mode === 'replace' ? 'on' : ''}>
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                <b>Replace list</b><small>Remove people with no attendance, then import</small>
              </label>
              <label className={'danger' + (mode === 'clear' ? ' on' : '')}>
                <input type="radio" name="mode" checked={mode === 'clear'} onChange={() => setMode('clear')} />
                <b>Clear existing list &amp; add</b><small>Delete everyone and all attendance records, then import</small>
              </label>
            </div>

            <a className="sample" href="/sample-list.csv" download>⬇ Download sample CSV</a>

            {result?.error && <div className="err">{result.error}</div>}
            {result?.ok && (
              <div className="okmsg">
                ✓ Imported <b>{result.added}</b> new{result.skipped ? `, ${result.skipped} skipped` : ''}{result.removed ? `, ${result.removed} removed` : ''}. List now has <b>{result.total}</b> people.
                <small>Name column: {result.nameColumn}</small>
              </div>
            )}

            <div className="actions">
              <button className="btn ghost" onClick={closeImport} disabled={importing}>{result?.ok ? 'Close' : 'Cancel'}</button>
              <button className="btn" onClick={runImport} disabled={importing || !file}>{importing ? 'Importing…' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
