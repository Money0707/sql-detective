import { MISSIONS, TABLES, runQuery, checkAnswer, loadAuditRows } from './missions.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STORE_KEY = 'sql-detective-v5'; // bump when the dataset changes
const SHOW_ROWS = 200; // rows drawn in the results table (all rows are still checked)
const $ = (id) => document.getElementById(id);

let SQL = null;
let state = load() || { participant: null, current: 0, missions: {}, lastSubmit: null };

// --- persistence (per-browser convenience; lets a refresh keep progress) ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function missionState(m) {
  if (!state.missions[m.id]) state.missions[m.id] = { query: m.starter, solved: false, solvedQuery: null, hints: 0 };
  return state.missions[m.id];
}
const solvedCount = () => MISSIONS.filter((m) => missionState(m).solved).length;

// --- start screen ---------------------------------------------------------------
// The audit data is read from Supabase (read-only); queries then run on a
// copy inside this browser, so nobody can change the shared data.
async function fetchAuditRows() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/audit_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: '{}',
  });
  if (!res.ok) throw new Error(`data request failed (${res.status})`);
  return res.json();
}

Promise.all([initSqlJs({ locateFile: (f) => `vendor/${f}` }), fetchAuditRows()])
  .then(([s, rows]) => {
    loadAuditRows(rows);
    SQL = s;
    $('loading').hidden = true;
    if (state.participant) enterApp();
  })
  .catch((e) => {
    $('loading').textContent = 'Could not load the SQL engine or the audit data. Please refresh the page. (' + e.message + ')';
  });

$('start-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!SQL) return;
  const name = $('name').value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  // A random id keeps participants with the same name apart.
  state.participant = { id: crypto.randomUUID(), name };
  save();
  enterApp();
});

function enterApp() {
  $('start').hidden = true;
  $('app').hidden = false;
  $('who').hidden = false;
  $('who').textContent = 'Detective ' + state.participant.name;
  renderSchema();
  renderMission();
  renderSubmitCard();
}

// --- mission view ---------------------------------------------------------------
const currentMission = () => MISSIONS[state.current];
const GUIDED = MISSIONS.filter((m) => m.kind === 'guided').length;
const missionLabel = (m) => (m.kind === 'challenge' ? `Challenge ${m.label}` : `Guided step ${m.label} of ${GUIDED}`);

function renderStepper() {
  const nav = $('stepper');
  nav.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'step' + (i === state.current ? ' active' : '') + (missionState(m).solved ? ' solved' : '');
    if (i > 0 && m.kind !== MISSIONS[i - 1].kind) {
      const sep = document.createElement('span');
      sep.className = 'step-sep';
      sep.setAttribute('aria-hidden', 'true');
      nav.appendChild(sep);
    }
    b.textContent = missionState(m).solved ? `✓ ${m.label}` : m.label;
    b.title = `${missionLabel(m)}: ${m.title}` + (missionState(m).solved ? ' (solved)' : '');
    b.setAttribute('aria-current', i === state.current ? 'step' : 'false');
    b.addEventListener('click', () => goTo(i));
    nav.appendChild(b);
  });
}

function goTo(i) {
  persistQuery();
  state.current = i;
  save();
  renderMission();
}

function renderMission() {
  const m = currentMission();
  const ms = missionState(m);
  renderStepper();
  $('mission-num').textContent = missionLabel(m) + (ms.solved ? ' · Solved' : '');
  $('mission-title').textContent = m.title;
  $('mission-concept').textContent = m.concept;
  $('mission-example').textContent = m.example;
  $('mission-example').hidden = !m.example;
  $('example-label').hidden = !m.example;
  $('mission-task').textContent = m.task;
  $('editor').value = ms.query;
  renderHints();
  setFeedback(null);
  clearResults();
}

function renderHints() {
  const m = currentMission();
  const ms = missionState(m);
  const box = $('hints');
  box.innerHTML = '';
  m.hints.slice(0, ms.hints).forEach((h, i) => {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = `Hint ${i + 1}: ${h}`;
    box.appendChild(p);
  });
  const btn = $('hint-btn');
  btn.hidden = ms.hints >= m.hints.length;
  btn.textContent = ms.hints === 0 ? 'Show a hint' : 'Show another hint';
}

function renderSchema() {
  const box = $('schema');
  box.innerHTML = '';
  for (const t of TABLES) {
    const name = document.createElement('code');
    name.className = 'table-name';
    name.textContent = t.name;
    const dl = document.createElement('dl');
    dl.className = 'cols';
    for (const [col, desc] of t.columns) {
      const dt = document.createElement('dt');
      dt.textContent = col;
      const dd = document.createElement('dd');
      dd.textContent = desc;
      dl.append(dt, dd);
    }
    box.append(name, dl);
  }
}

// --- results & feedback ---------------------------------------------------------
function clearResults() {
  $('results').innerHTML = '<p class="muted small">Run a query to see results here.</p>';
  $('row-count').textContent = '';
}

