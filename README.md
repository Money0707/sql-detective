# SQL Detective — The Quality Investigation

A one-time SQL class for Customer Service QA. Five beginner missions on a
fictional QA audit table, run with real SQLite (sql.js) in the browser.

## Pages
- `index.html` — participant page (name → 5 missions → submit). No login.
- `instructor.html` — instructor dashboard (one access code).

## Files
| File | Purpose |
|---|---|
| `missions.js` | Dataset, missions, hints, grader (shared with the server) |
| `app.js` | Participant page logic |
| `instructor.js` | Dashboard logic |
| `config.js` | Supabase URL + publishable key (public, safe to expose) |
| `vendor/` | sql.js (SQLite → WebAssembly), bundled so no CDN is needed |
| `supabase/functions/submit/` | Edge Function: re-grades answers server-side and saves them |

## Backend (Supabase project `sql-detective`)
- `submissions`: one row per participant browser; resubmitting replaces the
  row and increments `submission_count`. No public access (RLS on, no policies).
- `submit` Edge Function: the only write path. Scores are computed on the
  server; any score sent by a browser is ignored.
- `results` Edge Function: returns/deletes submissions for the dashboard,
  only when the correct instructor access code is given.

**If you edit `missions.js`**, copy it to `supabase/functions/submit/missions.js`
and redeploy the function, so browser and server grade the same way.

## Instructor access code
The dashboard asks for one access code (no account needed). It is stored as the
Edge Function secret `INSTRUCTOR_CODE`. To set or change it: Supabase Dashboard →
project `sql-detective` → Edge Functions → Secrets.

## Before the class
- Delete practice submissions from the dashboard (Delete button per row).
- Open the site once on a company laptop to confirm it can reach
  `*.supabase.co` and the hosting domain.
