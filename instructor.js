import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { MISSIONS } from './missions.js';

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'sqld-instructor-token';

let token = null;
try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }

function setToken(t) {
  token = t;
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

function showLogin(msg) {
  setToken(null);
  $('dash').hidden = true;
  $('signout-btn').hidden = true;
  $('login').hidden = false;
  const err = $('login-error');
  err.hidden = !msg;
  err.textContent = msg || '';
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!res || !res.ok || !data.access_token) {
    showLogin('Sign-in failed. Check your email and password.');
    return;
  }
  $('password').value = '';
  setToken(data.access_token);
  openDashboard();
});

$('signout-btn').addEventListener('click', () => showLogin());
$('refresh-btn').addEventListener('click', loadSubmissions);

async function api(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { showLogin('Your session has expired. Please sign in again.'); throw new Error('expired'); }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

async function openDashboard() {
  $('login').hidden = true;
  $('dash').hidden = false;
  $('signout-btn').hidden = false;
  // Confirm this account is an instructor (RLS only shows your own row).
  try {
    const me = await api('instructors?select=user_id');
    if (!me.length) {
      showLogin('This account is not registered as an instructor.');
      return;
    }
  } catch { return; }
  loadSubmissions();
}

async function loadSubmissions() {
  $('dash-error').hidden = true;
  let rows;
  try {
    rows = await api('submissions?select=*&order=participant_name.asc');
  } catch (e) {
    if (e.message !== 'expired') { $('dash-error').hidden = false; $('dash-error').textContent = e.message; }
    return;
  }
  render(rows);
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function render(rows) {
  const tbody = $('rows');
  tbody.innerHTML = '';
  $('empty').hidden = rows.length > 0;

  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;
  $('summary').textContent = rows.length
    ? `${rows.length} participant${rows.length === 1 ? '' : 's'} · average score ${avg.toFixed(1)} / ${MISSIONS.length}`
    : '';

  // Same name used by more than one participant → show a short id to tell them apart.
  const nameCount = {};
  rows.forEach((r) => { const k = r.participant_name.toLowerCase(); nameCount[k] = (nameCount[k] || 0) + 1; });

  for (const r of rows) {
    const tr = tbody.insertRow();
    const nameCell = tr.insertCell();
    nameCell.textContent = r.participant_name;
    if (nameCount[r.participant_name.toLowerCase()] > 1) {
      const tag = document.createElement('span');
      tag.className = 'dup-tag';
      tag.textContent = `#${r.participant_id.slice(0, 4)}`;
      tag.title = 'Another participant used the same name. This short id tells them apart.';
      nameCell.append(' ', tag);
    }
    const scoreCell = tr.insertCell();
    scoreCell.innerHTML = `<strong>${r.score}</strong> / ${r.total}`;
    tr.insertCell().textContent = fmtTime(r.submitted_at);
    tr.insertCell().textContent = r.submission_count;
    const act = tr.insertCell();
    act.className = 'row-actions';
    const view = document.createElement('button');
    view.className = 'btn small-btn';
    view.textContent = 'View answers';
    const del = document.createElement('button');
    del.className = 'btn link danger';
    del.textContent = 'Delete';
    act.append(view, del);

    const detail = tbody.insertRow();
    detail.hidden = true;
    detail.className = 'detail-row';
    const cell = detail.insertCell();
    cell.colSpan = 5;
    cell.appendChild(renderAnswers(r));

    view.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      view.textContent = detail.hidden ? 'View answers' : 'Hide answers';
    });
    del.addEventListener('click', async () => {
      if (!confirm(`Delete the submission from "${r.participant_name}"? This cannot be undone.`)) return;
      try {
        await api(`submissions?participant_id=eq.${r.participant_id}`, { method: 'DELETE' });
        loadSubmissions();
      } catch (e) {
        if (e.message !== 'expired') alert('Delete failed: ' + e.message);
      }
    });
  }
}

function renderAnswers(r) {
  const wrap = document.createElement('div');
  wrap.className = 'answers';
  MISSIONS.forEach((m, i) => {
    const a = (r.answers && r.answers[m.id]) || { sql: '', correct: false };
    const box = document.createElement('div');
    box.className = 'answer ' + (a.correct ? 'ok' : 'bad');
    const h = document.createElement('p');
    h.className = 'answer-head';
    h.textContent = `${a.correct ? '✓ Correct' : '✗ Not correct'} · Mission ${i + 1}: ${m.title}`;
    const pre = document.createElement('pre');
    pre.textContent = a.sql && a.sql.trim() ? a.sql : '(no answer)';
    box.append(h, pre);
    wrap.appendChild(box);
  });
  const meta = document.createElement('p');
  meta.className = 'muted small';
  meta.textContent = `First submitted ${fmtTime(r.first_submitted_at)} · participant id ${r.participant_id}`;
  wrap.appendChild(meta);
  return wrap;
}

if (token) openDashboard(); else showLogin();
