const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const API_BASE = API_URL;

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('resolv_token');
}

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request — please check your input.',
  401: 'Your session has expired. Please log in again.',
  403: 'You don\'t have permission to do that.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred — this item may already exist.',
  422: 'The data you submitted is invalid.',
  429: 'Too many requests — please slow down.',
  500: 'Server error — our team has been notified. Please try again.',
  502: 'Server is temporarily unavailable. Please try again in a moment.',
  503: 'Service is down for maintenance. Please try again shortly.',
};

async function request<T>(path: string, options: RequestInit = {}, retries = 1): Promise<T> {
  const token = getToken();
  
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!res.ok) {
      // Auto-retry on 502/503/504 once
      if (retries > 0 && [502, 503, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, 1000));
        return request<T>(path, options, retries - 1);
      }
      
      const body = await res.json().catch(() => ({}));
      const serverMsg = body.error || body.message || body.msg;
      const friendlyMsg = ERROR_MESSAGES[res.status];
      
      // If server gave a specific message, use it; otherwise use friendly fallback
      const message = serverMsg && serverMsg !== 'Request failed' 
        ? serverMsg 
        : (friendlyMsg || `Request failed (${res.status})`);
      
      const err = new Error(message) as Error & { status: number; serverError?: string };
      err.status = res.status;
      err.serverError = serverMsg;
      throw err;
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err: any) {
    // Network error (no response)
    if (!err.status && err.name !== 'AbortError') {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return request<T>(path, options, retries - 1);
      }
      throw new Error('Cannot connect to server. Please check your connection.');
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
