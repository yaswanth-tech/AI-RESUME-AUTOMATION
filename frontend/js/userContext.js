const API_BASE = '/api';

const UserContext = {
  getToken() {
    return localStorage.getItem('ascend_token') || '';
  },

  setAuth(user, token) {
    if (user) localStorage.setItem('ascend_user', JSON.stringify(user));
    if (token) localStorage.setItem('ascend_token', token);
  },

  logout() {
    localStorage.removeItem('ascend_user');
    localStorage.removeItem('ascend_token');
    localStorage.removeItem('ATS_DATA');
    window.location.href = 'home.html';
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
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('ascend_user', JSON.stringify(data.user));
          return data.user;
        }
      } catch (e) {
        console.warn("Auth token check failed, using cached user:", e.message);
      }
    }
    return token ? this.getUser() : null;
  },

  async fetchWithAuth(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
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
    document.querySelectorAll('.user-name-display, .user-name').forEach(el => {
      el.textContent = user.name || 'Student';
    });
    return user;
  }
};

// Auto-run on DOM load
document.addEventListener('DOMContentLoaded', () => {
  UserContext.injectUserIdentity();
});
