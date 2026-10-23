import { API_URL } from './config.js';

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

function buildUrl(path, query) {
  const url = new URL(`${API_URL}/api${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function parse(res) {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const err = body?.error;
    throw new ApiError(err?.message || (res.status === 0 ? 'Network error' : 'Something went wrong'), {
      status: res.status,
      code: err?.code,
      details: err?.details,
    });
  }
  return body;
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(parse)
      .then((body) => {
        accessToken = body.data.accessToken;
        return body.data;
      })
      .catch((err) => {
        accessToken = null;
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Calls the API and returns `{ data, meta }`. On a 401 it refreshes the session once
 * and retries; if that fails the session-expired handler logs the user out.
 */
export async function request(path, { method = 'GET', body, query, signal, retry = true } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      ...(body !== undefined && { body: isForm ? body : JSON.stringify(body) }),
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', { status: 0, code: 'NETWORK' });
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      onSessionExpired();
      throw new ApiError('Your session has expired. Please log in again.', { status: 401, code: 'UNAUTHORIZED' });
    }
    return request(path, { method, body, query, signal, retry: false });
  }
  const parsed = await parse(res);
  return { data: parsed.data, meta: parsed.meta };
}

export const api = {
  get: (path, query, opts) => request(path, { ...opts, query }).then((r) => r.data),
  page: (path, query, opts) => request(path, { ...opts, query }),
  post: (path, body) => request(path, { method: 'POST', body }).then((r) => r.data),
  patch: (path, body) => request(path, { method: 'PATCH', body }).then((r) => r.data),
  delete: (path, body) => request(path, { method: 'DELETE', body }).then((r) => r.data),
};
