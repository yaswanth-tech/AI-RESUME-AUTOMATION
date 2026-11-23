const API_BASE = '/api';

class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'SessionExpiredError';
  }
}

let sessionRedirectStarted = false;

const UserContext = {
  sessionCheckPromise: null,

  getToken() {
    return localStorage.getItem('ascend_token') || '';
  },

  setAuth(user, token) {
    if (user) localStorage.setItem('ascend_user', JSON.stringify(user));
    if (token) localStorage.setItem('ascend_token', token);
  },

  logout() {
    this.clearSession();
    window.location.href = 'home.html';
  },

  clearSession() {
    localStorage.removeItem('ascend_user');
    localStorage.removeItem('ascend_token');
    localStorage.removeItem('ATS_DATA');
  },

  isSessionExpired(error) {
    return error?.name === 'SessionExpiredError';
  },

  redirectAfterUnauthorized(hadToken) {
    this.clearSession();
    if (sessionRedirectStarted) return;
    sessionRedirectStarted = true;
    window.location.replace(hadToken ? 'index.html?session=expired' : 'index.html');
  },

  getUser() {
    try {
      const cached = localStorage.getItem('ascend_user');
      return cached ? JSON.parse(cached) : { name: 'Student' };
    } catch (e) {
      return { name: 'Student' };
    }
  },

  getUserId() {
    const user = this.getUser();
    return user.id || '';
  },

  async fetchUser() {
    const token = this.getToken();
    if (!token) {
      this.clearSession();
      return null;
    }
    if (this.sessionCheckPromise) return this.sessionCheckPromise;

    this.sessionCheckPromise = (async () => {
      try {
        const response = await this.fetchWithAuth(`${API_BASE}/auth/me`);
        if (!response.ok) {
          throw new Error(`Session validation failed with status ${response.status}.`);
        }
        const data = await response.json();
        if (!data.success || !data.user) {
          throw new Error('Session validation returned no authenticated user.');
        }
        localStorage.setItem('ascend_user', JSON.stringify(data.user));
        return data.user;
      } catch (error) {
        if (!this.isSessionExpired(error)) console.error('Unable to validate the current session:', error);
        throw error;
      } finally {
        this.sessionCheckPromise = null;
      }
    })();

    return this.sessionCheckPromise;
  },

  async fetchWithAuth(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = this.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      this.redirectAfterUnauthorized(Boolean(token));
      throw new SessionExpiredError();
    }
    return response;
  },

  async downloadWithAuth(url, filename) {
    const response = await this.fetchWithAuth(url);
    if (!response.ok) throw new Error('The file could not be downloaded. Please sign in again and retry.');
    const disposition = response.headers.get('Content-Disposition') || '';
    const serverFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || serverFilename || 'ascend-download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  },

  async injectUserIdentity() {
    const user = await this.fetchUser();
    if (!user) return null;
    document.querySelectorAll('.user-name-display, .user-name').forEach(el => {
      el.textContent = user.name || 'Student';
    });
    return user;
  }
};

// Auto-run on DOM load
document.addEventListener('DOMContentLoaded', () => {
  UserContext.injectUserIdentity().catch(error => {
    if (!UserContext.isSessionExpired(error)) console.error('Unable to load current user identity:', error);
  });
});
