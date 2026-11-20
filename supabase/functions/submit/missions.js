// SQL Detective — dataset, missions and grader.
// No DOM code here: the same file is used by the browser AND by the
// Supabase Edge Function that re-grades submissions server-side.

// ---------------------------------------------------------------------------
// Fictional Customer Service QA audit dataset (10,000 rows)
// ---------------------------------------------------------------------------
// The rows live in Supabase (table public.audits) and are read through the
// read-only function public.audit_rows(). The browser and the grading
// function both load them with loadAuditRows(), so everyone grades against
// exactly the same data. All names and records are fictional.
export const SCHEMA_SQL = `
CREATE TABLE audits (
  audit_id   INTEGER PRIMARY KEY,
  audit_date TEXT    NOT NULL,  -- YYYY-MM-DD
  market     TEXT    NOT NULL,  -- MY | ID | TH | VN | KH | PH
  channel    TEXT    NOT NULL,  -- Phone | Chat | Email
  agent_name TEXT    NOT NULL,
  qa_score   INTEGER NOT NULL,  -- 0 to 100
  result     TEXT    NOT NULL   -- 'Pass' (score 80+) or 'Fail'
);`;

let AUDIT_ROWS = null;
const templates = new WeakMap(); // SQL engine -> database file bytes
const expectedCache = new Map(); // mission id -> reference result

// rows: array of [audit_id, audit_date, market, channel, agent_name, qa_score, result]
export function loadAuditRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No audit data received.');
  AUDIT_ROWS = rows;
  expectedCache.clear();
}
export const auditRowCount = () => (AUDIT_ROWS ? AUDIT_ROWS.length : 0);

