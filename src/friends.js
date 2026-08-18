/* ==========================================================================
   BINGO MASTER - COMPLETE PRODUCTION SOCIAL & FRIENDS SYSTEM
   ========================================================================== */

import { sound } from './audio.js';

export class FriendsManager {
  constructor(authManager, multiplayerManager) {
    this.auth = authManager;
    this.mp = multiplayerManager;
    this.friendsList = [];
    this.pendingRequests = [];
    this.searchResults = null;
    this.selectedAvatar = '👤';
  }

  init() {
    this.bindEvents();
    this.listenForSocketEvents();
    this.checkPendingRequestsCount();
  }

  bindEvents() {
    const btnOpenFriends = document.getElementById('btn-open-friends');
    const modalFriends = document.getElementById('modal-friends');
    const btnCloseFriends = document.getElementById('btn-close-friends-modal');
    const formSearch = document.getElementById('form-search-player');
    const searchInput = document.getElementById('input-search-player');

    const tabMyFriends = document.getElementById('tab-friends-list');
    const tabRequests = document.getElementById('tab-friends-requests');
    const tabSearchPlayers = document.getElementById('tab-friends-search');

    const panelMyFriends = document.getElementById('panel-friends-list');
    const panelRequests = document.getElementById('panel-friends-requests');
    const panelSearchPlayers = document.getElementById('panel-friends-search');

    // Open Friends Modal
    if (btnOpenFriends) {
      btnOpenFriends.addEventListener('click', () => {
        if (!this.auth.isLoggedIn()) {
          this.auth.promptLoginIfGuest();
          return;
        }
        modalFriends?.classList.remove('hidden');
        this.fetchAndRenderFriends();
        this.fetchAndRenderRequests();
      });
    }

    if (btnCloseFriends && modalFriends) {
      btnCloseFriends.addEventListener('click', () => {
        modalFriends.classList.add('hidden');
      });
    }

    // Tabs Navigation
    const switchTab = (activeTab, activePanel) => {
      [tabMyFriends, tabRequests, tabSearchPlayers].forEach(t => t?.classList.remove('active'));
      [panelMyFriends, panelRequests, panelSearchPlayers].forEach(p => p?.classList.add('hidden'));

      activeTab?.classList.add('active');
      activePanel?.classList.remove('hidden');
    };

    if (tabMyFriends) {
      tabMyFriends.addEventListener('click', () => {
        switchTab(tabMyFriends, panelMyFriends);
        this.fetchAndRenderFriends();
      });
    }

    if (tabRequests) {
      tabRequests.addEventListener('click', () => {
        switchTab(tabRequests, panelRequests);
        this.fetchAndRenderRequests();
      });
    }

    if (tabSearchPlayers) {
      tabSearchPlayers.addEventListener('click', () => {
        switchTab(tabSearchPlayers, panelSearchPlayers);
      });
    }

    // Search Form
    if (formSearch) {
      formSearch.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput?.value || '';
        this.searchPlayer(query);
      });
    }

    // Edit Profile Modal
    const btnOpenEditProfile = document.getElementById('btn-open-edit-profile');
    const modalEditProfile = document.getElementById('modal-edit-profile');
    const btnCloseEditProfile = document.getElementById('btn-close-edit-profile');
    const formEditProfile = document.getElementById('form-edit-profile');

    if (btnOpenEditProfile) {
      btnOpenEditProfile.addEventListener('click', () => {
        this.openEditProfileModal();
      });
    }

    if (btnCloseEditProfile && modalEditProfile) {
      btnCloseEditProfile.addEventListener('click', () => {
        modalEditProfile.classList.add('hidden');
      });
    }

    if (formEditProfile) {
      formEditProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = document.getElementById('input-edit-display-name')?.value || '';
        const bio = document.getElementById('input-edit-bio')?.value || '';
        
        const res = await this.auth.updateProfile(displayName, this.selectedAvatar, bio);
        if (res.success) {
          modalEditProfile?.classList.add('hidden');
          sound.playPop();
          alert('✨ Profile updated successfully!');
          // Refresh profile UI
          const modalProfile = document.getElementById('modal-player-profile');
          if (modalProfile && !modalProfile.classList.contains('hidden')) {
            this.auth.openProfileModal();
          }
        } else {
          alert(`❌ ${res.error || 'Failed to update profile'}`);
        }
      });
    }

    // Avatar Picker Grid
    const avatarOptions = document.querySelectorAll('.avatar-option');
    avatarOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        avatarOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedAvatar = opt.dataset.avatar || '👤';
      });
    });

    // Friend Profile Modal Close
    const modalFriendProfile = document.getElementById('modal-friend-profile');
    const btnCloseFriendProfile = document.getElementById('btn-close-friend-profile');
    if (btnCloseFriendProfile && modalFriendProfile) {
      btnCloseFriendProfile.addEventListener('click', () => {
        modalFriendProfile.classList.add('hidden');
      });
    }

    // Lobby Invite Drawer
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

  openEditProfileModal() {
    const modalEditProfile = document.getElementById('modal-edit-profile');
    if (!modalEditProfile || !this.auth.currentUser) return;

    const inputName = document.getElementById('input-edit-display-name');
    const inputBio = document.getElementById('input-edit-bio');
    const displayId = document.getElementById('edit-profile-player-id');

    if (inputName) inputName.value = this.auth.currentUser.displayName || this.auth.currentUser.username;
    if (inputBio) inputBio.value = this.auth.currentUser.bio || 'Ready for Bingo!';
    if (displayId) displayId.textContent = `${this.auth.getPlayerId()}`;

    this.selectedAvatar = this.auth.currentUser.avatar || '👤';
    const avatarOptions = document.querySelectorAll('.avatar-option');
    avatarOptions.forEach(opt => {
      if (opt.dataset.avatar === this.selectedAvatar) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });

    modalEditProfile.classList.remove('hidden');
  }

  checkPendingRequestsCount() {
    if (!this.auth.isLoggedIn() || !this.mp.socket || !this.mp.socket.connected) return;

    this.mp.socket.emit('get_friend_requests', { username: this.auth.getUsername() }, (res) => {
      if (res && res.success && res.requests) {
        this.pendingRequests = res.requests;
        this.updateBadgeCount(res.requests.length);
      }
    });
  }

  updateBadgeCount(count) {
    const badgeUnread = document.getElementById('friends-unread-badge');
    const badgeTab = document.getElementById('tab-requests-count');

    if (badgeUnread) {
      if (count > 0) {
        badgeUnread.textContent = count;
        badgeUnread.classList.remove('hidden');
      } else {
        badgeUnread.classList.add('hidden');
      }
    }

    if (badgeTab) {
      badgeTab.textContent = count > 0 ? `(${count})` : '';
    }
  }

  searchPlayer(query) {
    const searchStatus = document.getElementById('search-status-msg');
    const searchResultsContainer = document.getElementById('search-results-container');

    if (!query || !query.trim()) {
      if (searchStatus) {
        searchStatus.textContent = '⚠️ Please enter a Name or Player ID (e.g. BGO-482951)';
        searchStatus.classList.remove('hidden');
      }
      return;
    }

    if (searchStatus) {
      searchStatus.textContent = '🔍 Searching player database...';
      searchStatus.classList.remove('hidden');
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('search_player', { query: query.trim(), currentUsername: this.auth.getUsername() }, (res) => {
        if (searchStatus) searchStatus.classList.add('hidden');

        if (res && res.success && res.player) {
          this.renderSearchResultCard(res.player, searchResultsContainer);
        } else {
          if (searchResultsContainer) {
            searchResultsContainer.innerHTML = `
              <div class="empty-state-badge error">
                ⚠️ ${res?.error || 'No player found with that ID or Name!'}
              </div>
            `;
          }
        }
      });
    } else {
      if (searchStatus) searchStatus.textContent = '❌ Multiplayer connection offline.';
    }
  }

  renderSearchResultCard(player, container) {
    if (!container) return;

    let actionBtnHtml = '';

    if (player.isSelf) {
      actionBtnHtml = `<span class="badge-chip">This is you</span>`;
    } else if (player.isAlreadyFriend) {
      actionBtnHtml = `<span class="badge-chip mint">✓ Friends</span>`;
    } else if (player.isRequestSent) {
      actionBtnHtml = `<span class="badge-chip muted">Request Sent</span>`;
    } else if (player.isRequestReceived) {
      actionBtnHtml = `<span class="badge-chip warning">Request Received</span>`;
    } else {
      actionBtnHtml = `
        <button class="app-btn btn-primary btn-sm btn-send-freq" data-id="${player.playerId}" data-name="${player.displayName}">
          ➕ Add Friend
        </button>
      `;
    }

    container.innerHTML = `
      <div class="player-card glass-card">
        <div class="p-card-left">
          <div class="p-card-avatar">${player.avatar || '👤'}</div>
          <div class="p-card-info">
            <div class="p-card-name">
              ${player.displayName}
              <span class="p-card-id">${player.playerId}</span>
            </div>
            <div class="p-card-stats">
              <span>🏆 ${player.trophies} Trophies</span>
              <span class="status-indicator ${player.isOnline ? 'online' : 'offline'}">
                ${player.isOnline ? '🟢 Online' : '⚪ Offline'}
              </span>
            </div>
          </div>
        </div>
        <div class="p-card-right">
          ${actionBtnHtml}
        </div>
      </div>
    `;

    const addBtn = container.querySelector('.btn-send-freq');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.sendFriendRequest(player.playerId, player.displayName, addBtn);
      });
    }
  }

  sendFriendRequest(targetPlayerId, targetDisplayName, btnEl) {
    if (!this.auth.isLoggedIn()) return;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('send_friend_request', {
        senderUsername: this.auth.getUsername(),
        targetPlayerId
      }, (res) => {
        if (res && res.success) {
          if (btnEl) {
            btnEl.textContent = res.isMutual ? '✓ Friends Now!' : '✓ Request Sent';
            btnEl.disabled = true;
            btnEl.style.opacity = '0.7';
          }
          sound.playPop();
          alert(res.message || `Friend request sent to ${targetDisplayName}!`);
          this.fetchAndRenderFriends();
        } else {
          alert(`❌ ${res?.error || 'Could not send friend request.'}`);
        }
      });
    }
  }

  fetchAndRenderRequests() {
    const container = document.getElementById('friend-requests-list');
    if (!container || !this.auth.isLoggedIn()) return;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('get_friend_requests', { username: this.auth.getUsername() }, (res) => {
        if (res && res.success && res.requests) {
          this.pendingRequests = res.requests;
          this.updateBadgeCount(res.requests.length);
          this.renderRequestsList(res.requests, container);
        }
      });
    }
  }

  renderRequestsList(requests, container) {
    if (!container) return;

    if (requests.length === 0) {
      container.innerHTML = `<div class="empty-state-badge">📩 No pending friend requests.</div>`;
      return;
    }

    container.innerHTML = requests.map(req => `
      <div class="request-card glass-card">
        <div class="r-info">
          <span class="r-avatar">${req.senderAvatar || '👤'}</span>
          <div class="r-name-group">
            <span class="r-name">${req.senderDisplayName || req.senderUsername}</span>
            <span class="r-id">${req.senderId}</span>
          </div>
        </div>
        <div class="r-actions">
          <button class="app-btn btn-primary btn-sm btn-accept-req" data-req-id="${req.id}">
            ✓ Accept
          </button>
          <button class="btn-text danger-text btn-sm btn-decline-req" data-req-id="${req.id}">
            ✕ Decline
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-accept-req').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.reqId;
        this.respondFriendRequest(reqId, true);
      });
    });

    container.querySelectorAll('.btn-decline-req').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.reqId;
        this.respondFriendRequest(reqId, false);
      });
    });
  }

  respondFriendRequest(requestId, accepted) {
    if (!this.auth.isLoggedIn()) return;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('respond_friend_request', {
        username: this.auth.getUsername(),
        requestId,
        accepted
      }, (res) => {
        if (res && res.success) {
          sound.playPop();
          if (accepted && res.friends) {
            this.auth.currentUser.friends = res.friends;
            this.auth.saveUser(this.auth.currentUser);
            alert('🎉 Friend Request accepted!');
          }
          this.fetchAndRenderRequests();
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
          👥 You haven't added any friends yet!<br>Use the <strong>"Search Players"</strong> tab to find friends by ID (BGO-XXXXXX) or Name.
        </div>
      `;
      return;
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('get_friends_list', { username: this.auth.getUsername(), friendIds: myFriendsIds }, (res) => {
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
      <div class="friend-card glass-card clickable-friend-card" data-player-id="${f.playerId}">
        <div class="f-info">
          <span class="f-avatar">${f.avatar || '👤'}</span>
          <div class="f-name-group">
            <span class="f-name">${f.displayName}</span>
            <span class="f-id">${f.playerId} | 🏆 ${f.trophies}</span>
          </div>
        </div>
        <div class="f-status-pill ${f.isOnline ? 'online' : 'offline'}">
          ${f.isOnline ? '🟢 Online' : '⚪ Offline'}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.clickable-friend-card').forEach(card => {
      card.addEventListener('click', () => {
        const playerId = card.dataset.playerId;
        const friendObj = friends.find(f => f.playerId === playerId);
        if (friendObj) this.openFriendProfileModal(friendObj);
      });
    });
  }

  openFriendProfileModal(friend) {
    const modal = document.getElementById('modal-friend-profile');
    if (!modal) return;

    const avatarEl = document.getElementById('friend-profile-avatar');
    const nameEl = document.getElementById('friend-profile-name');
    const idEl = document.getElementById('friend-profile-id');
    const bioEl = document.getElementById('friend-profile-bio');
    const trophiesEl = document.getElementById('friend-profile-trophies');
    const winsEl = document.getElementById('friend-profile-wins');
    const statusEl = document.getElementById('friend-profile-status');
    const btnInvite = document.getElementById('btn-friend-invite-game');
    const btnRemove = document.getElementById('btn-friend-remove');

    if (avatarEl) avatarEl.textContent = friend.avatar || '👤';
    if (nameEl) nameEl.textContent = friend.displayName;
    if (idEl) idEl.textContent = `${friend.playerId}`;
    if (bioEl) bioEl.textContent = friend.bio || 'Ready for Bingo!';
    if (trophiesEl) trophiesEl.textContent = `${friend.trophies || 100} Trophies`;
    if (winsEl) winsEl.textContent = `${friend.wins || 0} Victories`;
    if (statusEl) {
      statusEl.className = `status-pill ${friend.isOnline ? 'online' : 'offline'}`;
      statusEl.textContent = friend.isOnline ? '🟢 Online' : '⚪ Offline';
    }

    if (btnInvite) {
      btnInvite.onclick = () => {
        if (!friend.isOnline) {
          alert(`🔴 ${friend.displayName} is currently offline.`);
          return;
        }
        this.sendGameInviteToFriend(friend.username, friend.displayName, btnInvite);
      };
    }

    if (btnRemove) {
      btnRemove.onclick = () => {
        if (confirm(`Are you sure you want to remove ${friend.displayName} from your friends list?`)) {
          this.removeFriend(friend.playerId, modal);
        }
      };
    }

    modal.classList.remove('hidden');
  }

  removeFriend(friendPlayerId, modalEl) {
    if (!this.auth.isLoggedIn()) return;

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('remove_friend', {
        username: this.auth.getUsername(),
        friendPlayerId
      }, (res) => {
        if (res && res.success) {
          this.auth.currentUser.friends = res.friends;
          this.auth.saveUser(this.auth.currentUser);
          if (modalEl) modalEl.classList.add('hidden');
          sound.playPop();
          alert('Friend removed.');
          this.fetchAndRenderFriends();
        }
      });
    }
  }

  sendGameInviteToFriend(targetUsername, targetDisplayName, btnEl) {
    // If not host of an existing room, create room first
    let roomCode = this.mp.roomCode;

    const executeInvite = (code) => {
      if (this.mp.socket && this.mp.socket.connected) {
        this.mp.socket.emit('send_room_invite', {
          fromUsername: this.auth.getUsername(),
          targetUsername,
          roomCode: code,
          mode: this.mp.selectedMode || 'grid-battle'
        }, (res) => {
          if (res && res.success) {
            if (btnEl) {
              btnEl.textContent = '✓ Invite Sent!';
              setTimeout(() => { btnEl.textContent = '🎮 INVITE TO GAME'; }, 3000);
            }
            sound.playPop();
            alert(`🎮 Game invite sent to ${targetDisplayName}!`);
          } else {
            alert(`❌ ${res?.error || 'Could not send invite.'}`);
          }
        });
      }
    };

    if (!roomCode) {
      // Create room automatically then send invite
      this.mp.createRoom(this.auth.getUsername(), this.mp.selectedMode || 'grid-battle');
      setTimeout(() => {
        if (this.mp.roomCode) executeInvite(this.mp.roomCode);
      }, 500);
    } else {
      executeInvite(roomCode);
    }
  }

  renderLobbyInviteDrawer() {
    const container = document.getElementById('lobby-friends-invite-list');
    const myFriendsIds = this.auth.currentUser?.friends || [];

    if (!container) return;

    if (myFriendsIds.length === 0) {
      container.innerHTML = `
        <div class="empty-state-badge">
          👥 No friends added yet. Open Friends to search and add friends!
        </div>
      `;
      return;
    }

    if (this.mp.socket && this.mp.socket.connected) {
      this.mp.socket.emit('get_friends_list', { username: this.auth.getUsername(), friendIds: myFriendsIds }, (res) => {
        if (res && res.success && res.friends) {
          const onlineFriends = res.friends.filter(f => f.isOnline);
          if (onlineFriends.length === 0) {
            container.innerHTML = `
              <div class="empty-state-badge">
                ⚪ All your friends are currently offline.
              </div>
            `;
            return;
          }

          container.innerHTML = onlineFriends.map(f => `
            <div class="invite-friend-row glass-card">
              <div class="f-details">
                <span class="f-avatar">${f.avatar || '👤'}</span>
                <div class="f-text">
                  <span class="f-name">${f.displayName}</span>
                  <span class="f-badge">🏆 ${f.trophies}</span>
                </div>
              </div>
              <button class="app-btn btn-primary btn-sm btn-send-invite" data-username="${f.username}" data-name="${f.displayName}">
                📩 Invite
              </button>
            </div>
          `).join('');

          container.querySelectorAll('.btn-send-invite').forEach(btn => {
            btn.addEventListener('click', () => {
              const targetUsername = btn.dataset.username;
              const targetDisplayName = btn.dataset.name;
              this.sendGameInviteToFriend(targetUsername, targetDisplayName, btn);
            });
          });
        }
      });
    }
  }

  listenForSocketEvents() {
    if (!this.mp.socket) return;

    // Real-time Friend Request Received
    this.mp.socket.on('friend_request_received', (req) => {
      sound.playTrophy();
      this.pendingRequests.unshift(req);
      this.updateBadgeCount(this.pendingRequests.length);
      this.showIncomingFriendRequestToast(req);
    });

    // Real-time Friend Request Accepted
    this.mp.socket.on('friend_request_accepted', ({ friendName, friendPlayerId }) => {
      sound.playTrophy();
      if (this.auth.currentUser) {
        if (!this.auth.currentUser.friends) this.auth.currentUser.friends = [];
        if (!this.auth.currentUser.friends.includes(friendPlayerId)) {
          this.auth.currentUser.friends.push(friendPlayerId);
          this.auth.saveUser(this.auth.currentUser);
        }
      }
      this.showFriendAcceptedToast(friendName);
      this.fetchAndRenderFriends();
    });

    // Real-time Room Invite Received
    this.mp.socket.on('room_invite_received', ({ fromUsername, fromAvatar, roomCode, mode, expiresAt }) => {
      if (expiresAt && Date.now() > expiresAt) return; // Expired check
      sound.playTrophy();
      this.showIncomingGameInviteToast(fromUsername, fromAvatar, roomCode, mode);
    });
  }

  showIncomingFriendRequestToast(req) {
    let toast = document.getElementById('toast-friend-request');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-friend-request';
      toast.className = 'room-invite-toast-overlay';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div class="invite-banner-card glass-card">
        <div class="invite-banner-header">
          <span class="invite-icon">🔔</span>
          <div class="invite-title-text">
            <strong>${req.senderDisplayName || req.senderUsername}</strong> sent you a friend request!
          </div>
        </div>
        <div class="invite-actions">
          <button id="btn-accept-freq-toast" class="app-btn btn-primary btn-sm pulse-glow">
            ✓ Accept
          </button>
          <button id="btn-decline-freq-toast" class="btn-text danger-text btn-sm">
            Decline
          </button>
        </div>
      </div>
    `;

    toast.classList.remove('hidden');

    toast.querySelector('#btn-accept-freq-toast')?.addEventListener('click', () => {
      toast.classList.add('hidden');
      this.respondFriendRequest(req.id, true);
    });

    toast.querySelector('#btn-decline-freq-toast')?.addEventListener('click', () => {
      toast.classList.add('hidden');
      this.respondFriendRequest(req.id, false);
    });
  }

  showFriendAcceptedToast(friendName) {
    const toast = document.createElement('div');
    toast.className = 'room-invite-toast-overlay';
    toast.innerHTML = `
      <div class="invite-banner-card glass-card">
        <div class="invite-banner-header">
          <span class="invite-icon">🎉</span>
          <div class="invite-title-text">
            <strong>${friendName}</strong> accepted your friend request!
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  showIncomingGameInviteToast(fromUsername, fromAvatar, roomCode, mode) {
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
          <span class="invite-icon">${fromAvatar || '🎮'}</span>
          <div class="invite-title-text">
            <strong>${fromUsername}</strong> invited you to play Bingo!
          </div>
        </div>
        <div class="invite-details">
          <span>🎮 Mode: ${mode || '5x5 Battle'}</span>
          <span>🔑 Key: <strong>${roomCode}</strong></span>
        </div>
        <div class="invite-actions">
          <button id="btn-accept-invite" class="app-btn btn-primary btn-sm pulse-glow">
            🚀 Accept & Join Room
          </button>
          <button id="btn-decline-invite" class="btn-text danger-text btn-sm">
            Decline
          </button>
        </div>
      </div>
    `;

    toast.classList.remove('hidden');

    toast.querySelector('#btn-accept-invite')?.addEventListener('click', () => {
      toast.classList.add('hidden');
      if (this.mp) {
        this.mp.joinRoom(roomCode, this.auth.getUsername());
      }
    });

    toast.querySelector('#btn-decline-invite')?.addEventListener('click', () => {
      toast.classList.add('hidden');
    });
  }
}
