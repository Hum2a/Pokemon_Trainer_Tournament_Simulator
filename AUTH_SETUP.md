# Auth & Supabase Setup

This app uses [Supabase](https://supabase.com) for authentication and per-user storage (config, simulation results).

**Guest mode:** Users can run simulations and download outputs without signing in. Sign in is only required to **save results to their account**.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Wait for the project to finish provisioning

## 2. Run the Database Migration

In the Supabase Dashboard:

1. Open **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run it

This creates `user_configs`, `simulation_runs`, and `simulation_results` tables with RLS.

## 3. Get Your API Keys

In Supabase: **Project Settings** → **API** (or **API Keys**)

- **Project URL** → `SUPABASE_URL` (backend) and `VITE_SUPABASE_URL` (frontend)
- **Publishable key** (`sb_publishable_...`) → `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend)
- **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY` (backend only; keep secret)
- **JWT Secret** → `SUPABASE_JWT_SECRET` (backend; under "JWT Settings" for verifying auth tokens)

Legacy keys still work: `anon` → `VITE_SUPABASE_ANON_KEY`, `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Configure Environment Variables

### Backend (root)

Create `.env` in the project root:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SECRET_KEY=your-secret-key
```

### Frontend

Create `frontend/.env`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## 5. Enable Email Auth (Optional)

By default Supabase allows email signup. To customize:

- **Authentication** → **Providers** → **Email**: enable/disable, set email templates
- **Authentication** → **URL Configuration**: add your site URL for redirects

## 6. Deploy (Render)

Add these as environment variables in Render:

- `SUPABASE_URL`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_SECRET_KEY`

For the frontend build, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

(Vite bakes these into the build at build time.)
