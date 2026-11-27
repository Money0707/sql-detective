import { MISSIONS, TABLES, checkAnswer, loadAuditRows } from './missions.js?v=11';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=11';

const STORE_KEY = 'sql-detective-v7'; // bump when missions change (clears saved queries)
const SHOW_ROWS = 200; // rows drawn in the results table (all rows are still checked)
const $ = (id) => document.getElementById(id);

let SQL = null;
let state = load() || { participant: null, current: 0, missions: {} };

// --- persistence (per-browser convenience; lets a refresh keep progress) ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function missionState(m) {
  if (!state.missions[m.id]) state.missions[m.id] = { query: m.starter, submitted: false, submittedQuery: '', solved: false };
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
  sendToInstructor('', true); // the instructor sees the name as soon as they join
});

function enterApp() {
  $('start').hidden = true;
  $('app').hidden = false;
  $('who').hidden = false;
  $('who').textContent = 'Detective ' + state.participant.name;
  $('restart-btn').hidden = false;
  renderSchema();
  renderMission();
  renderProgress();
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
  $('save-status').hidden = true;
  $('mission-title').textContent = m.title;
  $('mission-concept').textContent = m.concept;
  $('mission-task').textContent = m.task;
  $('editor').value = ms.query;
  setFeedback(null);
  clearResults();
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

// Run query = submit the answer for the current mission. Only the latest submission of
// each mission counts; the server re-grades every mission and stores the
// result for the instructor.
function submitAnswer() {
  persistQuery();
  const m = currentMission();
  const ms = missionState(m);
  const sql = $('editor').value;
  if (!sql.trim()) { setFeedback('wrong', 'Wrong. The editor is empty. Type your SQL first.'); return; }
  const out = checkAnswer(SQL, m, sql);
  ms.submitted = true;
  ms.submittedQuery = sql;
  ms.solved = !!out.correct;
  save();
  if (out.error) {
    clearResults();
    setFeedback('wrong', `Wrong. Your query has an error: ${out.error}`);
  } else {
    renderResults(out.result);
    if (out.correct) {
      let msg = `Congratulations, ${state.participant.name}! Your query found exactly the right evidence.`;
      if (solvedCount() === MISSIONS.length) msg += ` All ${MISSIONS.length} missions are solved.`;
      setFeedback('success', msg, state.current < MISSIONS.length - 1);
    } else {
      setFeedback('wrong', `Wrong. ${out.message}`);
    }
  }
  $('mission-num').textContent = missionLabel(m) + (ms.solved ? ' · Solved' : '');
  renderStepper();
  renderProgress();
  sendToInstructor(m.id);
}

function renderProgress() {
  const n = solvedCount();
  $('progress').textContent = `Progress ${n} / ${MISSIONS.length}`;
  $('progress-fill').style.width = `${(n / MISSIONS.length) * 100}%`;
}

// Sends the latest submitted query of every mission (empty if not submitted).
let saving = Promise.resolve();
function sendToInstructor(missionId, quiet = false) {
  const answers = {};
  for (const m of MISSIONS) answers[m.id] = missionState(m).submittedQuery || '';
  const st = $('save-status');
  if (!quiet) {
    st.hidden = false;
    st.className = 'small save-status muted';
    st.textContent = 'Saving your answer…';
  }
  // One request at a time, so the newest answers always arrive last.
  saving = saving.then(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ participant_id: state.participant.id, name: state.participant.name, mission: missionId, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
      if (quiet) return;
      st.className = 'small save-status submit-ok';
      st.textContent = `Answer saved for the instructor at ${new Date().toLocaleTimeString()}.`;
    } catch (e) {
      st.hidden = false;
      st.className = 'small save-status submit-err';
      st.textContent = quiet
        ? `Could not reach the instructor's page (${e.message}). Check your connection; your answers will still be saved when you click Run query.`
        : `Your answer could not be saved (${e.message}). Check your connection and click Run query again.`;
    }
  });
}

// --- wiring -------------------------------------------------------------------------
$('run-btn').addEventListener('click', submitAnswer);
$('next-btn').addEventListener('click', () => goTo(Math.min(state.current + 1, MISSIONS.length - 1)));
$('reset-btn').addEventListener('click', () => {
  $('editor').value = currentMission().starter;
  persistQuery();
  setFeedback(null);
  clearResults();
});

// Start over: clear every answer (same name and dashboard row), then save
// the empty answers so the instructor's row goes back to 0.
$('restart-btn').addEventListener('click', () => {
  if (!confirm('Start over?\n\nAll your answers will be cleared and your score goes back to 0.')) return;
  state.missions = {};
  state.current = 0;
  save();
  renderMission();
  renderProgress();
  sendToInstructor('');
  $('save-status').textContent = 'Starting over…';
});

const editor = $('editor');
editor.addEventListener('input', persistQuery);
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitAnswer(); }
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: en, value } = editor;
    editor.value = value.slice(0, s) + '  ' + value.slice(en);
    editor.selectionStart = editor.selectionEnd = s + 2;
  }
});
