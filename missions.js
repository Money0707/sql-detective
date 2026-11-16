// SQL Detective — dataset, missions and grader.
// No DOM code here: the same file is used by the browser AND by the
// Supabase Edge Function that re-grades submissions server-side.

// ---------------------------------------------------------------------------
// Fictional Customer Service QA audit dataset
// ---------------------------------------------------------------------------
export const SCHEMA_SQL = `
CREATE TABLE audits (
  audit_id   INTEGER PRIMARY KEY,
  audit_date TEXT    NOT NULL,  -- YYYY-MM-DD
  market     TEXT    NOT NULL,  -- MY | ID | TH | VN | KH | PH
  channel    TEXT    NOT NULL,  -- Phone | Chat | Email
  agent_name TEXT    NOT NULL,
  qa_score   INTEGER NOT NULL,  -- 0 to 100
  result     TEXT    NOT NULL   -- 'Pass' (score 80+) or 'Fail'
);

INSERT INTO audits VALUES
  (1001, '2026-09-01', 'MY', 'Phone', 'Aisyah Rahman',   91, 'Pass'),
  (1002, '2026-09-01', 'MY', 'Chat',  'Daniel Tan',      76, 'Fail'),
  (1003, '2026-09-02', 'MY', 'Email', 'Nurul Hassan',    85, 'Pass'),
  (1004, '2026-09-03', 'MY', 'Phone', 'Kumar Raj',       88, 'Pass'),
  (1005, '2026-09-04', 'MY', 'Chat',  'Mei Ling Wong',   79, 'Fail'),
  (1006, '2026-09-04', 'ID', 'Phone', 'Putri Wulandari', 93, 'Pass'),
  (1007, '2026-09-05', 'ID', 'Chat',  'Budi Santoso',    71, 'Fail'),
  (1008, '2026-09-08', 'ID', 'Email', 'Dewi Lestari',    84, 'Pass'),
  (1009, '2026-09-08', 'ID', 'Phone', 'Agus Pratama',    66, 'Fail'),
  (1010, '2026-09-09', 'ID', 'Chat',  'Rina Kusuma',     82, 'Pass'),
  (1011, '2026-09-10', 'TH', 'Phone', 'Somchai Chaiyo',  87, 'Pass'),
  (1012, '2026-09-11', 'TH', 'Email', 'Nattaya Srisuk',  90, 'Pass'),
  (1013, '2026-09-11', 'TH', 'Chat',  'Anan Boonmee',    74, 'Fail'),
  (1014, '2026-09-12', 'TH', 'Phone', 'Kanya Thongdee',  81, 'Pass'),
  (1015, '2026-09-15', 'TH', 'Chat',  'Preecha Wongsa',  95, 'Pass'),
  (1016, '2026-09-15', 'VN', 'Phone', 'Nguyen Thi Lan',  89, 'Pass'),
  (1017, '2026-09-16', 'VN', 'Chat',  'Tran Van Minh',   68, 'Fail'),
  (1018, '2026-09-17', 'VN', 'Email', 'Le Thu Ha',       80, 'Pass'),
  (1019, '2026-09-18', 'VN', 'Phone', 'Pham Quoc Bao',   77, 'Fail'),
  (1020, '2026-09-18', 'VN', 'Chat',  'Hoang Mai Anh',   72, 'Fail'),
  (1021, '2026-09-22', 'KH', 'Phone', 'Sokha Chea',      86, 'Pass'),
  (1022, '2026-09-22', 'KH', 'Chat',  'Dara Sok',        70, 'Fail'),
  (1023, '2026-09-23', 'KH', 'Email', 'Srey Pich Kim',   92, 'Pass'),
  (1024, '2026-09-24', 'KH', 'Phone', 'Vuthy Long',      83, 'Pass'),
  (1025, '2026-09-25', 'KH', 'Chat',  'Chanthy Men',     78, 'Fail'),
  (1026, '2026-09-25', 'PH', 'Phone', 'Maria Santos',    92, 'Pass'),
  (1027, '2026-09-26', 'PH', 'Chat',  'Jose Reyes',      74, 'Fail'),
  (1028, '2026-09-29', 'PH', 'Email', 'Ana Cruz',        88, 'Pass'),
  (1029, '2026-09-29', 'PH', 'Phone', 'Paolo Garcia',    65, 'Fail'),
  (1030, '2026-09-30', 'PH', 'Phone', 'Ramon Bautista',  96, 'Pass');
`;

