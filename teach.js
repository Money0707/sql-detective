// Teach mode: the instructor presents the five guided steps full-screen.
// Each step has two screens: a short explanation, then the mission question
// with a blank editor that the instructor types into live and runs on the
// real 10,000 audit rows (read-only copy inside this browser).
import { MISSIONS, runQuery, checkAnswer, loadAuditRows } from './missions.js?v=7';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=7';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHOW_ROWS = 9; // rows that fit on the stage under the editor

// Light syntax colouring for the explanation code (keywords yellow, text green).
const KEYWORDS = /\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY|COUNT|AS|DESC|ASC|AND)\b/g;
const paint = (line) => esc(line)
  .replace(/(&#39;[^&]*&#39;)/g, '<span class="s">$1</span>')
  .replace(KEYWORDS, '<span class="k">$1</span>');

// What each step teaches. The examples are different from the mission answers.
const LESSONS = {
  m1: {
    keyword: 'SELECT · FROM',
    lines: [
      ['SELECT market, channel', 'which columns to show'],
      ['FROM audits;', 'which table they come from'],
    ],
    rules: [
      ['Commas', 'Put a comma between column names, but not after the last one.'],
      ['Star', 'SELECT * shows every column.'],
      ['Semicolon', 'End the query with ; like a full stop.'],
    ],
  },
  m2: {
    keyword: 'WHERE',
    lines: [
      ['SELECT agent_name, channel', 'which columns'],
      ['FROM audits', 'which table'],
      ["WHERE market = 'MY';", 'keep only the rows that match'],
    ],
    rules: [
      ['Quotes', "Text goes in single quotes: 'MY'. Numbers don’t: qa_score >= 80"],
      ['Exact match', "'MY' and 'my' are different. Copy the value exactly."],
      ['Order', 'WHERE comes after FROM.'],
    ],
  },
  m3: {
    keyword: 'ORDER BY',
    lines: [
      ['SELECT agent_name, qa_score', 'which columns'],
      ['FROM audits', 'which table'],
      ["WHERE market = 'MY'", 'which rows'],
      ['ORDER BY qa_score ASC;', 'sort the result'],
    ],
    rules: [
      ['DESC', 'Highest to lowest (Z to A).'],
      ['ASC', 'Lowest to highest (A to Z). This is the default.'],
      ['Order', 'ORDER BY comes last, after WHERE.'],
    ],
  },
  m4: {
    keyword: 'COUNT',
    lines: [
      ['SELECT COUNT(*) AS my_audits', 'count the rows, name the answer'],
      ['FROM audits', 'which table'],
      ["WHERE market = 'MY';", 'which rows to count'],
    ],
    rules: [
      ['COUNT(*)', 'Counts rows. The answer is one number.'],
      ['AS', 'Gives the answer column a readable name.'],
      ['No spaces', 'Names use underscores: my_audits, not my audits.'],
    ],
  },
  m5: {
    keyword: 'GROUP BY',
    lines: [
      ['SELECT channel, COUNT(*) AS audits', 'one row per channel, with its count'],
      ['FROM audits', 'which table'],
      ['GROUP BY channel;', 'make one group for each channel'],
    ],
    ladder: ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY'],
  },
};

// Screen list: for each guided mission, an explanation then the live mission.
const GUIDED = MISSIONS.filter((m) => m.kind === 'guided');
const SCREENS = [
  ...GUIDED.flatMap((m) => [{ type: 'explain', m }, { type: 'mission', m }]),
  { type: 'end' },
];

let SQL = null;
let index = 0;
const typed = {}; // keep what was typed per mission while moving back and forth

// --- start-up ----------------------------------------------------------------
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
    $('view').hidden = false;
    const fromHash = Number((location.hash.match(/step=(\d)/) || [])[1]);
    if (fromHash >= 1 && fromHash <= GUIDED.length) index = (fromHash - 1) * 2;
    render();
  })
  .catch((e) => {
    $('loading').textContent = 'Could not load the SQL engine or the audit data. Please refresh. (' + e.message + ')';
  });

// --- scaling: keep the 1920×1080 stage fitted to the window --------------------
function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

// --- rendering ---------------------------------------------------------------
function header(m, eyebrow, title, cls = '') {
  return `<div class="head"><div class="badge">${esc(m.label)}</div><div>
    <p class="eyebrow">${esc(eyebrow)}</p><h2 class="${cls}">${esc(title)}</h2></div></div>`;
}

