# Frontend Refactor Plan: React + Vite + Tailwind + shadcn

## Executive Summary

Migrate the Pokemon Battle Simulator UI from **vanilla JS + Flask templates + custom CSS** to **React + Vite + Tailwind + shadcn**, keeping the Python Flask backend as a pure API server.

**Estimated effort:** 2–4 days for a single developer  
**Risk level:** Low–Medium (API stays unchanged; frontend is a full rewrite)

---

## Current Architecture

### Backend (unchanged)
- **Flask** app with API routes under `/api`
- **14 endpoints:** config, build-trainer, build-pokemon, run-trainer, run-pokemon, parse-png, parse-csv, status, outputs, outputs/<file>, files/read, files/write, smogon/sets/<format>, dex/<type>
- Serves templates + static files from `templates/` and `static/`

### Frontend (to be replaced)
| Asset | Lines | Purpose |
|-------|-------|---------|
| `templates/base.html` | ~30 | Layout, script loading |
| `templates/index.html` | ~12 | Main page, includes partials |
| `templates/partials/*.html` | ~150 | 6 partials (settings, editor, teambuilder, actions, log, outputs) |
| `static/js/api.js` | ~25 | API client |
| `static/js/logger.js` | ~50 | Log panel |
| `static/js/config.js` | ~55 | Settings load/save |
| `static/js/file-editor.js` | ~55 | File load/save/example |
| `static/js/teambuilder.js` | ~275 | Team builder (filters, Smogon, stats) |
| `static/js/actions.js` | ~80 | Build/run/parse buttons |
| `static/js/outputs.js` | ~60 | Output list + download |
| `static/js/main.js` | ~20 | Init, panel toggles |
| `static/style.css` | ~570 | All styles |
| **Total** | **~1,400** | |

---

## Target Architecture

```
Pokemon_Trainer_Tournament_Simulator/
├── app.py                    # Flask app (modified: serve SPA)
├── src/                      # Python backend (unchanged)
├── frontend/                 # NEW: React app
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts            # API client
│   │   ├── components/
│   │   │   ├── ui/           # shadcn components
│   │   │   ├── Settings.tsx
│   │   │   ├── FileEditor.tsx
│   │   │   ├── TeamBuilder.tsx
│   │   │   ├── Actions.tsx
│   │   │   ├── Log.tsx
│   │   │   └── Outputs.tsx
│   │   └── lib/utils.ts
│   └── public/
└── dist/                     # Vite build output (served by Flask in prod)
```

---

## Phase 1: Project Setup (0.5 day)

### 1.1 Create Vite + React + TypeScript project
```bash
cd Pokemon_Trainer_Tournament_Simulator
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 1.2 Add Tailwind CSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.3 Add shadcn/ui
```bash
npx shadcn@latest init
# Select: New York style, Zinc slate, CSS variables
```

### 1.4 Configure Vite proxy (dev mode)
In `frontend/vite.config.ts`:
```ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
```

### 1.5 Configure API base
- Dev: relative `/api` (Vite proxies to Flask)
- Prod: relative `/api` (Flask serves both SPA and API)

---

## Phase 2: Backend Modifications (0.25 day)

### 2.1 Change Flask to serve SPA
- **Dev:** Flask runs on 5000, Vite on 5173. User opens `http://localhost:5173`; Vite proxies `/api` → Flask.
- **Prod:** Flask serves `dist/index.html` for all non-API routes (SPA fallback).

```python
# pages.py - replace render_template with SPA serve
@pages_bp.route("/")
@pages_bp.route("/<path:path>")
def index(path=""):
    dist = ROOT / "dist"
    if dist.exists():
        return send_from_directory(dist, "index.html" if not path else path)
    return "Run: cd frontend && npm run build", 503
```

### 2.2 Enable CORS (optional, for separate dev servers)
Only if running frontend and backend on different origins during dev.

### 2.3 Files to modify
- `src/routes/pages.py` – serve SPA instead of templates
- `app.py` – remove `template_folder`, add `static_folder` for `dist/` when built
- Keep `src/routes/api.py` unchanged

---

## Phase 3: Component Migration (1.5–2 days)

### 3.1 Install shadcn components needed
```bash
npx shadcn@latest add button input select label card textarea tabs collapsible
```

