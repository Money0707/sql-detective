// SQL Detective — instructor results endpoint.
// Protected by a single access code stored as the INSTRUCTOR_CODE secret.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Constant-time comparison of SHA-256 digests.
async function codeMatches(given: string): Promise<boolean> {
  const expected = Deno.env.get("INSTRUCTOR_CODE") ?? "";
  if (expected.length < 8) return false; // not configured
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
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

  if (!(await codeMatches(String(body?.code ?? "")))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json(401, { error: "Incorrect access code." });
  }

  if (body.action === "delete") {
    const id = String(body.participant_id ?? "");
    if (!UUID_RE.test(id)) return json(400, { error: "Invalid participant id." });
    const { error } = await db.from("submissions").delete().eq("participant_id", id);
    if (error) return json(500, { error: "Delete failed." });
    return json(200, { ok: true });
  }

  const { data, error } = await db
    .from("submissions")
    .select("*")
    .order("participant_name", { ascending: true });
  if (error) return json(500, { error: "Could not load submissions." });
  return json(200, { submissions: data });
});
