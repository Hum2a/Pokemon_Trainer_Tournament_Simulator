import { supabase } from './lib/supabase';

const API_BASE = '/api';

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  // Refresh session to get a valid token (handles expiry). Fall back to getSession if no session.
  let token: string | null = null;
  const { data: refreshData } = await supabase.auth.refreshSession();
  token = refreshData.session?.access_token ?? null;
  if (!token) {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData.session?.access_token ?? null;
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, { headers, credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return res.json();
}

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

export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
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

export const api = {
  get: apiGet,
  post: apiPost,
  delete: apiDelete,
  downloadFile,
  base: API_BASE,
};
