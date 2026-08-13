/* ==========================================================================
   BINGO MASTER - USER AUTHENTICATION & TROPHY SYSTEM MANAGER
   ========================================================================== */

const AUTH_STORAGE_KEY = 'bingo_master_user_auth_v1';

export class AuthManager {
  constructor() {
    this.currentUser = this.loadSavedUser();
    this.socket = null;
    this.currentMode = 'login'; // 'login' or 'register'
    this.regStep = 1; // 1: Username, 2: Password
  }

  isLoggedIn() {
    return !!(this.currentUser && this.currentUser.username);
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
      if (this.currentUser) {
        this.socket.emit('user_online', {
          username: this.currentUser.username,
          playerId: this.currentUser.playerId
        });
      }

      this.socket.on('connect', () => {
        if (this.currentUser) {
          this.socket.emit('user_online', {
            username: this.currentUser.username,
            playerId: this.currentUser.playerId
          });
        }
      });

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

  getPlayerId() {
    return this.currentUser ? (this.currentUser.playerId || '000000') : '000000';
  }

  async login(username, password) {
    const cleanUser = (username || '').trim();
    if (!cleanUser) {
      return { success: false, error: 'Please enter your username!' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password!' };
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        this.saveUser(data.user);
        if (this.socket && this.socket.connected) {
          this.socket.emit('user_online', {
            username: data.user.username,
            playerId: data.user.playerId
          });
        }
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Invalid username or password!' };
      }
    } catch (e) {
      console.error('Login request failed:', e);
      return { success: false, error: 'Could not connect to backend server.' };
    }
  }

  async register(username, password) {
    const cleanUser = (username || '').trim();
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, error: 'Username must be at least 2 characters long!' };
    }
    if (!password || password.length < 3) {
      return { success: false, error: 'Password must be at least 3 characters long!' };
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        this.saveUser(data.user);
        if (this.socket && this.socket.connected) {
          this.socket.emit('user_online', {
            username: data.user.username,
            playerId: data.user.playerId
          });
        }
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Registration failed!' };
      }
    } catch (e) {
      console.error('Register request failed:', e);
      return { success: false, error: 'Could not connect to backend server.' };
    }
  }

  logout() {
    this.saveUser(null);
    this.updateHeaderProfileUI();
  }

  updateHeaderProfileUI() {
    const nameEl = document.getElementById('header-user-name');
    const trophiesEl = document.getElementById('header-user-trophies');
    const avatarEl = document.getElementById('header-user-avatar');

    if (this.isLoggedIn()) {
      if (nameEl) {
        nameEl.textContent = this.currentUser.username;
        nameEl.title = this.currentUser.username;
      }
      if (trophiesEl) trophiesEl.textContent = `🏆 ${this.currentUser.trophies || 100}`;
      if (avatarEl) avatarEl.textContent = '👑';
    } else {
      if (nameEl) {
        nameEl.textContent = 'Login';
        nameEl.title = 'Click to login or create account';
      }
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

  async updateTrophies(delta, modeName = '5x5 Battle') {
    if (!this.currentUser) return;
    const username = this.currentUser.username;

    // Local optimistic update
    this.currentUser.trophies = Math.max(0, (this.currentUser.trophies || 100) + delta);
    if (!this.currentUser.matchHistory) this.currentUser.matchHistory = [];
    this.currentUser.matchHistory.unshift({
      mode: modeName,
      result: delta >= 0 ? 'WIN' : 'LOSS',
      delta,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (this.currentUser.matchHistory.length > 10) {
      this.currentUser.matchHistory = this.currentUser.matchHistory.slice(0, 10);
    }
    this.saveUser(this.currentUser);

    // Show trophy animation floating text
    this.showTrophyToast(delta);

    // Sync with server
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_trophies', { username, delta, modeName });
    } else {
      try {
        await fetch('/api/trophies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, delta, modeName })
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

  openProfileModal(statsManager) {
    const profileModal = document.getElementById('modal-player-profile');
    if (!profileModal || !this.currentUser) return;

    const displayUsername = document.getElementById('profile-display-username');
    const displayPlayerId = document.getElementById('profile-display-id');
    const displayTrophies = document.getElementById('profile-display-trophies');
    const statMatches = document.getElementById('profile-stat-matches');
    const statWins = document.getElementById('profile-stat-wins');
    const statLosses = document.getElementById('profile-stat-losses');
    const statWinrate = document.getElementById('profile-stat-winrate');
    const btnCopyPlayerId = document.getElementById('btn-copy-player-id');
    const historyContainer = document.getElementById('profile-match-history-list');

    if (displayUsername) displayUsername.textContent = this.currentUser.username;
    if (displayPlayerId) displayPlayerId.textContent = `#${this.getPlayerId()}`;
    if (displayTrophies) displayTrophies.textContent = this.currentUser.trophies || 100;

    if (btnCopyPlayerId) {
      btnCopyPlayerId.onclick = () => {
        const idStr = this.getPlayerId();
        navigator.clipboard.writeText(idStr).then(() => {
          alert(`📋 Player ID #${idStr} copied to clipboard! Share with friends.`);
        });
      };
    }

    const wins = this.currentUser.wins || (statsManager ? statsManager.data.victories : 0);
    const losses = this.currentUser.losses || (statsManager ? (statsManager.data.totalGames - statsManager.data.victories) : 0);
    const total = wins + losses;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

    if (statMatches) statMatches.textContent = total;
    if (statWins) statWins.textContent = wins;
    if (statLosses) statLosses.textContent = Math.max(0, losses);
    if (statWinrate) statWinrate.textContent = `${winrate}%`;

    // Render Recent Match History
    if (historyContainer) {
      const history = this.currentUser.matchHistory || [];
      if (history.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state-badge">📜 No recent matches played yet. Play a game to record history!</div>`;
      } else {
        historyContainer.innerHTML = history.map(item => `
          <div class="history-item-row ${item.result.toLowerCase()}">
            <span class="h-badge">${item.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'}</span>
            <span class="h-mode">${item.mode || '5x5 Battle'}</span>
            <span class="h-delta">${item.delta >= 0 ? '+' + item.delta : item.delta} 🏆</span>
            <span class="h-time">${item.time || ''}</span>
          </div>
        `).join('');
      }
    }

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
    const submitBtn = document.getElementById('btn-auth-submit');
    const regNextBtn = document.getElementById('btn-reg-next');
    const regStepsBar = document.getElementById('reg-steps-bar');
    const regStep1Chip = document.getElementById('reg-step-1-chip');
    const regStep2Chip = document.getElementById('reg-step-2-chip');
    
    const groupUsername = document.getElementById('group-auth-username');
    const groupPassword = document.getElementById('group-auth-password');
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error-msg');
    const successMsg = document.getElementById('auth-success-msg');

    this.updateHeaderProfileUI();

    // Show Login/Register button listener
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        if (this.isLoggedIn()) {
          this.openProfileModal(statsManager);
        } else {
          setMode('login');
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

    const updateRegisterStepView = (step) => {
      this.regStep = step;
      if (errorMsg) errorMsg.classList.add('hidden');
      if (successMsg) successMsg.classList.add('hidden');

      if (step === 1) {
        if (groupUsername) groupUsername.classList.remove('hidden');
        if (groupPassword) groupPassword.classList.add('hidden');
        if (regNextBtn) regNextBtn.classList.remove('hidden');
        if (submitBtn) submitBtn.classList.add('hidden');
        if (regStep1Chip) regStep1Chip.className = 'reg-step-chip active';
        if (regStep2Chip) regStep2Chip.className = 'reg-step-chip';
        if (usernameInput) usernameInput.focus();
      } else {
        if (groupUsername) groupUsername.classList.remove('hidden');
        if (groupPassword) groupPassword.classList.remove('hidden');
        if (regNextBtn) regNextBtn.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
        if (regStep1Chip) regStep1Chip.className = 'reg-step-chip';
        if (regStep2Chip) regStep2Chip.className = 'reg-step-chip active';
        if (passwordInput) passwordInput.focus();
      }
    };

    const setMode = (mode) => {
      this.currentMode = mode;
      if (errorMsg) errorMsg.classList.add('hidden');
      if (successMsg) successMsg.classList.add('hidden');

      if (mode === 'login') {
        tabLogin?.classList.add('active');
        tabRegister?.classList.remove('active');
        if (modalTitle) modalTitle.textContent = 'Player Login';
        if (submitBtnText) submitBtnText.textContent = 'Login Now 🚀';
        if (regStepsBar) regStepsBar.classList.add('hidden');
        if (groupUsername) groupUsername.classList.remove('hidden');
        if (groupPassword) groupPassword.classList.remove('hidden');
        if (regNextBtn) regNextBtn.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
      } else {
        tabRegister?.classList.add('active');
        tabLogin?.classList.remove('active');
        if (modalTitle) modalTitle.textContent = 'Register New Account';
        if (submitBtnText) submitBtnText.textContent = 'Done: Register (+100 🏆) 🎁';
        if (regStepsBar) regStepsBar.classList.remove('hidden');
        updateRegisterStepView(1);
      }
    };

    tabLogin?.addEventListener('click', () => setMode('login'));
    tabRegister?.addEventListener('click', () => setMode('register'));

    // Step 1 Next Button Handler
    if (regNextBtn) {
      regNextBtn.addEventListener('click', () => {
        const username = (usernameInput?.value || '').trim();
        if (!username || username.length < 2) {
          if (errorMsg) {
            errorMsg.textContent = '⚠️ Please enter a valid Player ID / Username (at least 2 chars)!';
            errorMsg.classList.remove('hidden');
          }
          return;
        }
        updateRegisterStepView(2);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = (usernameInput?.value || '').trim();
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
          // If in registration mode and on step 1, advance to step 2 first
          if (this.regStep === 1) {
            if (!username || username.length < 2) {
              if (errorMsg) {
                errorMsg.textContent = '⚠️ Please enter a valid Player ID / Username!';
                errorMsg.classList.remove('hidden');
              }
              return;
            }
            updateRegisterStepView(2);
            return;
          }

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
