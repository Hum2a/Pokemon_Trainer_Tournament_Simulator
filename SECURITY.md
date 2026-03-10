# Security Report & Hardening

This document summarizes the security audit and fixes applied to the Pokemon Battle Simulator codebase.

## Fixes Applied

### 1. Authentication (Critical)

**Issue:** Sensitive API endpoints were accessible without authentication when Supabase was not configured.

**Fix:** Added `@require_auth` to all endpoints that modify state or access sensitive data:

- `/api/config` (GET, POST)
- `/api/build-trainer`, `/api/build-pokemon`
- `/api/run-trainer`, `/api/run-pokemon`, `/api/run-matchups`
- `/api/parse-png`, `/api/parse-csv`
- `/api/status`, `/api/terminate-task`
- `/api/outputs/*`, `/api/outputs/<filename>`
- `/api/files/read`, `/api/files/write`

**Note:** Supabase must be configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) for these endpoints to work. Without it, they return 503. See AUTH_SETUP.md.

### 2. Path Traversal (High)

**Issue:** `parse.output_file` in config was not validated, allowing paths like `../../../etc/passwd`.

**Fix:** Added `_is_safe_parse_output_path()` in `src/security.py` to validate:
- No `..`, no leading `/`, no backslash
- No `<>"|?*`
- Only simple filenames or paths under `Outputs/`

### 3. Config Bounds (Medium)

**Issue:** Unbounded values could cause DoS (e.g. `run_n_times` = 1e9, `poolLimit` = 1e6).

**Fix:** Added validation in `validate_config()`:
- `trainer.run_n_times`: 1–10000
- `matchups.poolLimit`: 1–500
- Matchup filter lists (poolTypes, etc.): max 50 items each

### 4. Dependencies (Medium)

**Issue:** Vulnerable package versions.

**Fix:** Upgraded in `requirements.txt`:
- `flask-cors` 5.0.0 → ≥6.0.0 (CVE-2024-6839)
- `Pillow` 10.3.0 → ≥12.1.1 (CVE-2026-25990)
- `Requests` 2.32.2 → ≥2.32.4 (credential leak fix)

### 5. CORS (Medium)

**Issue:** `CORS_ORIGINS=*` could allow overly permissive cross-origin access.

**Fix:** Reject `*` in CORS origins. Only explicit origins are applied.

### 6. Content-Security-Policy (Low)

**Fix:** Added CSP header allowing `self`, Supabase, Showdown CDN, data.pkmn.cc.

---

## Remaining Recommendations

### Rate Limiting (Medium)

No rate limiting is implemented. Consider adding Flask-Limiter for:
- Auth endpoints
- Config/simulation endpoints
- File operations

### Auth Check Endpoint (Low)

`/api/auth/check` returns `server_configured`, `auth_valid`, and hints. This can help attackers understand auth setup. Consider restricting or reducing information in production.

### Secrets

- Ensure `.env` and `frontend/.env` are never committed (they are in `.gitignore`).
- Rotate Supabase keys if they were ever exposed.
- Use a secrets manager in production (e.g. Render env vars, not committed files).

---

## Public Endpoints (No Auth Required)

These remain unauthenticated by design:

- `/api/auth/check` – diagnostic
- `/api/dex/<type>` – dex data (species, moves, etc.)
- `/api/smogon/sets/*` – Smogon format data
- `/api/auth/me` – requires auth but returns user info

---

## Reporting Vulnerabilities

If you discover a security issue, please report it privately (e.g. via GitHub Security Advisories or direct contact) rather than opening a public issue.
