# Auth & Supabase Setup

This app uses [Supabase](https://supabase.com) for authentication and per-user storage (config, simulation results).

**Guest mode:** Users can run simulations and download outputs without signing in. Sign in is only required to **save results to their account**.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Wait for the project to finish provisioning

## 2. Run the Database Migration

In the Supabase Dashboard:

1. Open **SQL Editor**
2. Copy the contents of `supabase_migrations/migrations/001_initial_schema.sql`
3. Paste and run it

This creates `user_configs`, `simulation_runs`, and `simulation_results` tables with RLS.

## 3. Get Your API Keys

In Supabase: **Project Settings** → **API** (or **API Keys**)

- **Project URL** → `SUPABASE_URL` (backend) and `VITE_SUPABASE_URL` (frontend)
- **Publishable key** (`sb_publishable_...`) or **anon key** → `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend) and `SUPABASE_ANON_KEY` (backend)
- **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY` (backend only; keep secret)

No JWT secret needed—auth is verified via Supabase’s API.

## 4. Configure Environment Variables

### Backend (root)

Create `.env` in the project root:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
```

Use the same **anon** or **publishable** key you use in the frontend for `SUPABASE_ANON_KEY`.

### Frontend

Create `frontend/.env`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## 5. Google Sign-In (Optional)

To enable "Sign in with Google":

1. In **Supabase**: **Authentication** → **Providers** → **Google** → enable and add your Client ID + Client Secret (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
2. In **Supabase**: **Authentication** → **URL Configuration** → add your app URLs to **Redirect URLs**:
   - Local: `http://localhost:5173`
   - Production: `https://your-domain.com`
3. In **Google Cloud Console**: add the Supabase callback URL to Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`

## 6. Enable Email Auth (Optional)

By default Supabase allows email signup. To customize:

- **Authentication** → **Providers** → **Email**: enable/disable, set email templates

## 7. Troubleshooting

**"Save failed: Authentication required"** when saving simulations:

1. **Backend not configured**: Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in your root `.env`. Use the same anon/publishable key as the frontend.
2. **Token not reaching backend**: Visit `http://localhost:5173/api/auth/check` while signed in—it shows whether the auth header is received and the server is configured.
3. **Token expired**: Sign out and sign in again to refresh your session.
4. **Same origin**: If you switch between dev (localhost:5173) and prod (localhost:5000), sign in again—sessions are stored per origin.

## 8. Deploy (Render)

Add these as environment variables in Render:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`

For the frontend build, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

(Vite bakes these into the build at build time.)