// Shown in the "Evidence table" panel.
export const TABLES = [
  {
    name: 'audits',
    columns: [
      ['audit_id', 'number, e.g. 200001'],
      ['audit_date', "text, '2026-01-01' to '2026-10-31'"],
      ['market', "'MY', 'ID', 'TH', 'VN', 'KH', 'PH'"],
      ['channel', "'Phone', 'Chat', 'Email'"],
      ['agent_name', "text, e.g. 'Liza Villanueva'"],
      ['qa_score', 'number from 0 to 100'],
      ['result', "'Pass' (80 or higher) or 'Fail'"],
    ],
  },
];

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------
// `solution` is the reference query. An answer is correct when its RESULT
// matches the solution's result (values, not keywords).
// `orderMatters`: when false, row order is ignored.
export const MISSIONS = [
  {
    id: 'm1',
    label: '1',
    kind: 'guided',
    title: 'First Look at the Evidence',
    concept: 'SELECT chooses which columns you want to see, and FROM names the table they come from. Use * to see every column.',
    example: 'SELECT market, channel\nFROM audits;',
    task: 'Show the agent_name, market and qa_score of every audit.',
    starter: '',
    hints: [
      'Replace * with the three column names, separated by commas.',
      'Column names must match the table exactly: agent_name, market, qa_score.',
      'Pattern: SELECT column1, column2, column3 FROM audits;',
    ],
    solution: 'SELECT agent_name, market, qa_score FROM audits;',
    orderMatters: false,
  },
  {
    id: 'm2',
    label: '2',
    kind: 'guided',
    title: 'The Failed Audits',
    concept: "WHERE keeps only the rows that match a condition. Put text values in single quotes. Text matching is exact, so 'Fail' and 'fail' are different.",
    example: "SELECT agent_name, channel\nFROM audits\nWHERE channel = 'Chat';",
    task: "Show the audit_id, agent_name, market and qa_score of every audit whose result is 'Fail'.",
    starter: '',
    hints: [
      'Add a WHERE line after FROM audits.',
      "The condition is: result = 'Fail' (capital F, single quotes).",
      "Skeleton: SELECT ___, ___, ___, ___ FROM audits WHERE ___ = '___';",
    ],
    solution: "SELECT audit_id, agent_name, market, qa_score FROM audits WHERE result = 'Fail';",
    orderMatters: false,
  },
  {
    id: 'm3',
    label: '3',
    kind: 'guided',
    title: 'Ranking the PH Team',
    concept: 'ORDER BY sorts the results. ASC (the default) puts the lowest value first and DESC puts the highest first. ORDER BY goes after WHERE.',
    example: "SELECT agent_name, audit_date\nFROM audits\nWHERE channel = 'Email'\nORDER BY audit_date DESC;",
    task: "Show the agent_name and qa_score of every audit in the 'PH' market, sorted from the highest qa_score to the lowest.",
    starter: '',
    hints: [
      "First filter: WHERE market = 'PH'.",
      'Then sort on the last line: ORDER BY qa_score DESC.',
      "Skeleton: SELECT ___, ___ FROM audits WHERE market = '___' ORDER BY ___ DESC;",
    ],
    solution: "SELECT agent_name, qa_score FROM audits WHERE market = 'PH' ORDER BY qa_score DESC;",
    orderMatters: true,
    orderKey: 'qa_score', // agents with the same score may appear in any order
  },
  {
    id: 'm4',
    label: '4',
    kind: 'guided',
    title: 'How Many Failed?',
    concept: 'COUNT(*) counts rows. With a WHERE clause it counts only the rows that match, and the answer is a single number. AS gives the result column a name.',
    example: "SELECT COUNT(*) AS chat_audits\nFROM audits\nWHERE channel = 'Chat';",
    task: "Count how many audits have the result 'Fail'. Your answer should be one number.",
    starter: '',
    hints: [
      'Replace * with COUNT(*).',
      "Keep only failed audits with WHERE result = 'Fail'.",
      "Skeleton: SELECT COUNT(*) FROM audits WHERE ___ = '___';",
    ],
    solution: "SELECT COUNT(*) AS failed_audits FROM audits WHERE result = 'Fail';",
    orderMatters: false,
  },
  {
    id: 'm5',
    label: '5',
    kind: 'guided',
    title: 'Failures by Market',
    concept: 'GROUP BY puts rows that share a value into groups, and COUNT(*) then counts the rows in each group. The order is SELECT, FROM, WHERE, then GROUP BY.',
    example: 'SELECT channel, COUNT(*) AS audits\nFROM audits\nGROUP BY channel;',
    task: 'For each market, count how many audits failed. Show two columns: the market and its number of failed audits.',
    starter: '',
    hints: [
      'Select two things: market and COUNT(*).',
      "Filter first with WHERE result = 'Fail', then add GROUP BY market.",
      "Skeleton: SELECT ___, COUNT(*) FROM audits WHERE ___ GROUP BY ___;",
    ],
    solution: "SELECT market, COUNT(*) AS failed_audits FROM audits WHERE result = 'Fail' GROUP BY market;",
    orderMatters: false,
  },
  {
    id: 'c1',
    label: 'A',
    kind: 'challenge',
    title: 'Which Channel Fails Most?',
    concept: 'Challenge: no example this time. Combine WHERE, GROUP BY and ORDER BY from the guided steps.',
    example: '',
    task: 'For each channel, show the channel and its number of failed audits, sorted from the most failures to the fewest.',
    starter: '',
    hints: [
      "Only failed audits count, so start with WHERE result = 'Fail'.",
      'You need one row per channel: GROUP BY channel.',
      "Skeleton: SELECT ___, COUNT(*) FROM audits WHERE ___ GROUP BY ___ ORDER BY COUNT(*) DESC;",
    ],
    solution: "SELECT channel, COUNT(*) AS failed_audits FROM audits WHERE result = 'Fail' GROUP BY channel ORDER BY failed_audits DESC;",
    orderMatters: true,
    orderKey: 'failed_audits',
  },
  {
    id: 'c2',
    label: 'B',
    kind: 'challenge',
    title: 'Who on the PH Team Was Audited Most?',
    concept: 'Challenge: no example this time. The same three keywords as Challenge A, used on a different question.',
    example: '',
    task: "For each agent in the 'PH' market, show the agent_name and their number of audits, sorted from the most audits to the fewest.",
    starter: '',
    hints: [
      "Keep only the PH market with WHERE market = 'PH'.",
      'You need one row per agent: GROUP BY agent_name.',
      "Skeleton: SELECT ___, COUNT(*) FROM audits WHERE ___ GROUP BY ___ ORDER BY COUNT(*) DESC;",
    ],
    solution: "SELECT agent_name, COUNT(*) AS audits FROM audits WHERE market = 'PH' GROUP BY agent_name ORDER BY audits DESC;",
    orderMatters: true,
    orderKey: 'audits',
  },
];

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------
const MAX_ROWS = 20000;

// Builds the dataset once per engine and returns it as a database file.
function templateBytes(SQL) {
  if (!AUDIT_ROWS) throw new Error('Audit data is not loaded yet.');
  const cached = templates.get(SQL);
  if (cached && cached.rows === AUDIT_ROWS) return cached.bytes;
  const db = new SQL.Database();
  db.run(SCHEMA_SQL);
  db.run('BEGIN');
  const ins = db.prepare('INSERT INTO audits VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const r of AUDIT_ROWS) ins.run(r);
  ins.free();
  db.run('COMMIT');
  const bytes = db.export();
  db.close();
  templates.set(SQL, { rows: AUDIT_ROWS, bytes });
  return bytes;
}

// Runs `sql` against a fresh copy of the dataset, so a participant can never
// damage the data (even with DROP/DELETE). Returns { result } or { error }.
export function runQuery(SQL, sql) {
  if (!sql || !sql.trim()) return { error: 'The editor is empty. Write a query first.' };
  const db = new SQL.Database(templateBytes(SQL));
  try {
    let result = null;
    let count = 0;
    for (const stmt of db.iterateStatements(sql)) {
      count++;
      if (count > 1) {
        return { error: 'Please run one query at a time (only one statement is allowed).' };
      }
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) {
        if (rows.length >= MAX_ROWS) return { error: `Your query returned more than ${MAX_ROWS} rows. Add a filter.` };
        rows.push(stmt.get());
      }
      if (columns.length) result = { columns, rows };
    }
    if (count === 0) return { error: 'No SQL statement found. Write a SELECT query.' };
    if (!result) return { error: "Your SQL ran, but it didn't return a table. Missions need a SELECT query." };
    return { result };
  } catch (e) {
    return { error: friendlyError(String((e && e.message) || e)) };
  } finally {
    db.close();
  }
}

