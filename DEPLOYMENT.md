# Deployment Guide (Split Deployment)

This app uses **split deployment**: backend (Flask API) and frontend (React SPA) deploy separately.

## Architecture

| Component | Host | URL example |
|-----------|------|--------------|
| **Backend** | Render (Docker) | `https://pokemon-simulator-api.onrender.com` |
| **Frontend** | Netlify / Vercel / Cloudflare Pages | `https://pokemon-simulator.netlify.app` |

---

## 1. Deploy Backend (Render)

1. Go to [dashboard.render.com](https://dashboard.render.com/)
2. **New** → **Web Service**
3. Connect your repository
4. Configure:
   - **Name:** `pokemon-simulator-api`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./Dockerfile.backend`
5. Add environment variables:
   - `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY` (see AUTH_SETUP.md)
   - `CORS_ORIGINS` = `https://your-frontend.netlify.app` (your frontend URL, no trailing slash)
6. Deploy

Your API will be at `https://<service-name>.onrender.com`. Note this URL for the frontend.

---

## 2. Deploy Frontend (Netlify)

1. Go to [app.netlify.com](https://app.netlify.com/)
2. **Add new site** → **Import an existing project** → Connect GitHub
3. Configure:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add environment variables:
   - `VITE_API_URL` = `https://pokemon-simulator-api.onrender.com` (your backend URL)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (see AUTH_SETUP.md)
5. Deploy

---

## Alternative: Vercel Frontend

1. Import repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Build and output settings are auto-detected from `vercel.json`
4. Add environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Alternative: Cloudflare Pages Frontend

1. Connect repo at [dash.cloudflare.com](https://dash.cloudflare.com/) → Pages
2. **Build configuration:** Framework preset = None, or Vite
3. **Build command:** `npm run build`
4. **Build output:** `dist`
5. Add environment variables in Settings → Environment variables

---

## CORS

The backend must allow your frontend origin. Set `CORS_ORIGINS` to your frontend URL (comma-separated for multiple):

```
CORS_ORIGINS=https://pokemon-simulator.netlify.app,https://pokemon-simulator.vercel.app
```

---

## Local Development

Both together (same origin, no CORS):

```bash
npm run dev
```

Or run separately:

```bash
# Terminal 1: backend
python app.py

# Terminal 2: frontend (with API proxy or VITE_API_URL)
cd frontend && VITE_API_URL=http://localhost:5000 npm run dev
```

---

## Monolithic (Single Docker) Option

To deploy the full stack in one container (frontend + backend), use the original Dockerfile:

```bash
docker build -f Dockerfile -t pokemon-simulator .
```

Then set Render to use `./Dockerfile` instead of `./Dockerfile.backend`. No `CORS_ORIGINS` or `VITE_API_URL` needed.