function renderExplain(m) {
  const l = LESSONS[m.id];
  const n = l.lines.length;
  const rows = l.lines.map(([code, note], i) => {
    const pos = n === 1 ? 'only' : i === 0 ? 'first' : i === n - 1 ? 'last' : '';
    return `<pre class="code ${pos}">${paint(code)}</pre><p class="note"><span class="arr">←</span> ${esc(note)}</p>`;
  }).join('');
  const bottom = l.ladder
    ? `<div class="ladder">${l.ladder.map((k) => `<p class="rung${k === 'GROUP BY' ? ' hot' : ''}">${k}</p>`).join('<span class="arrow">→</span>')}</div>`
    : `<div class="rules">${l.rules.map(([tag, text], i) => `<div class="sticky ${['yellow', 'mint', 'peach'][i]}"><p class="tag">${esc(tag)}</p><p class="text">${paint(text).replace(/<span class="k">/g, '<span>')}</p></div>`).join('')}</div>`;
  return `${header(m, `Step ${m.label} of ${GUIDED.length}`, l.keyword)}
    <div class="anatomy"><p class="label">Example</p>${rows}</div>
    ${bottom}
    <p class="hint-next">Next → the mission</p>`;
}

function renderMission(m) {
  return `${header(m, `Mission ${m.label} · type along`, m.task, 'task')}
    <div class="editor-row">
      <textarea id="editor" class="editor" spellcheck="false" autocomplete="off" autocapitalize="off"
        placeholder="Type the SQL here…" aria-label="SQL editor"></textarea>
      <div class="buttons">
        <button id="run" class="btn primary" type="button" title="Ctrl + Enter">Run query</button>
        <button id="clear" class="btn" type="button">Clear</button>
      </div>
    </div>
    <p id="feedback" class="feedback" hidden></p>
    <div id="results" class="results"></div>`;
}

function render() {
  const sc = SCREENS[index];
  const view = $('view');
  view.className = 'view' + (sc.type === 'end' ? ' end' : '');
  if (sc.type === 'explain') view.innerHTML = renderExplain(sc.m);
  else if (sc.type === 'mission') {
    view.innerHTML = renderMission(sc.m);
    const ed = $('editor');
    ed.value = typed[sc.m.id] || '';
    ed.addEventListener('input', () => { typed[sc.m.id] = ed.value; });
    ed.addEventListener('keydown', editorKeys);
    $('run').addEventListener('click', run);
    $('clear').addEventListener('click', () => { ed.value = ''; typed[sc.m.id] = ''; $('feedback').hidden = true; $('results').innerHTML = ''; ed.focus(); });
    ed.focus();
  } else {
    view.innerHTML = `<p class="stamp">Five steps done</p>
      <h2>Now it’s your turn.</h2>
      <p class="lead">Open the class website and try Challenges A and B on your own.</p>`;
  }
  $('where').textContent = sc.type === 'end' ? 'End' : `Step ${sc.m.label} · ${sc.type === 'explain' ? 'explain' : 'mission'}`;
  $('prev').disabled = index === 0;
  $('next').disabled = index === SCREENS.length - 1;
  history.replaceState(null, '', sc.m ? `#step=${sc.m.label}` : '#end');
}

function go(delta) {
  const i = index + delta;
  if (i < 0 || i >= SCREENS.length) return;
  index = i;
  render();
}

// --- running a query -----------------------------------------------------------
function run() {
  const m = SCREENS[index].m;
  const sql = $('editor').value;
  const fb = $('feedback');
  const box = $('results');
  if (!sql.trim()) { fb.hidden = true; box.innerHTML = ''; return; }
  const out = checkAnswer(SQL, m, sql);
  fb.hidden = false;
  if (out.error) {
    fb.className = 'feedback err';
    fb.textContent = out.error;
    box.innerHTML = '';
    return;
  }
  fb.className = 'feedback ' + (out.correct ? 'ok' : 'warn');
  fb.textContent = out.correct ? '✓ Correct. This is the expected result.' : out.message;
  showRows(out.result);
}

function showRows(result) {
  const n = result.rows.length;
  const more = n > SHOW_ROWS ? ` · showing the first ${SHOW_ROWS}` : '';
  if (n === 0) { $('results').innerHTML = '<p class="count">0 rows</p>'; return; }
  const head = result.columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = result.rows.slice(0, SHOW_ROWS)
    .map((r) => `<tr>${r.map((v) => `<td>${v === null ? 'NULL' : esc(v)}</td>`).join('')}</tr>`).join('');
  $('results').innerHTML = `<p class="count">${n.toLocaleString()} row${n === 1 ? '' : 's'}${more}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function editorKeys(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
  if (e.key === 'Escape') e.target.blur();
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const ed = e.target;
    const { selectionStart: s, selectionEnd: en, value } = ed;
    ed.value = value.slice(0, s) + '  ' + value.slice(en);
    ed.selectionStart = ed.selectionEnd = s + 2;
    typed[SCREENS[index].m.id] = ed.value;
  }
}

// --- navigation ------------------------------------------------------------------
$('prev').addEventListener('click', () => go(-1));
$('next').addEventListener('click', () => go(1));
document.addEventListener('keydown', (e) => {
  if (!SQL || e.target.tagName === 'TEXTAREA') return; // typing keys belong to the editor
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
});
