/* ==========================================================================
   BINGO MASTER - EXPRESS + SOCKET.IO + MONGOOSE MULTIPLAYER SERVER
   ========================================================================== */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bingo_db';
let isDbConnected = false;

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => {
    isDbConnected = true;
    console.log('✅ Connected to MongoDB Cloud Atlas database successfully!');
  })
  .catch(err => {
    isDbConnected = false;
    console.log('ℹ️ Operating in high-speed in-memory multiplayer mode (MongoDB offline).');
  });

// MongoDB Schema for Multiplayer Rooms
const roomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  hostName: { type: String, required: true },
  players: [{
    socketId: String,
    name: String,
    isHost: Boolean
  }],
  status: { type: String, default: 'waiting' }, // waiting, playing, finished
  calledNumbers: [Number],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-expire after 24 hrs
});

const Room = mongoose.model('Room', roomSchema);

// MongoDB Schema for Registered Players & Trophies
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  trophies: { type: Number, default: 100 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Hybrid Storage: MongoDB with In-Memory fallback
const memoryRooms = new Map();
const memoryUsers = new Map();

// Helper to update player trophies in DB & In-Memory
async function adjustUserTrophies(username, delta) {
  if (!username) return null;
  const cleanUser = username.trim().toLowerCase();

  // Try DB
  if (isDbConnected && mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findOne({ username: cleanUser });
      if (dbUser) {
        dbUser.trophies = Math.max(0, dbUser.trophies + delta);
        if (delta > 0) dbUser.wins += 1;
        if (delta < 0) dbUser.losses += 1;
        await dbUser.save();
        return { username: dbUser.username, trophies: dbUser.trophies, wins: dbUser.wins, losses: dbUser.losses };
      }
    } catch (e) {
      console.error('Error updating DB trophies:', e);
    }
  }

  // Memory Fallback
  let memUser = memoryUsers.get(cleanUser);
  if (!memUser) {
    memUser = { username, trophies: 100, wins: 0, losses: 0 };
  }
  memUser.trophies = Math.max(0, memUser.trophies + delta);
  if (delta > 0) memUser.wins += 1;
  if (delta < 0) memUser.losses += 1;
  memoryUsers.set(cleanUser, memUser);
  return memUser;
}

// REST API for User Auth & Trophies
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanName = (username || '').trim();
  const cleanNameLower = cleanName.toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ success: false, error: 'Username must be at least 2 characters long!' });
  }
  if (!password || password.length < 3) {
    return res.status(400).json({ success: false, error: 'Password must be at least 3 characters long!' });
  }

  try {
    if (isDbConnected && mongoose.connection.readyState === 1) {
      const existing = await User.findOne({ username: cleanNameLower });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username is already taken! Please log in.' });
      }
      const newUser = new User({ username: cleanNameLower, password, trophies: 100 });
      await newUser.save();
      return res.json({ success: true, user: { username: cleanName, trophies: 100, wins: 0, losses: 0 } });
    } else {
      if (memoryUsers.has(cleanNameLower)) {
        return res.status(400).json({ success: false, error: 'Username is already taken! Please log in.' });
      }
      const memUser = { username: cleanName, password, trophies: 100, wins: 0, losses: 0 };
      memoryUsers.set(cleanNameLower, memUser);
      return res.json({ success: true, user: { username: cleanName, trophies: 100, wins: 0, losses: 0 } });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Registration failed server-side' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanName = (username || '').trim();
  const cleanNameLower = cleanName.toLowerCase();

  if (!cleanName || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required!' });
  }

  try {
    if (isDbConnected && mongoose.connection.readyState === 1) {
      const user = await User.findOne({ username: cleanNameLower });
      if (!user || user.password !== password) {
        return res.status(400).json({ success: false, error: 'Invalid username or password!' });
      }
      return res.json({ success: true, user: { username: user.username, trophies: user.trophies, wins: user.wins, losses: user.losses } });
    } else {
      const memUser = memoryUsers.get(cleanNameLower);
      if (!memUser || memUser.password !== password) {
        return res.status(400).json({ success: false, error: 'Invalid username or password!' });
      }
      return res.json({ success: true, user: { username: memUser.username, trophies: memUser.trophies, wins: memUser.wins, losses: memUser.losses } });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Login failed server-side' });
  }
});

app.post('/api/trophies', async (req, res) => {
  const { username, delta } = req.body || {};
  if (!username || typeof delta !== 'number') {
    return res.status(400).json({ success: false, error: 'Username and numeric delta required' });
  }
  const updated = await adjustUserTrophies(username, delta);
  return res.json({ success: true, user: updated });
});

