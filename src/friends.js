/* ==========================================================================
   BINGO MASTER - FRIENDS & IN-GAME ROOM INVITE SYSTEM
   ========================================================================== */

import { sound } from './audio.js';

export class FriendsManager {
  constructor(authManager, multiplayerManager) {
    this.auth = authManager;
    this.mp = multiplayerManager;
    this.friendsList = [];
    this.searchResults = null;
  }

  init() {
    this.bindEvents();
    this.listenForInvites();
  }

  bindEvents() {
    const btnOpenFriends = document.getElementById('btn-open-friends');
    const modalFriends = document.getElementById('modal-friends');
    const btnCloseFriends = document.getElementById('btn-close-friends-modal');
    const formSearch = document.getElementById('form-search-player');
    const searchInput = document.getElementById('input-search-player');

    const tabMyFriends = document.getElementById('tab-friends-list');
    const tabSearchPlayers = document.getElementById('tab-friends-search');
    const panelMyFriends = document.getElementById('panel-friends-list');
    const panelSearchPlayers = document.getElementById('panel-friends-search');

    if (btnOpenFriends) {
      btnOpenFriends.addEventListener('click', () => {
        if (!this.auth.isLoggedIn()) {
          this.auth.promptLoginIfGuest();
          return;
        }
        modalFriends?.classList.remove('hidden');
        this.fetchAndRenderFriends();
      });
    }

    if (btnCloseFriends && modalFriends) {
      btnCloseFriends.addEventListener('click', () => {
        modalFriends.classList.add('hidden');
      });
    }

    if (tabMyFriends && tabSearchPlayers) {
      tabMyFriends.addEventListener('click', () => {
        tabMyFriends.classList.add('active');
        tabSearchPlayers.classList.remove('active');
        panelMyFriends?.classList.remove('hidden');
        panelSearchPlayers?.classList.add('hidden');
        this.fetchAndRenderFriends();
      });

      tabSearchPlayers.addEventListener('click', () => {
        tabSearchPlayers.classList.add('active');
        tabMyFriends.classList.remove('active');
        panelSearchPlayers?.classList.remove('hidden');
        panelMyFriends?.classList.add('hidden');
      });
    }

    if (formSearch) {
      formSearch.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput?.value || '';
        this.searchPlayer(query);
      });
    }

    // Lobby Invite Friends Button
    const btnLobbyInvite = document.getElementById('btn-lobby-invite-friends');
    const drawerInvite = document.getElementById('drawer-lobby-invite');
    const btnCloseInviteDrawer = document.getElementById('btn-close-invite-drawer');

    if (btnLobbyInvite && drawerInvite) {
      btnLobbyInvite.addEventListener('click', () => {
        if (!this.auth.isLoggedIn()) {
          this.auth.promptLoginIfGuest();
          return;
        }
        drawerInvite.classList.remove('hidden');
        this.renderLobbyInviteDrawer();
      });
    }

    if (btnCloseInviteDrawer && drawerInvite) {
      btnCloseInviteDrawer.addEventListener('click', () => {
        drawerInvite.classList.add('hidden');
      });
    }
  }

  searchPlayer(query) {
    const searchStatus = document.getElementById('search-status-msg');
    const searchResultsContainer = document.getElementById('search-results-container');

    if (searchStatus) {
      searchStatus.textContent = '🔍 Searching player database...';
      searchStatus.classList.remove('hidden');
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('search_player', { query }, (res) => {
        if (searchStatus) searchStatus.classList.add('hidden');

        if (res && res.success && res.player) {
          this.renderSearchResultCard(res.player, searchResultsContainer);
        } else {
          if (searchResultsContainer) {
            searchResultsContainer.innerHTML = `
              <div class="empty-state-badge error">
                ⚠️ ${res?.error || 'No player found with that Username or ID!'}
              </div>
            `;
          }
        }
      });
    } else {
      if (searchStatus) searchStatus.textContent = '❌ Multiplayer socket offline. Please check internet connection.';
    }
  }

  renderSearchResultCard(player, container) {
    if (!container) return;

    const myFriends = this.auth.currentUser?.friends || [];
    const isAlreadyFriend = myFriends.includes(player.playerId);
    const isSelf = this.auth.currentUser?.username.toLowerCase() === player.username.toLowerCase();

    container.innerHTML = `
      <div class="player-card glass-card">
        <div class="p-card-left">
          <div class="p-card-avatar">👤</div>
          <div class="p-card-info">
            <div class="p-card-name">
              ${player.username}
              <span class="p-card-id">#${player.playerId}</span>
            </div>
            <div class="p-card-stats">
              <span>🏆 ${player.trophies} Trophies</span>
              <span class="status-indicator ${player.isOnline ? 'online' : 'offline'}">
                ${player.isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
          </div>
        </div>
        <div class="p-card-right">
          ${isSelf ? '<span class="badge-chip">You</span>' : isAlreadyFriend ? '<span class="badge-chip mint">✓ Friend</span>' : `
            <button class="app-btn btn-primary btn-sm btn-add-friend" data-id="${player.playerId}" data-name="${player.username}">
              ➕ Add Friend
            </button>
          `}
        </div>
      </div>
    `;

    const addBtn = container.querySelector('.btn-add-friend');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addFriend(player.playerId, player.username, addBtn);
      });
    }
  }

  addFriend(targetPlayerId, targetUsername, btnEl) {
    if (!this.auth.currentUser) return;
    const username = this.auth.currentUser.username;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('add_friend', { username, friendPlayerId: targetPlayerId }, (res) => {
        if (res && res.success) {
          this.auth.currentUser.friends = res.friends;
          this.auth.saveUser(this.auth.currentUser);
          if (btnEl) {
            btnEl.textContent = '✓ Friend Added';
            btnEl.disabled = true;
            btnEl.style.opacity = '0.7';
          }
          sound.playPop();
          this.fetchAndRenderFriends();
        }
      });
    }
  }

  fetchAndRenderFriends() {
    const friendsGrid = document.getElementById('my-friends-grid');
    const myFriendsIds = this.auth.currentUser?.friends || [];

    if (!friendsGrid) return;

    if (myFriendsIds.length === 0) {
      friendsGrid.innerHTML = `
        <div class="empty-state-badge">
          👥 You haven't added any friends yet!<br>Use the <strong>"Search Players"</strong> tab to find friends by 6-Digit ID or Username.
        </div>
      `;
      return;
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('get_friends_list', { username: this.auth.currentUser.username, friendIds: myFriendsIds }, (res) => {
        if (res && res.success && res.friends) {
          this.friendsList = res.friends;
          this.renderFriendsListGrid(res.friends, friendsGrid);
        }
      });
    }
  }

  renderFriendsListGrid(friends, container) {
    if (!container) return;

    if (friends.length === 0) {
      container.innerHTML = `<div class="empty-state-badge">👥 No friends found.</div>`;
      return;
    }

    container.innerHTML = friends.map(f => `
      <div class="friend-card glass-card">
        <div class="f-info">
          <span class="f-avatar">👤</span>
          <div class="f-name-group">
            <span class="f-name">${f.username}</span>
            <span class="f-id">ID: #${f.playerId} | 🏆 ${f.trophies}</span>
          </div>
        </div>
        <div class="f-status-pill ${f.isOnline ? 'online' : 'offline'}">
          ${f.isOnline ? '🟢 Online' : '🔴 Offline'}
        </div>
      </div>
    `).join('');
  }

  renderLobbyInviteDrawer() {
    const container = document.getElementById('lobby-friends-invite-list');
    const myFriendsIds = this.auth.currentUser?.friends || [];

    if (!container) return;

    if (myFriendsIds.length === 0) {
      container.innerHTML = `
        <div class="empty-state-badge">
          👥 No friends added yet. Go to Profile > Friends to add friends!
        </div>
      `;
      return;
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('get_friends_list', { username: this.auth.currentUser.username, friendIds: myFriendsIds }, (res) => {
        if (res && res.success && res.friends) {
          const onlineFriends = res.friends.filter(f => f.isOnline);
          if (onlineFriends.length === 0) {
            container.innerHTML = `
              <div class="empty-state-badge">
                🔴 All your friends are currently offline. Tell them to log in to Bingo Master!
              </div>
            `;
            return;
          }

          container.innerHTML = onlineFriends.map(f => `
            <div class="invite-friend-row">
              <div class="f-details">
                <span class="f-name">${f.username}</span>
                <span class="f-badge">🏆 ${f.trophies}</span>
              </div>
              <button class="app-btn btn-primary btn-sm btn-send-invite" data-name="${f.username}">
                📩 Invite
              </button>
            </div>
          `).join('');

          container.querySelectorAll('.btn-send-invite').forEach(btn => {
            btn.addEventListener('click', () => {
              const targetName = btn.dataset.name;
              this.sendInviteToFriend(targetName, btn);
            });
          });
        }
      });
    }
  }

  sendInviteToFriend(targetUsername, btnEl) {
    if (!this.mp.roomCode) return;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('send_room_invite', {
        fromUsername: this.auth.getUsername(),
        targetUsername,
        roomCode: this.mp.roomCode,
        mode: this.mp.selectedMode
      }, (res) => {
        if (res && res.success) {
          if (btnEl) {
            btnEl.textContent = '✓ Sent!';
            btnEl.disabled = true;
          }
          sound.playPop();
        } else {
          alert(res?.error || 'Could not send invite.');
        }
      });
    }
  }

  listenForInvites() {
    if (!this.mp.socket) return;

    this.mp.socket.on('room_invite_received', ({ fromUsername, roomCode, mode }) => {
      sound.playTrophy();
      this.showIncomingInviteToast(fromUsername, roomCode, mode);
    });
  }

  showIncomingInviteToast(fromUsername, roomCode, mode) {
    let toast = document.getElementById('toast-room-invite');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-room-invite';
      toast.className = 'room-invite-toast-overlay';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div class="invite-banner-card glass-card">
        <div class="invite-banner-header">
          <span class="invite-icon">📩</span>
          <div class="invite-title-text">
            <strong>${fromUsername}</strong> invited you to play!
          </div>
        </div>
        <div class="invite-details">
          <span>🎮 Mode: ${mode || '5x5 Battle'}</span>
          <span>🔑 Key: <strong>${roomCode}</strong></span>
        </div>
        <div class="invite-actions">
          <button id="btn-accept-invite" class="app-btn btn-primary btn-sm pulse-glow">
            🚀 Accept & Join
          </button>
          <button id="btn-decline-invite" class="btn-text danger-text btn-sm">
            Decline
          </button>
        </div>
      </div>
    `;

    toast.classList.remove('hidden');

    const btnAccept = toast.querySelector('#btn-accept-invite');
    const btnDecline = toast.querySelector('#btn-decline-invite');

    btnAccept?.addEventListener('click', () => {
      toast.classList.add('hidden');
      if (this.mp) {
        this.mp.joinRoom(roomCode, this.auth.getUsername());
      }
    });

    btnDecline?.addEventListener('click', () => {
      toast.classList.add('hidden');
    });
  }
}