### 3.2 Component mapping

| Current | React Component | shadcn / Tailwind |
|---------|-----------------|--------------------|
| Settings panel | `Settings.tsx` | Card, Input, Label, Checkbox, Button |
| File editor | `FileEditor.tsx` | Card, Select, Textarea, Button |
| Team builder | `TeamBuilder.tsx` | Card, Input, Select, Button, Combobox/Popover |
| Actions | `Actions.tsx` | Card, Button |
| Log | `Log.tsx` | Card, ScrollArea, Button |
| Outputs | `Outputs.tsx` | Card, Button, list |
| Panels | Collapsible | Collapsible |
| Header | `Header.tsx` | Simple div + typography |

### 3.3 State management
- **No Redux/Zustand initially** – use React state + props
- Consider `useContext` for: config, log messages, task status (polling)
- API client: single `api.ts` with `get`, `post`; base URL from `import.meta.env`

### 3.4 Feature parity checklist
- [ ] Settings: load, save, all fields
- [ ] File editor: load, save, load example, file select sync
- [ ] Team builder: species search, filters (type/region/role), stats, Smogon sets, level 50/100, add to team, export
- [ ] Actions: all 6 buttons, loading/disabled during runs
- [ ] Log: append, clear, auto-scroll
- [ ] Outputs: list, download links, refresh
- [ ] Panel collapse/expand
- [ ] Status polling (run-trainer, run-pokemon)

---

## Phase 4: Styling & Polish (0.5 day)

### 4.1 Theme
- Match current dark theme (slate/zinc)
- Use shadcn CSS variables
- Preserve Outfit + JetBrains Mono fonts

### 4.2 Responsive
- Current layout is desktop-first; maintain similar breakpoints

---

## Phase 5: Build & Deploy (0.25 day)

### 5.1 Build script
```json
// package.json (root or frontend)
"scripts": {
  "build": "cd frontend && npm run build",
  "dev": "concurrently \"flask run\" \"cd frontend && npm run dev\""
}
```

### 5.2 Production flow
1. `cd frontend && npm run build` → outputs to `frontend/dist/`
2. Copy or symlink `frontend/dist/` → `dist/` at project root (or configure Vite `outDir`)
3. `flask run` or `gunicorn` serves `dist/` for static + SPA, `/api` for API

### 5.3 Update .gitignore
```
frontend/node_modules/
frontend/dist/
dist/
```

---

## Effort Summary

| Phase | Task | Est. Hours |
|-------|------|------------|
| 1 | Project setup (Vite, React, Tailwind, shadcn) | 2–3 |
| 2 | Backend: SPA serve, CORS if needed | 1 |
| 3 | Settings component | 2 |
| 3 | File editor component | 2 |
| 3 | Team builder component | 4–6 |
| 3 | Actions component | 1 |
| 3 | Log component | 1 |
| 3 | Outputs component | 1 |
| 4 | Styling, theme, responsive | 2 |
| 5 | Build, scripts, docs | 1 |
| **Total** | | **17–22 hours** |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| shadcn Combobox complex for species search | Use Input + Popover + list; or keep custom dropdown |
| API contract drift | Keep API unchanged; add TypeScript types for responses |
| Build path confusion | Use single `dist/` at project root; Vite `outDir: '../dist'` |
| Dev workflow friction | Use `concurrently` to run Flask + Vite together |

---

## Rollback Plan

- Keep `templates/` and `static/` until migration is verified
- Feature flag or env var to switch between old (templates) and new (SPA) UI
- Git branch for refactor; merge only after full QA

---

## Recommended Order of Execution

1. **Phase 1** – Create `frontend/`, install deps, verify Vite dev server
2. **Phase 2** – Update Flask to serve SPA; verify `/api` still works
3. **Phase 3** – Build components in order: API client → Log → Settings → Actions → Outputs → FileEditor → TeamBuilder
4. **Phase 4** – Apply theme, fonts, polish
5. **Phase 5** – Build script, README update, test production build

---

## Optional Enhancements (Post-Migration)

- React Query / TanStack Query for API caching & polling
- Optimistic updates for config save
- Keyboard shortcuts
- Toast notifications (sonner) instead of log-only feedback
- Dark/light theme toggle