function renderResults(result) {
  $('results').innerHTML = '';
  const n = result.rows.length;
  $('row-count').textContent = `${n.toLocaleString()} row${n === 1 ? '' : 's'}` + (n > SHOW_ROWS ? ` · showing the first ${SHOW_ROWS}` : '');
  if (result.rows.length === 0) {
    $('results').innerHTML = '<p class="muted small">The query ran successfully but returned no rows.</p>';
    return;
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const c of result.columns) {
    const th = document.createElement('th');
    th.textContent = c;
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const row of result.rows.slice(0, SHOW_ROWS)) {
    const tr = body.insertRow();
    for (const v of row) {
      const td = tr.insertCell();
      if (v === null) { td.textContent = 'NULL'; td.className = 'null'; }
      else td.textContent = v;
    }
  }
  $('results').appendChild(table);
}

function setFeedback(kind, text, showNext = false) {
  const fb = $('feedback');
  if (!kind) { fb.hidden = true; return; }
  fb.hidden = false;
  fb.className = 'feedback ' + kind;
  $('feedback-text').textContent = text;
  $('next-btn').hidden = !showNext;
}

// --- actions --------------------------------------------------------------------
function persistQuery() {
  if (!state.participant) return;
  missionState(currentMission()).query = $('editor').value;
  save();
}

function run() {
  persistQuery();
  const out = runQuery(SQL, $('editor').value);
  if (out.error) { clearResults(); setFeedback('error', out.error); return; }
  setFeedback(null);
  renderResults(out.result);
}

function check() {
  persistQuery();
  const m = currentMission();
  const ms = missionState(m);
  const out = checkAnswer(SQL, m, $('editor').value);
  if (out.error) { clearResults(); setFeedback('error', out.error); return; }
  renderResults(out.result);
  if (out.correct) {
    ms.solved = true;
    ms.solvedQuery = $('editor').value;
  }
  save();
  const last = state.current === MISSIONS.length - 1;
  let msg = out.message;
  if (out.correct && solvedCount() === MISSIONS.length) msg += ` All ${MISSIONS.length} missions are solved. You can now submit your final answers.`;
  setFeedback(out.correct ? 'success' : 'warn', msg, out.correct && !last);
  $('mission-num').textContent = missionLabel(m) + (ms.solved ? ' · Solved' : '');
  renderStepper();
  renderSubmitCard();
}

// --- submission ---------------------------------------------------------------------
function renderSubmitCard() {
  const n = solvedCount();
  $('progress').textContent = `${n} of ${MISSIONS.length} missions solved`;
  const ls = state.lastSubmit;
  const st = $('submit-status');
  if (ls) {
    st.hidden = false;
    st.className = 'small submit-ok';
    st.textContent = `Submitted at ${new Date(ls.submitted_at).toLocaleTimeString()}. Your score is ${ls.score} / ${ls.total}. You can submit again, and only your latest submission counts.`;
    $('submit-btn').textContent = 'Submit again';
  }
}

async function submit() {
  persistQuery();
  const n = solvedCount();
  const ask = n < MISSIONS.length
    ? `You have solved ${n} of ${MISSIONS.length} missions.\n\nYou can still submit. Your score will be the number of missions answered correctly. Unfinished missions are sent as they are now.`
    : 'Submit your final answers to the instructor?';
  if (!confirm(ask)) return;

  // Send the query that solved each mission; otherwise the current editor text.
  const answers = {};
  for (const m of MISSIONS) {
    const ms = missionState(m);
    answers[m.id] = ms.solvedQuery || ms.query || '';
  }

  const btn = $('submit-btn');
  const st = $('submit-status');
  btn.disabled = true;
  st.hidden = false;
  st.className = 'small muted';
  st.textContent = 'Submitting…';
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ participant_id: state.participant.id, name: state.participant.name, answers }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
    state.lastSubmit = { score: data.score, total: data.total, submitted_at: data.submitted_at || new Date().toISOString() };
    save();
    renderSubmitCard();
  } catch (e) {
    st.className = 'small submit-err';
    st.textContent = `Submission failed: ${e.message}. Check your connection and try again.`;
  } finally {
    btn.disabled = false;
  }
}

// --- wiring -------------------------------------------------------------------------
$('run-btn').addEventListener('click', run);
$('check-btn').addEventListener('click', check);
$('submit-btn').addEventListener('click', submit);
$('next-btn').addEventListener('click', () => goTo(Math.min(state.current + 1, MISSIONS.length - 1)));
$('reset-btn').addEventListener('click', () => {
  $('editor').value = currentMission().starter;
  persistQuery();
  setFeedback(null);
  clearResults();
});
$('hint-btn').addEventListener('click', () => {
  missionState(currentMission()).hints++;
  save();
  renderHints();
});

const editor = $('editor');
editor.addEventListener('input', persistQuery);
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: en, value } = editor;
    editor.value = value.slice(0, s) + '  ' + value.slice(en);
    editor.selectionStart = editor.selectionEnd = s + 2;
  }
});
