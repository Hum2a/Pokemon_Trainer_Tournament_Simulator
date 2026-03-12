import { supabase } from './lib/supabase';

// For split deployment: set VITE_API_URL to backend base (e.g. https://api.example.com)
const API_BASE =
  (import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') ?? '') + '/api';

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  // Use getSession only - refreshSession can trigger onAuthStateChange(null) and clear auth state
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function apiGet<T = unknown>(
  endpoint: string,
  options?: { timeoutMs?: number; skipAuth?: boolean }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 60000;
  const skipAuth = options?.skipAuth ?? false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = skipAuth ? {} : await authHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || res.statusText);
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Is the backend running?`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Public dex/smogon endpoints - no auth, 30s timeout. Use for initial data load. */
export const dexOpts = { skipAuth: true, timeoutMs: 30000 } as const;

export async function apiPost<T = unknown>(endpoint: string, body?: object): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export async function apiPatch<T = unknown>(endpoint: string, body?: object): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

/** Fetch admin health from a specific API base URL (for local/live server checks). */
export async function fetchHealthFrom(
  baseUrl: string,
  options?: { timeoutMs?: number }
): Promise<{ checks: HealthCheck[] }> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const headers = await authHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/admin/health`, {
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
    return data as { checks: HealthCheck[] };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  ms?: number;
}

/** Fetch a file and trigger browser download. */
export async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, { headers, credentials: 'include' });
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Local backend URL for admin health check (dev: 127.0.0.1:5000). */
export const LOCAL_API_BASE =
  (import.meta.env.VITE_LOCAL_API_URL?.toString().replace(/\/$/, '') ?? 'http://127.0.0.1:5000') +
  '/api';

/** Live/production backend URL for admin health check. Empty if not configured. */
const liveBase = (import.meta.env.VITE_LIVE_API_URL ?? import.meta.env.VITE_API_URL)?.toString().replace(/\/$/, '');
export const LIVE_API_BASE = liveBase ? liveBase + '/api' : '';

export const api = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  delete: apiDelete,
  downloadFile,
  base: API_BASE,
};