function friendlyError(msg) {
  if (/no such table/i.test(msg)) return `${msg}. The table is called audits.`;
  if (/no such column/i.test(msg)) return `${msg}. Check the column name, and put text values in 'single quotes'.`;
  if (/syntax error/i.test(msg)) return `${msg}. Check for a missing comma, quote or keyword.`;
  if (/incomplete input/i.test(msg)) return `${msg}. The query seems unfinished. Check for a missing quote or bracket.`;
  return msg;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------
function norm(v) {
  if (v === null || v === undefined) return '\u0000NULL';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  return String(v);
}

function permutations(n) {
  if (n > 4) return [];
  const out = [];
  const go = (prefix, rest) => {
    if (!rest.length) return out.push(prefix);
    rest.forEach((x, i) => go([...prefix, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  go([], [...Array(n).keys()]);
  return out;
}

function compareWithMapping(actual, expected, mapIdx, orderMatters, orderKey) {
  const act = actual.rows.map((r) => JSON.stringify(mapIdx.map((i) => norm(r[i]))));
  const exp = expected.rows.map((r) => JSON.stringify(r.map(norm)));
  if (act.length !== exp.length) {
    if (act.length === 0) {
      return {
        correct: false,
        message: `Your query returned no rows, but ${exp.length} were expected. Check your WHERE condition. Text matching is case-sensitive ('Fail' is not 'fail').`,
      };
    }
    return {
      correct: false,
      message: `Expected ${exp.length} row(s), but your query returned ${act.length}. Check your WHERE condition${exp.length < 10 ? ' or GROUP BY' : ''}.`,
    };
  }
  if (JSON.stringify([...act].sort()) !== JSON.stringify([...exp].sort())) {
    return {
      correct: false,
      message: 'The number of rows is right, but some values are different. Check your columns and conditions.',
    };
  }
  if (orderMatters) {
    // With an orderKey, only that column's sequence must match, so rows that
    // tie on it may come in any order.
    const k = orderKey ? expected.columns.map((c) => c.toLowerCase()).indexOf(orderKey.toLowerCase()) : -1;
    const seq = (rows) => JSON.stringify(k >= 0 ? rows.map((r) => JSON.parse(r)[k]) : rows);
    if (seq(act) !== seq(exp)) {
      return { correct: false, message: 'The rows are right, but the order is not. Check your ORDER BY (ASC or DESC?).' };
    }
  }
  return { correct: true, message: 'Correct! Your query found exactly the right evidence.' };
}

// Compares two result sets. Column names don't need to match (aliases are
// fine) and column order doesn't matter. Returns { correct, message }.
export function compareResults(actual, expected, orderMatters, orderKey) {
  const expCols = expected.columns.map((c) => c.toLowerCase());
  const actCols = actual.columns.map((c) => c.toLowerCase());
  const n = expCols.length;

  if (actCols.length !== n) {
    return {
      correct: false,
      message: `Expected ${n} column(s), but your query returned ${actCols.length}. Re-read the task to see which columns to show.`,
    };
  }

  // Candidate column mappings: by name first, then by position, then any
  // other order (small column counts only).
  const candidates = [];
  if (expCols.every((c) => actCols.includes(c)) && new Set(actCols).size === n) {
    candidates.push(expCols.map((c) => actCols.indexOf(c)));
  }
  candidates.push([...Array(n).keys()]);
  candidates.push(...permutations(n));

  let first = null;
  for (const map of candidates) {
    const r = compareWithMapping(actual, expected, map, orderMatters, orderKey);
    if (r.correct) return r;
    if (!first) first = r;
  }
  return first;
}

// Runs the participant's query and grades it against the mission solution.
// Returns { correct, message, result?, error? }.
export function checkAnswer(SQL, mission, sql) {
  const run = runQuery(SQL, sql);
  if (run.error) return { correct: false, error: run.error, message: run.error };
  if (!expectedCache.has(mission.id)) {
    const ref = runQuery(SQL, mission.solution);
    if (ref.error) throw new Error(`Mission ${mission.id} solution is broken: ${ref.error}`);
    expectedCache.set(mission.id, ref.result);
  }
  return {
    ...compareResults(run.result, expectedCache.get(mission.id), mission.orderMatters, mission.orderKey),
    result: run.result,
  };
}
