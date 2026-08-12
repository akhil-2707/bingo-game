/* ==========================================================================
   BINGO MASTER - USER AUTHENTICATION & TROPHY SYSTEM MANAGER
   ========================================================================== */

const AUTH_STORAGE_KEY = 'bingo_master_user_auth_v1';

export class AuthManager {
  constructor() {
    this.currentUser = this.loadSavedUser();
    this.socket = null;
    this.currentMode = 'login'; // 'login' or 'register'
  }

  loadSavedUser() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved auth user', e);
    }
    return null;
  }

  saveUser(user) {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save auth user', e);
    }
    this.updateHeaderProfileUI();
  }

  setSocket(socket) {
    this.socket = socket;
    if (this.socket) {
      this.socket.on('trophies_updated', (updatedUser) => {
        if (this.currentUser && updatedUser.username.toLowerCase() === this.currentUser.username.toLowerCase()) {
          this.currentUser.trophies = updatedUser.trophies;
          this.currentUser.wins = updatedUser.wins;
          this.currentUser.losses = updatedUser.losses;
          this.saveUser(this.currentUser);
        }
      });
    }
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  getUsername() {
    return this.currentUser ? this.currentUser.username : 'Guest';
  }

  getTrophies() {
    return this.currentUser ? (this.currentUser.trophies || 100) : 100;
  }

  async register(username, password) {
    // Try Socket first if connected
    if (this.socket && this.socket.connected) {
      return new Promise((resolve) => {
        this.socket.emit('auth_register', { username, password }, (res) => {
          if (res && res.success) {
            this.saveUser(res.user);
          }
          resolve(res);
        });
      });
    }

    // REST fallback
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) {
        this.saveUser(data.user);
      }
      return data;
    } catch (err) {
      return { success: false, error: 'Network error connecting to server' };
    }
  }

  async login(username, password) {
    if (this.socket && this.socket.connected) {
      return new Promise((resolve) => {
        this.socket.emit('auth_login', { username, password }, (res) => {
          if (res && res.success) {
            this.saveUser(res.user);
          }
          resolve(res);
        });
      });
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) {
        this.saveUser(data.user);
      }
      return data;
    } catch (err) {
      return { success: false, error: 'Network error connecting to server' };
    }
  }

  async updateTrophies(delta, matchType = '') {
    if (!this.currentUser) return;
    const username = this.currentUser.username;

    // Local optimistic update
    this.currentUser.trophies = Math.max(0, (this.currentUser.trophies || 100) + delta);
    this.saveUser(this.currentUser);

    // Show trophy animation floating text
    this.showTrophyToast(delta);

    // Sync with server
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_trophies', { username, delta });
    } else {
      try {
        await fetch('/api/trophies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, delta })
        });
      } catch (e) {}
    }
  }

  showTrophyToast(delta) {
    const isPositive = delta >= 0;
    const toast = document.createElement('div');
    toast.className = `trophy-toast ${isPositive ? 'gain' : 'loss'}`;
    toast.innerHTML = `${isPositive ? '+' + delta : delta} 🏆`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-out');
      setTimeout(() => toast.remove(), 600);
    }, 1800);
  }

  logout() {
    this.saveUser(null);
    this.updateHeaderProfileUI();
  }

  updateHeaderProfileUI() {
    const nameEl = document.getElementById('header-user-name');
    const trophiesEl = document.getElementById('header-user-trophies');
    const avatarEl = document.getElementById('header-user-avatar');

    if (this.currentUser) {
      if (nameEl) nameEl.textContent = this.currentUser.username;
      if (trophiesEl) trophiesEl.textContent = `🏆 ${this.currentUser.trophies || 100}`;
      if (avatarEl) avatarEl.textContent = '👑';
    } else {
      if (nameEl) nameEl.textContent = 'Login';
      if (trophiesEl) trophiesEl.textContent = '🏆 100';
      if (avatarEl) avatarEl.textContent = '👤';
    }
  }

  promptLoginIfGuest() {
    if (!this.isLoggedIn()) {
      const authModal = document.getElementById('modal-auth');
      if (authModal) {
        authModal.classList.remove('hidden');
      }
      return false;
    }
    return true;
  }

  openProfileModal(statsManager) {
    const profileModal = document.getElementById('modal-player-profile');
    if (!profileModal || !this.currentUser) return;

    const displayUsername = document.getElementById('profile-display-username');
    const displayTrophies = document.getElementById('profile-display-trophies');
    const statMatches = document.getElementById('profile-stat-matches');
    const statWins = document.getElementById('profile-stat-wins');
    const statLosses = document.getElementById('profile-stat-losses');
    const statWinrate = document.getElementById('profile-stat-winrate');

    if (displayUsername) displayUsername.textContent = this.currentUser.username;
    if (displayTrophies) displayTrophies.textContent = this.currentUser.trophies || 100;

    const wins = this.currentUser.wins || (statsManager ? statsManager.data.victories : 0);
    const losses = this.currentUser.losses || (statsManager ? (statsManager.data.totalGames - statsManager.data.victories) : 0);
    const total = wins + losses;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

    if (statMatches) statMatches.textContent = total;
    if (statWins) statWins.textContent = wins;
    if (statLosses) statLosses.textContent = Math.max(0, losses);
    if (statWinrate) statWinrate.textContent = `${winrate}%`;

    profileModal.classList.remove('hidden');
  }

  initUI(statsManager) {
    const authBtn = document.getElementById('btn-user-auth');
    const authModal = document.getElementById('modal-auth');
    const closeBtn = document.getElementById('btn-close-auth-modal');
    const profileModal = document.getElementById('modal-player-profile');
    const closeProfileBtn = document.getElementById('btn-close-profile-modal');
    const logoutBtn = document.getElementById('btn-profile-logout');

    const form = document.getElementById('form-auth');
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const modalTitle = document.getElementById('auth-modal-title');
    const submitBtnText = document.getElementById('btn-auth-text');
    const errorMsg = document.getElementById('auth-error-msg');
    const successMsg = document.getElementById('auth-success-msg');

    this.updateHeaderProfileUI();

    if (authBtn) {
      authBtn.addEventListener('click', () => {
        if (this.isLoggedIn()) {
          this.openProfileModal(statsManager);
        } else {
          authModal?.classList.remove('hidden');
        }
      });
    }

    if (closeBtn && authModal) {
      closeBtn.addEventListener('click', () => {
        authModal.classList.add('hidden');
      });
    }

    if (closeProfileBtn && profileModal) {
      closeProfileBtn.addEventListener('click', () => {
        profileModal.classList.add('hidden');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out of your account?')) {
          this.logout();
          profileModal?.classList.add('hidden');
        }
      });
    }

    const setMode = (mode) => {
      this.currentMode = mode;
      if (errorMsg) errorMsg.classList.add('hidden');
      if (successMsg) successMsg.classList.add('hidden');

      if (mode === 'login') {
        tabLogin?.classList.add('active');
        tabRegister?.classList.remove('active');
        if (modalTitle) modalTitle.textContent = 'Player Login';
        if (submitBtnText) submitBtnText.textContent = 'Login Now 🚀';
      } else {
        tabRegister?.classList.add('active');
        tabLogin?.classList.remove('active');
        if (modalTitle) modalTitle.textContent = 'Register New Account';
        if (submitBtnText) submitBtnText.textContent = 'Register (+100 🏆) 🎁';
      }
    };

    tabLogin?.addEventListener('click', () => setMode('login'));
    tabRegister?.addEventListener('click', () => setMode('register'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('auth-username');
        const passwordInput = document.getElementById('auth-password');
        const username = usernameInput?.value || '';
        const password = passwordInput?.value || '';

        if (errorMsg) errorMsg.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');

        if (this.currentMode === 'login') {
          const res = await this.login(username, password);
          if (res && res.success) {
            if (successMsg) {
              successMsg.textContent = `Welcome back, ${res.user.username}! 🏆 Trophies: ${res.user.trophies}`;
              successMsg.classList.remove('hidden');
            }
            setTimeout(() => {
              authModal?.classList.add('hidden');
            }, 1000);
          } else {
            if (errorMsg) {
              errorMsg.textContent = res.error || 'Login failed!';
              errorMsg.classList.remove('hidden');
            }
          }
        } else {
          const res = await this.register(username, password);
          if (res && res.success) {
            if (successMsg) {
              successMsg.textContent = `Account created! 🎉 You received 100 Welcome Trophies 🏆!`;
              successMsg.classList.remove('hidden');
            }
            setTimeout(() => {
              authModal?.classList.add('hidden');
            }, 1200);
          } else {
            if (errorMsg) {
              errorMsg.textContent = res.error || 'Registration failed!';
              errorMsg.classList.remove('hidden');
            }
          }
        }
      });
    }
  }
}

export const authManager = new AuthManager();
