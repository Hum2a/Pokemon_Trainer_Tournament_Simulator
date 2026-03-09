# Deployment Guide

This app is a **Flask backend + React frontend** that runs Pokemon Showdown simulations via subprocesses. It requires Python, Node.js, and long-running processes.

## Platform Comparison

| Platform | Suitability | Notes |
|----------|-------------|-------|
| **Render** | ✅ **Recommended** | Supports Docker, Python, Node, long-running processes. Free tier available (spins down after 15 min inactivity). |
| **Netlify** | ❌ Not suitable | Static sites + serverless functions only. 10–26s function timeout. No Python subprocess support. |
| **Cloudflare Pages** | ❌ Not suitable | Static hosting only. Workers are serverless JS with strict CPU limits. No Python. |

**Conclusion:** Use **Render** for this project.

---

## Deploy to Render (Recommended)

### Prerequisites

- GitHub/GitLab/Bitbucket repo with your code
- Ensure `pokemon-showdown` submodule is committed (or Render will fetch it during Docker build)

### Option A: One-Click with Blueprint

1. Go to [dashboard.render.com](https://dashboard.render.com/)
2. **New** → **Blueprint**
3. Connect your repository
4. Render will detect `render.yaml` and create the web service
5. Click **Apply**

### Option B: Manual Setup

1. Go to [dashboard.render.com](https://dashboard.render.com/)
2. **New** → **Web Service**
3. Connect your repository
4. Configure:
   - **Name:** `pokemon-simulator` (or any name)
   - **Region:** Choose closest to you
   - **Runtime:** **Docker**
   - **Dockerfile Path:** `./Dockerfile` (default)
   - Leave Build/Start commands empty (Dockerfile defines them)
5. Click **Create Web Service**

### After Deploy

- Your app will be at `https://<service-name>.onrender.com`
- **Free tier:** Service spins down after ~15 minutes of inactivity. First request after spin-down may take 30–60 seconds.
- **Dex data:** Run `Data/UsefulDatasets/fetch_dex_data.py` locally and commit the `dex-export/` files, or the Team Builder will show "Dex data not found" until you add them.

### Important Notes for Render

- **Ephemeral disk:** On free tier, `Data/` is ephemeral. Config and outputs reset on redeploy. For persistent data, use a [Render Disk](https://render.com/docs/disks) (paid).
- **Simulation timeouts:** Long simulations (hours) may be interrupted if the service spins down. Consider a paid plan for always-on behavior.
- **Build time:** First deploy takes 5–10 minutes (installs Node, Python, builds pokemon-showdown and frontend).

---

## Local Docker Build (Optional)

To test the production image locally:

```bash
# Ensure submodule is initialized
git submodule update --init --recursive

# Build
docker build -t pokemon-simulator .

# Run (port 5000)
docker run -p 5000:5000 -e PORT=5000 pokemon-simulator
```

Then open http://localhost:5000

---

## Alternative: Netlify + Cloudflare (Static Only)

If you only need to host the **frontend** (no simulations), you can:

1. Build: `cd frontend && npm run build`
2. Deploy `frontend/dist/` to Netlify or Cloudflare Pages
3. Configure a **backend URL** in the frontend (e.g. `VITE_API_URL`) and point API calls to a separately hosted Flask backend (e.g. on Render)

This requires splitting the app and hosting the API elsewhere. The current setup keeps both together for simplicity.
