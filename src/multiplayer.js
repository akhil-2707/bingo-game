/* ==========================================================================
   BINGO MASTER - SOCKET.IO REAL-TIME MULTIPLAYER ENGINE
   ========================================================================== */

import { io } from 'socket.io-client';

export class MultiplayerManager {
  constructor(options = {}) {
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onMessageReceived = options.onMessageReceived || (() => {});
    this.onPlayerListChange = options.onPlayerListChange || (() => {});

    this.socket = null;
    this.isHost = false;
    this.roomCode = null;
    const savedName = localStorage.getItem('bingo_player_nickname');
    this.myPlayerName = savedName || 'Player ' + Math.floor(Math.random() * 900 + 100);
    this.players = [];
    this.isConnected = false;
    this.selectedMode = 'grid-battle';
    this.currentRoundId = 'round_1';

    this.initSocket();
  }

  initSocket() {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : window.location.origin);
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('⚡ Socket.IO Connected:', this.socket.id);
        const savedRoom = sessionStorage.getItem('bingo_active_room');
        if (savedRoom && !this.roomCode) {
          this.joinRoom(savedRoom, this.myPlayerName);
        }
      });

      this.socket.on('room_created', ({ roomCode, room }) => {
        this.roomCode = roomCode;
        sessionStorage.setItem('bingo_active_room', roomCode);
        this.isHost = true;
        this.isConnected = true;
        this.players = room.players || [{ socketId: this.socket.id, name: this.myPlayerName, isHost: true }];
        this.currentRoundId = room.roundId || 'round_1';
        this.onStatusChange(`🔑 Room Key Generated: ${this.roomCode}`, 'success');
        this.onPlayerListChange(this.players);
      });

      this.socket.on('room_joined', ({ roomCode, room }) => {
        this.roomCode = roomCode;
        sessionStorage.setItem('bingo_active_room', roomCode);
        this.isHost = false;
        this.isConnected = true;
        this.players = room.players || [];
        this.currentRoundId = room.roundId || 'round_1';
        const me = this.players.find(p => p.socketId === this.socket.id);
        if (me) {
          this.isHost = !!me.isHost;
        }
        this.onStatusChange(`🔑 Joined Room Key ${this.roomCode}!`, 'success');
        this.onPlayerListChange(this.players);
      });

      this.socket.on('player_joined', ({ room, playerName }) => {
        if (room && room.players) {
          this.players = room.players;
          const me = this.players.find(p => p.socketId === this.socket.id);
          if (me) {
            this.isHost = !!me.isHost;
          }
          this.onPlayerListChange(this.players);
        }
        if (playerName && playerName !== this.myPlayerName) {
          this.onStatusChange(`👤 ${playerName} joined the room!`, 'info');
        }
      });

      this.socket.on('game_action_received', (action) => {
        if (action.type === 'REMATCH_ACCEPTED') {
          this.currentRoundId = action.newRoundId || 'round_1';
          if (action.players) this.players = action.players;
        }
        this.onMessageReceived(action);
      });

      this.socket.on('error_msg', (msg) => {
        this.onStatusChange(msg, 'error');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

    } catch (e) {
      console.warn('Socket.IO connection notice:', e);
    }
  }

  checkNickname(nickname, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('check_nickname', { nickname }, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    } else {
      if (typeof callback === 'function') callback({ available: true, nickname });
    }
  }

  generateRoomCode() {
    const codeNum = Math.floor(1000 + Math.random() * 9000);
    return `BINGO-${codeNum}`;
  }

  createRoom(customName, selectedMode = 'grid-battle') {
    if (customName) {
      this.myPlayerName = customName;
      localStorage.setItem('bingo_player_nickname', customName);
    }
    this.selectedMode = selectedMode;

    if (this.socket && this.socket.connected) {
      this.socket.emit('create_room', { hostName: this.myPlayerName, selectedMode: this.selectedMode });
    } else {
      // Local High-Speed Fallback Room Key Generation
      this.roomCode = this.generateRoomCode();
      this.isHost = true;
      this.isConnected = true;
      this.players = [{ id: 'host-1', name: this.myPlayerName, isHost: true }];
      this.onStatusChange(`🔑 Room Key Generated: ${this.roomCode}`, 'success');
      this.onPlayerListChange(this.players);
    }
  }

  joinRoom(roomCodeInput, customName) {
    if (customName) {
      this.myPlayerName = customName;
      localStorage.setItem('bingo_player_nickname', customName);
    }
    let cleanCode = (roomCodeInput || '').trim().toUpperCase();
    if (!cleanCode) {
      this.onStatusChange('Please enter a Room Key!', 'error');
      return;
    }
    if (/^\d{4}$/.test(cleanCode)) {
      cleanCode = `BINGO-${cleanCode}`;
    }
    this.roomCode = cleanCode;

    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', { roomCode: cleanCode, playerName: this.myPlayerName });
    } else {
      // Local High-Speed Fallback Join
      this.isHost = false;
      this.isConnected = true;
      this.players = [
        { id: 'host-1', name: 'Host Player', isHost: true },
        { id: 'guest-2', name: this.myPlayerName, isHost: false }
      ];
      this.onStatusChange(`🔑 Joined Room Key ${cleanCode}!`, 'success');
      this.onPlayerListChange(this.players);
    }
  }

  broadcast(action) {
    if (this.socket && this.socket.connected && this.roomCode) {
      action.roundId = action.roundId || this.currentRoundId;
      this.socket.emit('game_action', { roomCode: this.roomCode, action });
    }
  }

  requestRematch() {
    this.broadcast({
      type: 'REMATCH_REQUEST',
      requesterName: this.myPlayerName
    });
  }

  respondRematch(accepted) {
    this.broadcast({
      type: 'REMATCH_RESPONSE',
      accepted: !!accepted,
      declinerName: this.myPlayerName
    });
  }

  leaveRoom() {
    if (this.socket && this.socket.connected && this.roomCode) {
      this.socket.emit('leave_room', { roomCode: this.roomCode });
    }
    sessionStorage.removeItem('bingo_active_room');
    this.isConnected = false;
    this.isHost = false;
    this.roomCode = null;
    this.players = [];
    this.onStatusChange('Disconnected from room.');
    this.onPlayerListChange([]);
  }
}

export const multiplayerManager = new MultiplayerManager();
