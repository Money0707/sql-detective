// SQL Detective — submission endpoint.
// Re-grades every answer server-side with the same missions.js + SQLite engine
// the browser uses, then stores the result. The client never sends a score.
import initSqlJs from "npm:sql.js@1.12.0/dist/sql-asm.js";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { MISSIONS, checkAnswer, loadAuditRows } from "./missions.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SQL = 4000;

const sqlReady = initSqlJs();
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// The same 10,000 fictional rows the website loads, read once per instance.
let dataReady: Promise<void> | null = null;
function ensureData() {
  if (!dataReady) {
    dataReady = db.rpc("audit_rows").then(({ data, error }) => {
      if (error) throw error;
      loadAuditRows(data);
    }).catch((e) => {
      dataReady = null;
      throw e;
    });
  }
  return dataReady;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const id = String(body?.participant_id ?? "");
  const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
  const answers = body?.answers;
  if (!UUID_RE.test(id)) return json(400, { error: "Invalid participant id." });
  if (name.length < 1 || name.length > 60) return json(400, { error: "Name must be 1–60 characters." });
  if (typeof answers !== "object" || answers === null) return json(400, { error: "Missing answers." });

  const SQL = await sqlReady;
  try {
    await ensureData();
  } catch (e) {
    console.error(e);
    return json(503, { error: "Could not load the audit data. Please try again." });
  }
  const graded: Record<string, { sql: string; correct: boolean }> = {};
  let score = 0;
  for (const m of MISSIONS) {
    const sql = typeof answers[m.id] === "string" ? answers[m.id].slice(0, MAX_SQL) : "";
    let correct = false;
    if (sql.trim()) {
      try {
        correct = checkAnswer(SQL, m, sql).correct === true;
      } catch {
        correct = false;
      }
    }
    if (correct) score++;
    graded[m.id] = { sql, correct };
  }

  const { data, error } = await db.rpc("record_submission", {
    p_participant_id: id,
    p_name: name,
    p_score: score,
    p_total: MISSIONS.length,
    p_answers: graded,
  });
  if (error) {
    console.error(error);
    return json(500, { error: "Could not save your submission. Please try again." });
  }

  return json(200, {
    score,
    total: MISSIONS.length,
    results: Object.fromEntries(Object.entries(graded).map(([k, v]) => [k, v.correct])),
    submitted_at: data?.submitted_at,
    submission_count: data?.submission_count,
  });
});
