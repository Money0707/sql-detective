# SQL Detective — The Quality Investigation

A one-time SQL class for Customer Service QA. Five beginner missions on a
fictional QA audit table, run with real SQLite (sql.js) in the browser.

## Pages
- `index.html` — participant page (name → 5 missions → submit). No login.
- `instructor.html` — instructor dashboard (Supabase login, instructors only).

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
  row and increments `submission_count`. Anonymous users have no access.
- `instructors`: user ids allowed to read/delete submissions (RLS).
- `submit` Edge Function: the only write path. Scores are computed on the
  server; any score sent by a browser is ignored.

**If you edit `missions.js`**, copy it to `supabase/functions/submit/missions.js`
and redeploy the function, so browser and server grade the same way.

## Add an instructor
1. Supabase Dashboard → Authentication → Users → Add user → Create new user
   (tick "Auto Confirm User").
2. SQL Editor:
   `insert into public.instructors (user_id) select id from auth.users where email = 'you@example.com';`
3. Recommended: Authentication → Sign In / Providers → turn off "Allow new users to sign up".

## Before the class
- Delete practice submissions from the dashboard (Delete button per row).
- Open the site once on a company laptop to confirm it can reach
  `*.supabase.co` and the hosting domain.
