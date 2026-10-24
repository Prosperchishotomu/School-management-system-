const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
import { enqueueWrite, flushWrites } from './offlineQueue';

// All tokens stored in sessionStorage — dies when tab/browser closes
const getToken = () => sessionStorage.getItem('schoolbase_token');
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(async response => {
        if (!response.ok) throw new Error('Session refresh failed');
        const result = await response.json();
        const token = result.data?.token;
        if (!token) throw new Error('Session refresh returned no token');
        sessionStorage.setItem('schoolbase_token', token);
        return token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// Update last-active timestamp on every successful API call
const touchLastActive = () => {
  sessionStorage.setItem('schoolbase_last_active', Date.now().toString());
};

const emitRequestFeedback = (event, detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }
};

const requestLabel = (method) => ({
  POST: 'Action completed successfully.',
  PUT: 'Changes saved successfully.',
  PATCH: 'Changes saved successfully.',
  DELETE: 'Item removed successfully.',
}[method] || 'Request completed successfully.');

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const needsIdempotency = options.method === 'POST' &&
    /(?:payments|invoices\/generate|exam-entries\/[^/]+\/(?:submit|results-import)|results\/publish)/i.test(path);
  if (needsIdempotency && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = `web-${Date.now()}-${crypto.randomUUID()}`;
  }

  const activeSchoolId = sessionStorage.getItem('schoolbase_active_school_id');
  if (activeSchoolId) {
    headers['X-Active-School-Id'] = activeSchoolId;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    credentials: 'include',
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${path}`, config);

    // For 204 No Content
    if (response.status === 204) {
      touchLastActive();
      if (config.method !== 'GET' && !config.silent) {
        emitRequestFeedback('schoolbase:request-success', { method: config.method, path, message: requestLabel(config.method) });
      }
      return { data: null };
    }

    const result = await response.json();

    if (!response.ok) {
      // Auto-logout on 401 — session expired or invalid token
      // Do NOT redirect on the login endpoint itself (wrong password returns 401)
      if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh') && !config._retry) {
        try {
          await refreshAccessToken();
          return request(path, { ...options, _retry: true });
        } catch (_) {}
      }
      if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
        sessionStorage.removeItem('schoolbase_token');
        sessionStorage.removeItem('schoolbase_user');
        sessionStorage.removeItem('schoolbase_active_school_id');
        sessionStorage.removeItem('schoolbase_last_active');
        sessionStorage.removeItem('schoolbase_license_expired');
        window.location.replace('/login?expired=1');
      }
      if (result.error?.code === 'LICENSE_EXPIRED') {
        sessionStorage.setItem('schoolbase_license_expired', 'true');
      }
      if (response.status === 404 && (result.error?.message?.toLowerCase().includes('school not found') || path.startsWith('/schools/'))) {
        sessionStorage.removeItem('schoolbase_active_school_id');
        window.dispatchEvent(new CustomEvent('schoolbase:school-not-found', { detail: { path } }));
      }
      const requestError = new Error(result.error?.message || 'Request failed');
      requestError.status = response.status;
      requestError.code = result.error?.code;
      requestError.fields = result.error?.fields;
      requestError.response = { data: result, status: response.status };
      if (!config.silent) {
        emitRequestFeedback('schoolbase:request-error', { method: config.method, path, message: requestError.message, status: response.status });
      }
      throw requestError;
    }

    // Refresh last-active and clear expiration flag on success
    sessionStorage.removeItem('schoolbase_license_expired');
    touchLastActive();
    if (config.method !== 'GET' && !config.silent) {
      emitRequestFeedback('schoolbase:request-success', {
        method: config.method,
        path,
        message: result.data?.message || result.message || (result.data?.queued ? 'Saved offline and queued for synchronization.' : requestLabel(config.method)),
      });
    }
    return result;
  } catch (error) {
    const isOfflineWrite = !navigator.onLine && ['POST', 'PUT', 'PATCH'].includes(config.method) &&
      /attendance|marks/i.test(path);
    if (isOfflineWrite) {
      try {
        await enqueueWrite({ path, method: config.method, body: config.body, headers });
        if (!config.silent) {
          emitRequestFeedback('schoolbase:request-success', { method: config.method, path, message: 'Saved offline and queued for synchronization.' });
        }
        return { data: { queued: true, message: 'Saved offline and queued for synchronization.' } };
      } catch (_) {}
    }
    if (!error.status && !config.silent) {
      emitRequestFeedback('schoolbase:request-error', { method: config.method, path, message: error.message || 'Network request failed.' });
    }
    console.error(`API Error on ${path}:`, error);
    throw error;
  }
}

export const api = {
  get:          (path, options)       => request(path, { ...options, method: 'GET' }),
  post:         (path, body, options) => request(path, { ...options, method: 'POST',   body: JSON.stringify(body) }),
  put:          (path, body, options) => request(path, { ...options, method: 'PUT',    body: JSON.stringify(body) }),
  patch:        (path, body, options) => request(path, { ...options, method: 'PATCH',  body: JSON.stringify(body) }),
  delete:       (path, options)       => request(path, { ...options, method: 'DELETE' }),
  downloadFile: async (path, defaultFilename = 'export.csv') => {
    const token = getToken();
    const headers = {};
    const activeSchoolId = sessionStorage.getItem('schoolbase_active_school_id');
    if (activeSchoolId) {
      headers['X-Active-School-Id'] = activeSchoolId;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${path}`, { method: 'GET', headers });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('schoolbase_token');
          sessionStorage.removeItem('schoolbase_user');
          sessionStorage.removeItem('schoolbase_active_school_id');
          sessionStorage.removeItem('schoolbase_last_active');
          window.location.replace('/login?expired=1');
        }
        throw new Error('Download failed: ' + response.statusText);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      touchLastActive();
    } catch (error) {
      console.error(`File Download Error on ${path}:`, error);
      throw error;
    }
  }
};

export async function syncOfflineWrites() {
  await flushWrites(async ({ path, method, body, headers }) => {
    const response = await fetch(`${API_URL}${path}`, { method, body, headers });
    if (!response.ok) {
      let result = {};
      try { result = await response.json(); } catch (_) {}
      const error = new Error(result.error?.message || `Offline sync failed: ${response.status}`);
      error.status = response.status;
      error.code = result.error?.code;
      error.fields = result.error?.fields;
      throw error;
    }
  });
}
