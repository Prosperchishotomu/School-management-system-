const API_URL = import.meta.env.VITE_API_URL || 'http://localhost/backend/api/v1';

// All tokens stored in sessionStorage — dies when tab/browser closes
const getToken = () => sessionStorage.getItem('schoolbase_token');

// Update last-active timestamp on every successful API call
const touchLastActive = () => {
  sessionStorage.setItem('schoolbase_last_active', Date.now().toString());
};

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const activeSchoolId = sessionStorage.getItem('schoolbase_active_school_id');
  if (activeSchoolId) {
    headers['X-Active-School-Id'] = activeSchoolId;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${path}`, config);

    // For 204 No Content
    if (response.status === 204) {
      touchLastActive();
      return { data: null };
    }

    const result = await response.json();

    if (!response.ok) {
      // Auto-logout on 401 — session expired or invalid token
      if (response.status === 401) {
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
      throw new Error(result.error?.message || 'Request failed');
    }

    // Refresh last-active and clear expiration flag on success
    sessionStorage.removeItem('schoolbase_license_expired');
    touchLastActive();
    return result;
  } catch (error) {
    console.error(`API Error on ${path}:`, error);
    throw error;
  }
}

export const api = {
  get:    (path, options)       => request(path, { ...options, method: 'GET' }),
  post:   (path, body, options) => request(path, { ...options, method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body, options) => request(path, { ...options, method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body, options) => request(path, { ...options, method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path, options)       => request(path, { ...options, method: 'DELETE' }),
};