// Shown in the "Evidence table" panel.
export const TABLES = [
  {
    name: 'audits',
    columns: [
      ['audit_id', 'number, e.g. 1001'],
      ['audit_date', "text, e.g. '2026-09-01'"],
      ['market', "'MY', 'ID', 'TH', 'VN', 'KH', 'PH'"],
      ['channel', "'Phone', 'Chat', 'Email'"],
      ['agent_name', "text, e.g. 'Aisyah Rahman'"],
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
    title: 'First Look at the Evidence',
    concept: 'SELECT chooses which columns you want to see, and FROM names the table they come from. Use * to see every column.',
    example: 'SELECT market, channel\nFROM audits;',
    task: 'Show the agent_name, market and qa_score of every audit.',
    starter: 'SELECT *\nFROM audits;',
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
    title: 'The Failed Audits',
    concept: "WHERE keeps only the rows that match a condition. Put text values in single quotes. Text matching is exact, so 'Fail' and 'fail' are different.",
    example: "SELECT agent_name, channel\nFROM audits\nWHERE channel = 'Chat';",
    task: "Show the audit_id, agent_name, market and qa_score of every audit whose result is 'Fail'.",
    starter: 'SELECT *\nFROM audits;',
    hints: [
      'Add a WHERE line after FROM audits.',
      "The condition is: result = 'Fail' (capital F, single quotes).",
      "Pattern: SELECT audit_id, agent_name, market, qa_score FROM audits WHERE result = 'Fail';",
    ],
    solution: "SELECT audit_id, agent_name, market, qa_score FROM audits WHERE result = 'Fail';",
    orderMatters: false,
  },
  {
    id: 'm3',
    title: 'Ranking the PH Team',
    concept: 'ORDER BY sorts the results. ASC (the default) puts the lowest value first and DESC puts the highest first. ORDER BY goes after WHERE.',
    example: "SELECT agent_name, audit_date\nFROM audits\nWHERE channel = 'Email'\nORDER BY audit_date DESC;",
    task: "Show the agent_name and qa_score of every audit in the 'PH' market, sorted from the highest qa_score to the lowest.",
    starter: 'SELECT *\nFROM audits;',
    hints: [
      "First filter: WHERE market = 'PH'.",
      'Then sort on the last line: ORDER BY qa_score DESC.',
      "Pattern: SELECT agent_name, qa_score FROM audits WHERE market = 'PH' ORDER BY qa_score DESC;",
    ],
    solution: "SELECT agent_name, qa_score FROM audits WHERE market = 'PH' ORDER BY qa_score DESC;",
    orderMatters: true,
  },
  {
    id: 'm4',
    title: 'How Many Failed?',
    concept: 'COUNT(*) counts rows. With a WHERE clause it counts only the rows that match, and the answer is a single number. AS gives the result column a name.',
    example: "SELECT COUNT(*) AS chat_audits\nFROM audits\nWHERE channel = 'Chat';",
    task: "Count how many audits have the result 'Fail'. Your answer should be one number.",
    starter: 'SELECT *\nFROM audits;',
    hints: [
      'Replace * with COUNT(*).',
      "Keep only failed audits with WHERE result = 'Fail'.",
      "Pattern: SELECT COUNT(*) FROM audits WHERE result = 'Fail';",
    ],
    solution: "SELECT COUNT(*) AS failed_audits FROM audits WHERE result = 'Fail';",
    orderMatters: false,
  },
  {
    id: 'm5',
    title: 'Failures by Market',
    concept: 'GROUP BY puts rows that share a value into groups, and COUNT(*) then counts the rows in each group. The order is SELECT, FROM, WHERE, then GROUP BY.',
    example: 'SELECT channel, COUNT(*) AS audits\nFROM audits\nGROUP BY channel;',
    task: 'For each market, count how many audits failed. Show two columns: the market and its number of failed audits.',
    starter: 'SELECT *\nFROM audits;',
    hints: [
      'Select two things: market and COUNT(*).',
      "Filter first with WHERE result = 'Fail', then add GROUP BY market.",
      "Pattern: SELECT market, COUNT(*) FROM audits WHERE result = 'Fail' GROUP BY market;",
    ],
    solution: "SELECT market, COUNT(*) AS failed_audits FROM audits WHERE result = 'Fail' GROUP BY market;",
    orderMatters: false,
  },
];

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------
const MAX_ROWS = 500;

// Runs `sql` against a fresh copy of the dataset, so a participant can never
// damage the data (even with DROP/DELETE). Returns { result } or { error }.
export function runQuery(SQL, sql) {
  if (!sql || !sql.trim()) return { error: 'The editor is empty. Write a query first.' };
  const db = new SQL.Database();
  try {
    db.run(SCHEMA_SQL);
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

function compareWithMapping(actual, expected, mapIdx, orderMatters) {
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
  if (orderMatters && JSON.stringify(act) !== JSON.stringify(exp)) {
    return { correct: false, message: 'The rows are right, but the order is not. Check your ORDER BY (ASC or DESC?).' };
  }
  return { correct: true, message: 'Correct! Your query found exactly the right evidence.' };
}

// Compares two result sets. Column names don't need to match (aliases are
// fine) and column order doesn't matter. Returns { correct, message }.
export function compareResults(actual, expected, orderMatters) {
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
    const r = compareWithMapping(actual, expected, map, orderMatters);
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
  const ref = runQuery(SQL, mission.solution);
  if (ref.error) throw new Error(`Mission ${mission.id} solution is broken: ${ref.error}`);
  return { ...compareResults(run.result, ref.result, mission.orderMatters), result: run.result };
}
