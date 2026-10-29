const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000';
let accessToken: string | null = null;
export const setToken = (t: string | null) => { accessToken = t; };
export const getToken = () => accessToken;

export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  const doFetch = () => fetch(BASE + path, { method, credentials: 'include', headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let r = await doFetch();
  if (r.status === 401 && accessToken) {
    const rr = await fetch(BASE + '/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (rr.ok) { const d = (await rr.json()) as { accessToken: string }; accessToken = d.accessToken; r = await doFetch(); }
  }
  if (!r.ok) { let msg = `Request failed (${r.status})`; try { const d = (await r.json()) as { error?: { message?: string } }; if (d.error?.message) msg = d.error.message; } catch { /* keep default */ } throw new Error(msg); }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}
export async function refreshSession(): Promise<{ user: unknown; accessToken: string } | null> {
  const r = await fetch(BASE + '/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!r.ok) return null; const d = (await r.json()) as { user: unknown; accessToken: string }; accessToken = d.accessToken; return d;
}
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Verified Jobs';
