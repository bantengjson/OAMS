/**
 * Thin fetch wrapper for the OAMS API.
 *
 * - Same-origin `/api/v1` (Next.js rewrites it to the backend in dev; Nginx in prod).
 * - Access token lives only in memory; the refresh token is an HttpOnly cookie
 *   scoped to `/api/v1/auth`, so `credentials: 'include'` is always sent.
 * - On a 401 outside `/auth/*` the client refreshes once (shared across
 *   concurrent callers) and retries; when that fails the unauthorized
 *   handler runs and the error propagates.
 */

import type { LoginResponse } from '@/types/api';

export const API_BASE = '/api/v1';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: FieldErrors;

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

/** Any plain object; undefined, null and empty-string values are skipped. */
export type QueryInput = object;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryInput;
  signal?: AbortSignal;
}

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshInFlight: Promise<LoginResponse | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function buildUrl(path: string, query?: QueryInput): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value as QueryValue));
    }
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    const text = await response.text().catch(() => '');
    return text ? { message: text } : undefined;
  }
  return response.json().catch(() => undefined);
}

function toApiError(status: number, body: unknown): ApiError {
  const obj = (body ?? {}) as { message?: unknown; errors?: unknown };
  const message =
    typeof obj.message === 'string' && obj.message.trim()
      ? obj.message
      : status >= 500
        ? 'Terjadi kesalahan pada server.'
        : 'Permintaan tidak dapat diproses.';
  const errors =
    obj.errors && typeof obj.errors === 'object' ? (obj.errors as FieldErrors) : undefined;
  return new ApiError(status, message, errors);
}

async function rawFetch(path: string, init: RequestOptions): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body; // the browser sets the multipart boundary itself
  } else if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }
  try {
    return await fetch(buildUrl(path, init.query), {
      method: init.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Tidak dapat terhubung ke server.');
  }
}

/**
 * Exchanges the refresh cookie for a new session. One request is shared by
 * every concurrent caller (401 retries, provider bootstrap, StrictMode double
 * effects), because presenting the same cookie twice would look like a replay.
 * Resolves null when there is no usable session; never throws.
 */
export function refreshSession(): Promise<LoginResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          accessToken = null;
          return null;
        }
        const data = (await response.json().catch(() => null)) as LoginResponse | null;
        if (!data?.accessToken) {
          accessToken = null;
          return null;
        }
        accessToken = data.accessToken;
        return data;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function refreshAccessToken(): Promise<boolean> {
  return (await refreshSession()) !== null;
}

/** Performs the request, transparently refreshing the session once on 401. */
async function requestWithRefresh(path: string, init: RequestOptions): Promise<Response> {
  let response = await rawFetch(path, init);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      accessToken = null;
      unauthorizedHandler?.();
      throw toApiError(401, await parseBody(response));
    }
    response = await rawFetch(path, init);
  }
  return response;
}

export async function apiFetch<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const response = await requestWithRefresh(path, init);
  const body = await parseBody(response);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

/** Multipart upload (photos, documents). */
export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: formData });
}

/** Authenticated binary download (photos, documents, QR files). */
export async function fetchBlob(path: string, query?: QueryInput): Promise<Blob> {
  const response = await requestWithRefresh(path, { method: 'GET', query });
  if (!response.ok) throw toApiError(response.status, await parseBody(response));
  return response.blob();
}

export const api = {
  get: <T>(path: string, opts: { query?: QueryInput; signal?: AbortSignal } = {}) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),
  post: <T = void>(path: string, body?: unknown, opts: { query?: QueryInput } = {}) =>
    apiFetch<T>(path, { method: 'POST', body, ...opts }),
  put: <T = void>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T = void>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
