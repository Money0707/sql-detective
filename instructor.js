import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=9';
import { MISSIONS } from './missions.js?v=9';

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
  }
});

$('signout-btn').addEventListener('click', () => showLogin());
$('refresh-btn').addEventListener('click', loadSubmissions);

async function loadSubmissions() {
  $('dash-error').hidden = true;
  try {
    const data = await api({ action: 'list' });
    render(data.submissions || []);
    return true;
  } catch (e) {
    if (e.message !== 'denied') {
      if ($('dash').hidden) showLogin('Could not connect. Please try again.');
      else { $('dash-error').hidden = false; $('dash-error').textContent = e.message; }
    }
    return false;
  }
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
        await api({ action: 'delete', participant_id: r.participant_id });
        loadSubmissions();
      } catch (e) {
        if (e.message !== 'denied') alert('Delete failed: ' + e.message);
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
    h.textContent = `${a.correct ? '✓ Correct' : '✗ Not correct'} · ${m.kind === 'challenge' ? 'Challenge' : 'Step'} ${m.label}: ${m.title}`;
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

if (code) {
  loadSubmissions().then((ok) => {
    if (ok) { $('login').hidden = true; $('dash').hidden = false; $('signout-btn').hidden = false; }
  });
} else showLogin();
