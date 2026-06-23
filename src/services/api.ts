import type { ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const TOKEN_KEY = 'dd_bloom_token';

export function setAuthToken(t: string) { sessionStorage.setItem(TOKEN_KEY, t); }
export function clearAuthToken() { sessionStorage.removeItem(TOKEN_KEY); }
export function getAuthToken() { return sessionStorage.getItem(TOKEN_KEY); }

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string>),
  };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { success: false, error: d.error || `HTTP ${r.status}`, code: d.code };
    return { success: true, data: d };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export const api = {
  get: <T>(ep: string) => request<T>(ep, { method: 'GET' }),
};
