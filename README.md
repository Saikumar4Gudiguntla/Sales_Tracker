# CRM & License Tracker

React + Vite + Ant Design + Supabase. Replaces the two Excel trackers with a shared, multi-user web app.

## 1. Create Supabase project
1. https://supabase.com → New project (free tier).
2. SQL Editor → paste and run `supabase/schema.sql`.
3. Sign up your first user in the app (step 4), then optionally run `supabase/seed.sql` to load the historical leads/licenses from your trackers.
4. Project Settings → API → copy **Project URL** and **anon public key**.

## 2. Configure the app
```bash
cp .env.example .env
# paste your Project URL and anon key into .env
npm install
npm run dev
```
Open http://localhost:5173, use "Create account" to sign up (first user), then sign in.

## 3. Deploy free
Push this folder to a GitHub repo, then on https://vercel.com → New Project → import the repo.
- Framework preset: Vite
- Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings
- Deploy — you get a shareable `https://your-app.vercel.app` URL

Netlify or Cloudflare Pages work identically (same build command `npm run build`, output dir `dist`).

## Roles
Every new sign-up defaults to role `sales` in the `profiles` table. Promote a user to `admin`/`manager` by editing their row directly in Supabase Table Editor. Role-based UI restrictions aren't wired up yet — RLS currently allows any authenticated user full CRUD; tighten policies in `schema.sql` before opening this to a larger team.

## Backup
Supabase → Database → Backups (automatic daily on free tier), or `pg_dump` via the connection string in Project Settings → Database. In-app: use the Export buttons on Leads/Licenses to pull an Excel snapshot any time.

## Folder structure
```
src/
  pages/        Dashboard, Leads, Licenses, Reports, Login
  components/   Layout (sidebar/topbar)
  contexts/     AuthContext (Supabase session/profile)
  utils/        excel.js (import/export + column mapping from your original trackers)
supabase/
  schema.sql    tables, RLS, audit triggers, dashboard view
  seed.sql      your historical data, cleaned and normalized
```

## Known data-cleanup notes from the original trackers
- Duplicate leads across the Apr and May/June tracker tabs (e.g. Colis Express, B2 Medical) were de-duplicated on import by (lead name + contact name).
- Customers appearing in both the Leads and Licenses trackers (Ragle Inc, Colis Express, Top Tier Utility, Yuno Group, Scale Resource Group) are separate rows for now — link them via `licenses.lead_id` in Supabase once you're ready to enforce lead→license traceability in the UI.
- Free-text `Status`/`Next Action` fields were kept as-is; dates embedded in that text weren't parsed automatically, only the explicit date columns were.