// Real-Time Socket.IO Multiplayer Logic
io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  // Socket Auth: Register
  socket.on('auth_register', async ({ username, password }, callback) => {
    const cleanName = (username || '').trim();
    const cleanNameLower = cleanName.toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      const errRes = { success: false, error: 'Username must be at least 2 characters long!' };
      if (typeof callback === 'function') callback(errRes);
      return;
    }
    if (!password || password.length < 3) {
      const errRes = { success: false, error: 'Password must be at least 3 characters long!' };
      if (typeof callback === 'function') callback(errRes);
      return;
    }

    try {
      if (isDbConnected && mongoose.connection.readyState === 1) {
        const existing = await User.findOne({ username: cleanNameLower });
        if (existing) {
          const res = { success: false, error: 'Username already taken! Try logging in.' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const newUser = new User({ username: cleanNameLower, password, trophies: 100 });
        await newUser.save();
        const res = { success: true, user: { username: cleanName, trophies: 100, wins: 0, losses: 0 } };
        if (typeof callback === 'function') callback(res);
      } else {
        if (memoryUsers.has(cleanNameLower)) {
          const res = { success: false, error: 'Username already taken! Try logging in.' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const memUser = { username: cleanName, password, trophies: 100, wins: 0, losses: 0 };
        memoryUsers.set(cleanNameLower, memUser);
        const res = { success: true, user: { username: cleanName, trophies: 100, wins: 0, losses: 0 } };
        if (typeof callback === 'function') callback(res);
      }
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, error: 'Registration error' });
    }
  });

  // Socket Auth: Login
  socket.on('auth_login', async ({ username, password }, callback) => {
    const cleanName = (username || '').trim();
    const cleanNameLower = cleanName.toLowerCase();

    try {
      if (isDbConnected && mongoose.connection.readyState === 1) {
        const user = await User.findOne({ username: cleanNameLower });
        if (!user || user.password !== password) {
          const res = { success: false, error: 'Invalid username or password!' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const res = { success: true, user: { username: user.username, trophies: user.trophies, wins: user.wins, losses: user.losses } };
        if (typeof callback === 'function') callback(res);
      } else {
        const memUser = memoryUsers.get(cleanNameLower);
        if (!memUser || memUser.password !== password) {
          const res = { success: false, error: 'Invalid username or password!' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const res = { success: true, user: { username: memUser.username, trophies: memUser.trophies, wins: memUser.wins, losses: memUser.losses } };
        if (typeof callback === 'function') callback(res);
      }
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, error: 'Login error' });
    }
  });

  // Socket Event: Update Trophies (+5 / -5 / +1)
  socket.on('update_trophies', async ({ username, delta }, callback) => {
    const updated = await adjustUserTrophies(username, delta);
    if (updated) {
      socket.emit('trophies_updated', updated);
      if (typeof callback === 'function') callback({ success: true, user: updated });
    }
  });

  // Check Unique Nickname Availability Across Server
  socket.on('check_nickname', ({ nickname }, callback) => {
    const clean = (nickname || '').trim();
    if (!clean || clean.length < 2) {
      const res = { available: false, error: 'Nickname must be at least 2 characters!' };
      if (typeof callback === 'function') callback(res);
      socket.emit('nickname_result', res);
      return;
    }

    let isTaken = false;
    memoryRooms.forEach(room => {
      room.players.forEach(p => {
        if (p.socketId !== socket.id && p.name.toLowerCase() === clean.toLowerCase()) {
          isTaken = true;
        }
      });
    });

    if (isTaken) {
      console.log(`⚠️ Nickname "${clean}" is taken on server.`);
      const res = { available: false, error: 'Name not available' };
      if (typeof callback === 'function') callback(res);
      socket.emit('nickname_result', res);
    } else {
      const res = { available: true, nickname: clean };
      if (typeof callback === 'function') callback(res);
      socket.emit('nickname_result', res);
    }
  });

  // Create Room & Generate Key
  socket.on('create_room', async ({ hostName, selectedMode }) => {
    const codeNum = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `BINGO-${codeNum}`;
    const hostPlayer = { socketId: socket.id, name: hostName || 'Host Player', isHost: true };
    const roomData = {
      roomCode,
      hostName: hostName || 'Host Player',
      selectedMode: selectedMode || 'grid-battle',
      players: [hostPlayer],
      currentTurnSocketId: socket.id,
      calledNumbers: [],
      status: 'waiting'
    };

    if (isDbConnected && mongoose.connection.readyState === 1) {
      try {
        const room = new Room(roomData);
        await room.save();
      } catch (err) {
        console.log(`ℹ️ Storing room ${roomCode} in high-speed memory fallback.`);
      }
    }

    memoryRooms.set(roomCode, roomData);
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, room: roomData });
    console.log(`🏠 Room Key Generated: ${roomCode} by ${hostName}`);
  });

  // Join Room by Room Key
  socket.on('join_room', async ({ roomCode, playerName }) => {
    let cleanCode = (roomCode || '').trim().toUpperCase();
    if (/^\d{4}$/.test(cleanCode)) {
      cleanCode = `BINGO-${cleanCode}`;
    }

    let room = memoryRooms.get(cleanCode);

    if (!room && isDbConnected && mongoose.connection.readyState === 1) {
      try {
        const dbRoom = await Room.findOne({ roomCode: cleanCode });
        if (dbRoom) room = dbRoom.toObject();
      } catch (err) {}
    }

    if (!room) {
      socket.emit('error_msg', `Room Key "${cleanCode}" not found! Please check room code.`);
      return;
    }

    const maxPlayers = room.selectedMode === 'grid-battle' ? 2 : 5;
    if (room.players.length >= maxPlayers) {
      socket.emit('error_msg', `Room "${cleanCode}" is full! (${room.players.length}/${maxPlayers} players max)`);
      return;
    }

    const existingIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (existingIndex === -1) {
      const newPlayer = { socketId: socket.id, name: playerName || 'Guest Player', isHost: false };
      room.players.push(newPlayer);
    }
    
    memoryRooms.set(cleanCode, room);

    socket.join(cleanCode);
    socket.emit('room_joined', { roomCode: cleanCode, room });
    io.to(cleanCode).emit('player_joined', { room, playerName: playerName || 'Guest Player' });
    console.log(`👤 ${playerName || 'Guest Player'} joined Room Key ${cleanCode}`);
  });

  // Relay Game Actions with Strict Turn Validation
  socket.on('game_action', ({ roomCode, action }) => {
    const room = memoryRooms.get(roomCode);
    if (!room) {
      socket.emit('error_msg', 'Room not found!');
      return;
    }

    if (action.type === 'START_GAME') {
      room.status = 'playing';
      room.calledNumbers = [];
      room.currentTurnSocketId = room.players[0].socketId; // Host starts turn 1
      action.currentTurnSocketId = room.currentTurnSocketId;
      io.to(roomCode).emit('game_action_received', action);
      console.log(`🚀 Match started in Room ${roomCode}. Turn: ${room.currentTurnSocketId}`);
      return;
    }

    if (action.type === 'GRID_CALL_NUMBER') {
      if (room.status !== 'playing') {
        socket.emit('error_msg', 'Game has not started yet!');
        return;
      }

      // STRICT TURN VALIDATION: Reject move if requesting socket is not the active turn socket!
      if (socket.id !== room.currentTurnSocketId) {
        socket.emit('error_msg', "🚫 Not your turn! Please wait for your opponent's move.");
        console.log(`⚠️ Blocked out-of-turn move attempt by ${socket.id} in Room ${roomCode}`);
        return;
      }

      // Reject if number was already called
      if (room.calledNumbers.includes(action.number)) {
        socket.emit('error_msg', `Number ${action.number} was already called!`);
        return;
      }

      // Record called number
      room.calledNumbers.push(action.number);

      // Cycle turn to next player
      const currentIndex = room.players.findIndex(p => p.socketId === socket.id);
      const nextIndex = (currentIndex + 1) % room.players.length;
      room.currentTurnSocketId = room.players[nextIndex].socketId;

      action.senderSocketId = socket.id;
      action.nextTurnSocketId = room.currentTurnSocketId;

      io.to(roomCode).emit('game_action_received', action);
      console.log(`🎯 Room ${roomCode}: Number ${action.number} called by ${socket.id}. Next turn: ${room.currentTurnSocketId}`);
      return;
    }

    // Broadcast generic actions (e.g. Emoji reaction)
    io.to(roomCode).emit('game_action_received', action);
  });

  // Leave Room
  socket.on('leave_room', ({ roomCode }) => {
    socket.leave(roomCode);
    if (memoryRooms.has(roomCode)) {
      const room = memoryRooms.get(roomCode);
      room.players = room.players.filter(p => p.socketId !== socket.id);
      io.to(roomCode).emit('player_joined', { room, playerName: 'A player' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    memoryRooms.forEach((room, roomCode) => {
      const pIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (pIndex !== -1) {
        const removed = room.players.splice(pIndex, 1)[0];
        if (room.players.length === 0) {
          memoryRooms.delete(roomCode);
        } else {
          if (removed.isHost && room.players.length > 0) {
            room.players[0].isHost = true;
          }
          io.to(roomCode).emit('player_joined', { room, playerName: `${removed.name} (left)` });
        }
      }
    });
  });
});

// Fallback route for SPA index.html (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Bingo Server running on port ${PORT}`);
});
