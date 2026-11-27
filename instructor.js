import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=11';
import { MISSIONS } from './missions.js?v=11';

const $ = (id) => document.getElementById(id);
const CODE_KEY = 'sqld-instructor-code';

// The access code is kept only in this browser tab (cleared when it closes).
let code = null;
try { code = sessionStorage.getItem(CODE_KEY); } catch { /* ignore */ }

function setCode(c) {
  code = c;
  try { c ? sessionStorage.setItem(CODE_KEY, c) : sessionStorage.removeItem(CODE_KEY); } catch { /* ignore */ }
}

function showLogin(msg) {
  stopAuto();
  setCode(null);
  $('dash').hidden = true;
  $('signout-btn').hidden = true;
  $('login').hidden = false;
  const err = $('login-error');
  err.hidden = !msg;
  err.textContent = msg || '';
}

// All instructor requests go through the `results` function, which checks the code.
async function api(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ code, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { showLogin('Incorrect access code.'); throw new Error('denied'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  setCode($('code').value.trim());
  $('code').value = '';
  const ok = await loadSubmissions();
  if (ok) {
    $('login').hidden = true;
    $('dash').hidden = false;
    $('signout-btn').hidden = false;
    startAuto();
  }
});

$('signout-btn').addEventListener('click', () => showLogin());
$('refresh-btn').addEventListener('click', loadSubmissions);

// The dashboard refreshes itself every few seconds while it is open.
const AUTO_MS = 5000;
let autoTimer = null;
let loading = false;
function startAuto() {
  stopAuto();
  autoTimer = setInterval(() => {
    if (!document.hidden && !$('dash').hidden && !loading) loadSubmissions();
  }, AUTO_MS);
}
function stopAuto() { if (autoTimer) clearInterval(autoTimer); autoTimer = null; }

async function loadSubmissions() {
  loading = true;
  try {
    const data = await api({ action: 'list' });
    $('dash-error').hidden = true;
    render(data.submissions || []);
    $('updated').textContent = `Updates automatically · last updated ${new Date().toLocaleTimeString()}`;
    return true;
  } catch (e) {
    if (e.message !== 'denied') {
      if ($('dash').hidden) showLogin('Could not connect. Please try again.');
      else { $('dash-error').hidden = false; $('dash-error').textContent = e.message; }
    }
    return false;
  } finally {
    loading = false;
  }
}

function fmtClock(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
}
const qName = (m) => (m.kind === 'challenge' ? m.label : `Q${m.label}`);

function renderHead() {
  const tr = $('head-row');
  tr.innerHTML = '';
  const cells = ['Participant', 'Score'];
  for (const m of MISSIONS) cells.push(qName(m), 'Time');
  cells.push('');
  for (const c of cells) {
    const th = document.createElement('th');
    th.textContent = c;
    tr.appendChild(th);
  }
  [...tr.children].forEach((th, i) => {
    if (i >= 2 && i < 2 + MISSIONS.length * 2) {
      const m = MISSIONS[Math.floor((i - 2) / 2)];
      th.className = (i - 2) % 2 === 0 ? 'q-col' : 't-col';
      th.title = `${m.kind === 'challenge' ? 'Challenge' : 'Step'} ${m.label}: ${m.title}`;
    }
  });
}

function render(rows) {
  renderHead();
  const tbody = $('rows');
  tbody.innerHTML = '';
  $('empty').hidden = rows.length > 0;

  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;
  $('summary').textContent = rows.length
    ? `${rows.length} participant${rows.length === 1 ? '' : 's'} · average score ${avg.toFixed(1)} / ${MISSIONS.length} · ✓ correct, ✗ wrong, – not tried · hover a mark to see the SQL`
    : '';

  // Same name used by more than one participant → show a short id to tell them apart.
  const nameCount = {};
  rows.forEach((r) => { const k = r.participant_name.toLowerCase(); nameCount[k] = (nameCount[k] || 0) + 1; });

  for (const r of rows) {
    const tr = tbody.insertRow();
    const nameCell = tr.insertCell();
    nameCell.className = 'name-col';
    nameCell.textContent = r.participant_name;
    if (nameCount[r.participant_name.toLowerCase()] > 1) {
      const tag = document.createElement('span');
      tag.className = 'dup-tag';
      tag.textContent = `#${r.participant_id.slice(0, 4)}`;
      tag.title = 'Another participant used the same name. This short id tells them apart.';
      nameCell.append(' ', tag);
    }
    const joined = document.createElement('span');
    joined.className = 'joined';
    joined.textContent = `joined ${fmtClock(r.first_submitted_at)}`;
    nameCell.append(joined);
    tr.insertCell().innerHTML = `<strong>${r.score}</strong> / ${r.total}`;

    for (const m of MISSIONS) {
      const a = (r.answers && r.answers[m.id]) || {};
      const tried = !!(a.sql && a.sql.trim());
      const q = tr.insertCell();
      q.className = 'q-col ' + (!tried ? 'q-none' : a.correct ? 'q-ok' : 'q-bad');
      q.textContent = !tried ? '–' : a.correct ? '✓' : '✗';
      if (tried) q.title = a.sql;
      const t = tr.insertCell();
      t.className = 't-col';
      t.textContent = tried ? fmtClock(a.at) || '—' : '';
    }

    const act = tr.insertCell();
    act.className = 'row-actions';
    const del = document.createElement('button');
    del.className = 'btn link danger';
    del.textContent = 'Delete';
    act.append(del);
    del.addEventListener('click', async () => {
      if (!confirm(`Delete the submission from "${r.participant_name}"? This cannot be undone.`)) return;
      try {
        await api({ action: 'delete', participant_id: r.participant_id });
        loadSubmissions();
      } catch (e) {
        if (e.message !== 'denied') alert('Delete failed: ' + e.message);
      }
    });
  }
}

if (code) {
  loadSubmissions().then((ok) => {
    if (ok) { $('login').hidden = true; $('dash').hidden = false; $('signout-btn').hidden = false; startAuto(); }
  });
} else showLogin();
