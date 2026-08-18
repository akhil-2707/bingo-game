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
  playerId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '👤' },
  bio: { type: String, default: 'Ready for Bingo!' },
  password: { type: String, required: true },
  trophies: { type: Number, default: 100 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  friends: [{ type: String }], // list of friend playerIds (BGO-XXXXXX)
  friendRequests: [{
    id: String,
    senderId: String,
    senderUsername: String,
    senderDisplayName: String,
    senderAvatar: String,
    status: { type: String, default: 'pending' }, // pending, accepted, declined
    createdAt: { type: Date, default: Date.now }
  }],
  matchHistory: [{
    mode: { type: String, default: '5x5 Battle' },
    result: { type: String, default: 'WIN' },
    delta: { type: Number, default: 5 },
    time: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Hybrid Storage: MongoDB with In-Memory fallback
const memoryRooms = new Map();
const memoryUsers = new Map();
const onlineUsers = new Map(); // usernameLower -> { socketId, playerId, username, displayName, avatar, trophies }

// Helper to generate a unique Player ID: BGO-XXXXXX
function generate6DigitId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `BGO-${num}`;
}

// Helper to update player trophies in DB & In-Memory
async function adjustUserTrophies(username, delta, modeName = '5x5 Battle') {
  if (!username) return null;
  const cleanUser = username.trim().toLowerCase();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMatchItem = {
    mode: modeName,
    result: delta >= 0 ? 'WIN' : 'LOSS',
    delta: delta,
    time: timeStr
  };

  // Try DB
  if (isDbConnected && mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findOne({ username: cleanUser });
      if (dbUser) {
        dbUser.trophies = Math.max(0, dbUser.trophies + delta);
        if (delta > 0) dbUser.wins += 1;
        if (delta < 0) dbUser.losses += 1;
        if (!dbUser.matchHistory) dbUser.matchHistory = [];
        dbUser.matchHistory.unshift(newMatchItem);
        if (dbUser.matchHistory.length > 10) dbUser.matchHistory = dbUser.matchHistory.slice(0, 10);
        await dbUser.save();
        return {
          username: dbUser.username,
          playerId: dbUser.playerId,
          displayName: dbUser.displayName || dbUser.username,
          avatar: dbUser.avatar || '👤',
          bio: dbUser.bio || 'Ready for Bingo!',
          trophies: dbUser.trophies,
          wins: dbUser.wins,
          losses: dbUser.losses,
          friends: dbUser.friends || [],
          matchHistory: dbUser.matchHistory
        };
      }
    } catch (e) {
      console.error('Error updating DB trophies:', e);
    }
  }

  // Memory Fallback
  let memUser = memoryUsers.get(cleanUser);
  if (!memUser) {
    memUser = { username, playerId: generate6DigitId(), displayName: username, avatar: '👤', bio: 'Ready for Bingo!', trophies: 100, wins: 0, losses: 0, friends: [], matchHistory: [] };
  }
  memUser.trophies = Math.max(0, memUser.trophies + delta);
  if (delta > 0) memUser.wins += 1;
  if (delta < 0) memUser.losses += 1;
  if (!memUser.matchHistory) memUser.matchHistory = [];
  memUser.matchHistory.unshift(newMatchItem);
  if (memUser.matchHistory.length > 10) memUser.matchHistory = memUser.matchHistory.slice(0, 10);
  memoryUsers.set(cleanUser, memUser);
  return memUser;
}

// REST API for Profile Update
app.post('/api/profile/update', async (req, res) => {
  const { username, displayName, avatar, bio } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: 'Username is required' });
  const cleanUser = username.trim().toLowerCase();
  const cleanDisplayName = (displayName || username).trim();
  const cleanAvatar = avatar || '👤';
  const cleanBio = (bio || 'Ready for Bingo!').trim();

  let updatedObj = null;
  if (isDbConnected && mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findOne({ username: cleanUser });
      if (dbUser) {
        dbUser.displayName = cleanDisplayName;
        dbUser.avatar = cleanAvatar;
        dbUser.bio = cleanBio;
        await dbUser.save();
        updatedObj = {
          username: dbUser.username,
          playerId: dbUser.playerId,
          displayName: dbUser.displayName,
          avatar: dbUser.avatar,
          bio: dbUser.bio,
          trophies: dbUser.trophies,
          wins: dbUser.wins,
          losses: dbUser.losses,
          friends: dbUser.friends || []
        };
      }
    } catch (e) {}
  }

  let memUser = memoryUsers.get(cleanUser);
  if (memUser) {
    memUser.displayName = cleanDisplayName;
    memUser.avatar = cleanAvatar;
    memUser.bio = cleanBio;
    if (!updatedObj) {
      updatedObj = {
        username: memUser.username,
        playerId: memUser.playerId,
        displayName: memUser.displayName,
        avatar: memUser.avatar,
        bio: memUser.bio,
        trophies: memUser.trophies,
        wins: memUser.wins,
        losses: memUser.losses,
        friends: memUser.friends || []
      };
    }
  }

  if (onlineUsers.has(cleanUser)) {
    const ou = onlineUsers.get(cleanUser);
    ou.displayName = cleanDisplayName;
    ou.avatar = cleanAvatar;
  }

  if (updatedObj) {
    return res.json({ success: true, user: updatedObj });
  } else {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
});

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

  const playerId = generate6DigitId();

  try {
    if (isDbConnected && mongoose.connection.readyState === 1) {
      const existing = await User.findOne({ username: cleanNameLower });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username is already taken! Please log in.' });
      }
      const newUser = new User({
        username: cleanNameLower,
        displayName: cleanName,
        avatar: '👤',
        bio: 'Ready for Bingo!',
        password,
        playerId,
        trophies: 100,
        friends: [],
        friendRequests: []
      });
      await newUser.save();
      return res.json({
        success: true,
        user: {
          username: cleanName,
          playerId: newUser.playerId,
          displayName: cleanName,
          avatar: '👤',
          bio: 'Ready for Bingo!',
          trophies: 100,
          wins: 0,
          losses: 0,
          friends: [],
          friendRequests: []
        }
      });
    } else {
      if (memoryUsers.has(cleanNameLower)) {
        return res.status(400).json({ success: false, error: 'Username is already taken! Please log in.' });
      }
      const memUser = {
        username: cleanName,
        displayName: cleanName,
        avatar: '👤',
        bio: 'Ready for Bingo!',
        password,
        playerId,
        trophies: 100,
        wins: 0,
        losses: 0,
        friends: [],
        friendRequests: []
      };
      memoryUsers.set(cleanNameLower, memUser);
      return res.json({
        success: true,
        user: {
          username: cleanName,
          playerId,
          displayName: cleanName,
          avatar: '👤',
          bio: 'Ready for Bingo!',
          trophies: 100,
          wins: 0,
          losses: 0,
          friends: [],
          friendRequests: []
        }
      });
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
      let user = await User.findOne({ username: cleanNameLower });
      if (!user) {
        return res.status(400).json({ success: false, error: '❌ No account found with this username! Please register.' });
      }
      if (user.password !== password) {
        return res.status(400).json({ success: false, error: '❌ Wrong password! Please check and try again.' });
      }
      if (!user.playerId || !user.playerId.startsWith('BGO-')) {
        user.playerId = generate6DigitId();
        await user.save();
      }
      return res.json({
        success: true,
        user: {
          username: user.username,
          playerId: user.playerId,
          displayName: user.displayName || user.username,
          avatar: user.avatar || '👤',
          bio: user.bio || 'Ready for Bingo!',
          trophies: user.trophies,
          wins: user.wins,
          losses: user.losses,
          friends: user.friends || [],
          friendRequests: user.friendRequests || []
        }
      });
    } else {
      let memUser = memoryUsers.get(cleanNameLower);
      if (!memUser) {
        return res.status(400).json({ success: false, error: '❌ No account found with this username! Please register.' });
      }
      if (memUser.password !== password) {
        return res.status(400).json({ success: false, error: '❌ Wrong password! Please check and try again.' });
      }
      if (!memUser.playerId || !memUser.playerId.startsWith('BGO-')) memUser.playerId = generate6DigitId();
      return res.json({
        success: true,
        user: {
          username: memUser.username,
          playerId: memUser.playerId,
          displayName: memUser.displayName || memUser.username,
          avatar: memUser.avatar || '👤',
          bio: memUser.bio || 'Ready for Bingo!',
          trophies: memUser.trophies,
          wins: memUser.wins,
          losses: memUser.losses,
          friends: memUser.friends || [],
          friendRequests: memUser.friendRequests || []
        }
      });
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

  // Register online user presence
  socket.on('user_online', ({ username, playerId }) => {
    if (username) {
      const cleanLower = username.trim().toLowerCase();
      let dName = username;
      let av = '👤';
      if (memoryUsers.has(cleanLower)) {
        const u = memoryUsers.get(cleanLower);
        dName = u.displayName || username;
        av = u.avatar || '👤';
      }
      onlineUsers.set(cleanLower, { socketId: socket.id, playerId, username, displayName: dName, avatar: av });
      socket.usernameLower = cleanLower;
    }
  });

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

    const playerId = generate6DigitId();

    try {
      if (isDbConnected && mongoose.connection.readyState === 1) {
        const existing = await User.findOne({ username: cleanNameLower });
        if (existing) {
          const res = { success: false, error: 'Username already taken! Try logging in.' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const newUser = new User({
          username: cleanNameLower,
          displayName: cleanName,
          avatar: '👤',
          bio: 'Ready for Bingo!',
          password,
          playerId,
          trophies: 100,
          friends: [],
          friendRequests: []
        });
        await newUser.save();
        onlineUsers.set(cleanNameLower, { socketId: socket.id, playerId, username: cleanName, displayName: cleanName, avatar: '👤' });
        socket.usernameLower = cleanNameLower;
        const res = {
          success: true,
          user: {
            username: cleanName,
            playerId: newUser.playerId,
            displayName: cleanName,
            avatar: '👤',
            bio: 'Ready for Bingo!',
            trophies: 100,
            wins: 0,
            losses: 0,
            friends: [],
            friendRequests: []
          }
        };
        if (typeof callback === 'function') callback(res);
      } else {
        if (memoryUsers.has(cleanNameLower)) {
          const res = { success: false, error: 'Username already taken! Try logging in.' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        const memUser = {
          username: cleanName,
          displayName: cleanName,
          avatar: '👤',
          bio: 'Ready for Bingo!',
          password,
          playerId,
          trophies: 100,
          wins: 0,
          losses: 0,
          friends: [],
          friendRequests: []
        };
        memoryUsers.set(cleanNameLower, memUser);
        onlineUsers.set(cleanNameLower, { socketId: socket.id, playerId, username: cleanName, displayName: cleanName, avatar: '👤' });
        socket.usernameLower = cleanNameLower;
        const res = {
          success: true,
          user: {
            username: cleanName,
            playerId,
            displayName: cleanName,
            avatar: '👤',
            bio: 'Ready for Bingo!',
            trophies: 100,
            wins: 0,
            losses: 0,
            friends: [],
            friendRequests: []
          }
        };
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
        let user = await User.findOne({ username: cleanNameLower });
        if (!user || user.password !== password) {
          const res = { success: false, error: 'Invalid username or password!' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        if (!user.playerId || !user.playerId.startsWith('BGO-')) {
          user.playerId = generate6DigitId();
          await user.save();
        }
        onlineUsers.set(cleanNameLower, { socketId: socket.id, playerId: user.playerId, username: user.username, displayName: user.displayName || user.username, avatar: user.avatar || '👤' });
        socket.usernameLower = cleanNameLower;
        const res = {
          success: true,
          user: {
            username: user.username,
            playerId: user.playerId,
            displayName: user.displayName || user.username,
            avatar: user.avatar || '👤',
            bio: user.bio || 'Ready for Bingo!',
            trophies: user.trophies,
            wins: user.wins,
            losses: user.losses,
            friends: user.friends || [],
            friendRequests: user.friendRequests || []
          }
        };
        if (typeof callback === 'function') callback(res);
      } else {
        let memUser = memoryUsers.get(cleanNameLower);
        if (!memUser || memUser.password !== password) {
          const res = { success: false, error: 'Invalid username or password!' };
          if (typeof callback === 'function') callback(res);
          return;
        }
        if (!memUser.playerId || !memUser.playerId.startsWith('BGO-')) memUser.playerId = generate6DigitId();
        onlineUsers.set(cleanNameLower, { socketId: socket.id, playerId: memUser.playerId, username: memUser.username, displayName: memUser.displayName || memUser.username, avatar: memUser.avatar || '👤' });
        socket.usernameLower = cleanNameLower;
        const res = {
          success: true,
          user: {
            username: memUser.username,
            playerId: memUser.playerId,
            displayName: memUser.displayName || memUser.username,
            avatar: memUser.avatar || '👤',
            bio: memUser.bio || 'Ready for Bingo!',
            trophies: memUser.trophies,
            wins: memUser.wins,
            losses: memUser.losses,
            friends: memUser.friends || [],
            friendRequests: memUser.friendRequests || []
          }
        };
        if (typeof callback === 'function') callback(res);
      }
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, error: 'Login error' });
    }
  });

  // Search Player by Username, Display Name, or BGO-XXXXXX Player ID
  socket.on('search_player', async ({ query, currentUsername }, callback) => {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      if (typeof callback === 'function') callback({ success: false, error: 'Please enter a Name or Player ID (e.g. BGO-482951)!' });
      return;
    }

    let foundPlayer = null;
    const cleanQueryLower = cleanQuery.toLowerCase();
    const currentCleanLower = (currentUsername || '').trim().toLowerCase();

    if (isDbConnected && mongoose.connection.readyState === 1) {
      try {
        foundPlayer = await User.findOne({
          $or: [
            { playerId: { $regex: new RegExp(`^${cleanQuery}$`, 'i') } },
            { username: cleanQueryLower },
            { displayName: { $regex: new RegExp(`^${cleanQuery}$`, 'i') } }
          ]
        });
      } catch (e) {}
    }

    if (!foundPlayer) {
      memoryUsers.forEach(u => {
        if (u.playerId.toLowerCase() === cleanQueryLower || u.username.toLowerCase() === cleanQueryLower || (u.displayName && u.displayName.toLowerCase() === cleanQueryLower)) {
          foundPlayer = u;
        }
      });
    }

    if (foundPlayer) {
      const isOnline = onlineUsers.has(foundPlayer.username.toLowerCase());
      const currentUserObj = currentCleanLower ? (memoryUsers.get(currentCleanLower) || (isDbConnected ? await User.findOne({ username: currentCleanLower }) : null)) : null;
      
      const isSelf = currentCleanLower === foundPlayer.username.toLowerCase();
      const isAlreadyFriend = currentUserObj && currentUserObj.friends && currentUserObj.friends.includes(foundPlayer.playerId);
      const isRequestSent = foundPlayer.friendRequests && foundPlayer.friendRequests.some(r => r.senderUsername && r.senderUsername.toLowerCase() === currentCleanLower && r.status === 'pending');
      const isRequestReceived = currentUserObj && currentUserObj.friendRequests && currentUserObj.friendRequests.some(r => r.senderUsername && r.senderUsername.toLowerCase() === foundPlayer.username.toLowerCase() && r.status === 'pending');

      const res = {
        success: true,
        player: {
          username: foundPlayer.username,
          playerId: foundPlayer.playerId,
          displayName: foundPlayer.displayName || foundPlayer.username,
          avatar: foundPlayer.avatar || '👤',
          bio: foundPlayer.bio || 'Ready for Bingo!',
          trophies: foundPlayer.trophies || 100,
          wins: foundPlayer.wins || 0,
          losses: foundPlayer.losses || 0,
          friendsCount: foundPlayer.friends ? foundPlayer.friends.length : 0,
          isOnline,
          isSelf,
          isAlreadyFriend,
          isRequestSent,
          isRequestReceived
        }
      };
      if (typeof callback === 'function') callback(res);
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Player not found! Check Player ID (BGO-XXXXXX) or Name.' });
    }
  });

  // Send Friend Request
  socket.on('send_friend_request', async ({ senderUsername, targetPlayerId }, callback) => {
    if (!senderUsername || !targetPlayerId) return;
    const cleanSender = senderUsername.trim().toLowerCase();
    const cleanTargetId = targetPlayerId.trim().toUpperCase();

    let senderObj = null;
    let targetObj = null;

    if (isDbConnected && mongoose.connection.readyState === 1) {
      try {
        senderObj = await User.findOne({ username: cleanSender });
        targetObj = await User.findOne({ playerId: cleanTargetId });
      } catch (e) {}
    }

    if (!senderObj) senderObj = memoryUsers.get(cleanSender);
    if (!targetObj) {
      memoryUsers.forEach(u => {
        if (u.playerId === cleanTargetId) targetObj = u;
      });
    }

    if (!senderObj || !targetObj) {
      if (typeof callback === 'function') callback({ success: false, error: 'Player not found!' });
      return;
    }

    if (senderObj.username.toLowerCase() === targetObj.username.toLowerCase()) {
      if (typeof callback === 'function') callback({ success: false, error: "You can't add yourself." });
      return;
    }

    if (senderObj.friends && senderObj.friends.includes(targetObj.playerId)) {
      if (typeof callback === 'function') callback({ success: false, error: 'You are already friends!' });
      return;
    }

    // Check if target already sent a request to sender -> Auto Accept!
    const reverseReqIndex = senderObj.friendRequests ? senderObj.friendRequests.findIndex(r => r.senderUsername.toLowerCase() === targetObj.username.toLowerCase() && r.status === 'pending') : -1;
    if (reverseReqIndex !== -1) {
      // Auto accept mutual request
      senderObj.friendRequests[reverseReqIndex].status = 'accepted';
      if (!senderObj.friends.includes(targetObj.playerId)) senderObj.friends.push(targetObj.playerId);
      if (!targetObj.friends.includes(senderObj.playerId)) targetObj.friends.push(senderObj.playerId);

      if (isDbConnected && mongoose.connection.readyState === 1) {
        await senderObj.save();
        await targetObj.save();
      }

      if (onlineUsers.has(targetObj.username.toLowerCase())) {
        const tUser = onlineUsers.get(targetObj.username.toLowerCase());
        io.to(tUser.socketId).emit('friend_request_accepted', {
          friendName: senderObj.displayName || senderObj.username,
          friendPlayerId: senderObj.playerId
        });
      }

      if (typeof callback === 'function') callback({ success: true, isMutual: true, friends: senderObj.friends });
      return;
    }

    // Add friend request to target
    if (!targetObj.friendRequests) targetObj.friendRequests = [];
    const existingReq = targetObj.friendRequests.find(r => r.senderUsername.toLowerCase() === cleanSender && r.status === 'pending');

    if (existingReq) {
      if (typeof callback === 'function') callback({ success: false, error: 'Friend request already pending!' });
      return;
    }

    const newReq = {
      id: `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      senderId: senderObj.playerId,
      senderUsername: senderObj.username,
      senderDisplayName: senderObj.displayName || senderObj.username,
      senderAvatar: senderObj.avatar || '👤',
      receiverId: targetObj.playerId,
      status: 'pending',
      createdAt: new Date()
    };

    targetObj.friendRequests.unshift(newReq);

    if (isDbConnected && mongoose.connection.readyState === 1) {
      try {
        await targetObj.save();
      } catch (e) {}
    }

    // Send real-time socket notification to receiver if online
    if (onlineUsers.has(targetObj.username.toLowerCase())) {
      const tUser = onlineUsers.get(targetObj.username.toLowerCase());
      io.to(tUser.socketId).emit('friend_request_received', newReq);
      console.log(`🔔 Real-time Friend Request sent to ${targetObj.username} from ${senderObj.username}`);
    }

    if (typeof callback === 'function') callback({ success: true, message: `Friend request sent to ${targetObj.displayName || targetObj.username}!` });
  });

  // Respond to Friend Request (Accept / Decline)
  socket.on('respond_friend_request', async ({ username, requestId, accepted }, callback) => {
    if (!username || !requestId) return;
    const cleanUser = username.trim().toLowerCase();

    let userObj = null;
    if (isDbConnected && mongoose.connection.readyState === 1) {
      try { userObj = await User.findOne({ username: cleanUser }); } catch (e) {}
    }
    if (!userObj) userObj = memoryUsers.get(cleanUser);

    if (!userObj || !userObj.friendRequests) {
      if (typeof callback === 'function') callback({ success: false, error: 'Request not found' });
      return;
    }

    const reqIndex = userObj.friendRequests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) {
      if (typeof callback === 'function') callback({ success: false, error: 'Request not found' });
      return;
    }

    const reqItem = userObj.friendRequests[reqIndex];

    if (accepted) {
      reqItem.status = 'accepted';
      let senderObj = null;

      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { senderObj = await User.findOne({ username: reqItem.senderUsername.toLowerCase() }); } catch (e) {}
      }
      if (!senderObj) senderObj = memoryUsers.get(reqItem.senderUsername.toLowerCase());

      if (!userObj.friends) userObj.friends = [];
      if (!userObj.friends.includes(reqItem.senderId)) userObj.friends.push(reqItem.senderId);

      if (senderObj) {
        if (!senderObj.friends) senderObj.friends = [];
        if (!senderObj.friends.includes(userObj.playerId)) senderObj.friends.push(userObj.playerId);
        if (isDbConnected && mongoose.connection.readyState === 1) {
          try { await senderObj.save(); } catch (e) {}
        }
      }

      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { await userObj.save(); } catch (e) {}
      }

      // Notify sender live via socket
      if (onlineUsers.has(reqItem.senderUsername.toLowerCase())) {
        const sUser = onlineUsers.get(reqItem.senderUsername.toLowerCase());
        io.to(sUser.socketId).emit('friend_request_accepted', {
          friendName: userObj.displayName || userObj.username,
          friendPlayerId: userObj.playerId
        });
      }

      if (typeof callback === 'function') callback({ success: true, status: 'accepted', friends: userObj.friends });
    } else {
      reqItem.status = 'declined';
      userObj.friendRequests.splice(reqIndex, 1);
      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { await userObj.save(); } catch (e) {}
      }
      if (typeof callback === 'function') callback({ success: true, status: 'declined', friends: userObj.friends || [] });
    }
  });

  // Remove Friend (Mutual)
  socket.on('remove_friend', async ({ username, friendPlayerId }, callback) => {
    if (!username || !friendPlayerId) return;
    const cleanUser = username.trim().toLowerCase();
    const cleanFriendId = friendPlayerId.trim().toUpperCase();

    let userObj = null;
    let friendObj = null;

    if (isDbConnected && mongoose.connection.readyState === 1) {
      try {
        userObj = await User.findOne({ username: cleanUser });
        friendObj = await User.findOne({ playerId: cleanFriendId });
      } catch (e) {}
    }

    if (!userObj) userObj = memoryUsers.get(cleanUser);
    if (!friendObj) {
      memoryUsers.forEach(u => { if (u.playerId === cleanFriendId) friendObj = u; });
    }

    if (userObj && userObj.friends) {
      userObj.friends = userObj.friends.filter(id => id !== cleanFriendId);
      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { await userObj.save(); } catch (e) {}
      }
    }

    if (friendObj && friendObj.friends) {
      friendObj.friends = friendObj.friends.filter(id => id !== userObj.playerId);
      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { await friendObj.save(); } catch (e) {}
      }
    }

    if (typeof callback === 'function') callback({ success: true, friends: userObj ? userObj.friends : [] });
  });

  // Get Pending Friend Requests List
  socket.on('get_friend_requests', async ({ username }, callback) => {
    if (!username) return;
    const cleanUser = username.trim().toLowerCase();

    let userObj = null;
    if (isDbConnected && mongoose.connection.readyState === 1) {
      try { userObj = await User.findOne({ username: cleanUser }); } catch (e) {}
    }
    if (!userObj) userObj = memoryUsers.get(cleanUser);

    const requests = (userObj && userObj.friendRequests) ? userObj.friendRequests.filter(r => r.status === 'pending') : [];
    if (typeof callback === 'function') callback({ success: true, requests });
  });

  // Get Friends List with Full Profile & Live Online Status
  socket.on('get_friends_list', async ({ username, friendIds }, callback) => {
    const list = [];
    const ids = friendIds || [];

    for (const fId of ids) {
      let fUser = null;
      if (isDbConnected && mongoose.connection.readyState === 1) {
        try { fUser = await User.findOne({ playerId: fId }); } catch (e) {}
      }
      if (!fUser) {
        memoryUsers.forEach(u => {
          if (u.playerId === fId) fUser = u;
        });
      }

      if (fUser) {
        const isOnline = onlineUsers.has(fUser.username.toLowerCase());
        list.push({
          username: fUser.username,
          playerId: fUser.playerId,
          displayName: fUser.displayName || fUser.username,
          avatar: fUser.avatar || '👤',
          bio: fUser.bio || 'Ready for Bingo!',
          trophies: fUser.trophies || 100,
          wins: fUser.wins || 0,
          isOnline
        });
      }
    }

    // Sort online friends first
    list.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    if (typeof callback === 'function') callback({ success: true, friends: list });
  });

  // Send In-Game Room Invite to Online Friend
  socket.on('send_room_invite', async ({ fromUsername, targetUsername, roomCode, mode }, callback) => {
    if (!targetUsername || !roomCode) return;
    const targetClean = targetUsername.trim().toLowerCase();
    const senderClean = (fromUsername || '').trim().toLowerCase();

    let senderObj = memoryUsers.get(senderClean);
    if (!senderObj && isDbConnected && mongoose.connection.readyState === 1) {
      try { senderObj = await User.findOne({ username: senderClean }); } catch (e) {}
    }

    const senderDisplayName = senderObj ? (senderObj.displayName || senderObj.username) : fromUsername;
    const senderAvatar = senderObj ? (senderObj.avatar || '👤') : '👤';

    if (onlineUsers.has(targetClean)) {
      const targetUser = onlineUsers.get(targetClean);
      io.to(targetUser.socketId).emit('room_invite_received', {
        fromUsername: senderDisplayName,
        fromAvatar: senderAvatar,
        roomCode,
        mode: mode || '5x5 Grid Battle',
        expiresAt: Date.now() + 300000 // 5 minutes expiration
      });
      if (typeof callback === 'function') callback({ success: true, message: `Invite sent to ${targetUsername}!` });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: `${targetUsername} is currently offline.` });
    }
  });

  // Socket Event: Update Trophies (+5 / -5 / +1)
  socket.on('update_trophies', async ({ username, delta, modeName }, callback) => {
    const updated = await adjustUserTrophies(username, delta, modeName);
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
    const cleanHostName = (hostName || 'Player 1').trim();
    const hostPlayer = { socketId: socket.id, name: cleanHostName, isHost: true };
    const roomData = {
      roomCode,
      hostName: cleanHostName,
      selectedMode: selectedMode || 'grid-battle',
      players: [hostPlayer],
      currentTurnSocketId: socket.id,
      calledNumbers: [],
      status: 'waiting',
      roundNumber: 1,
      roundId: 'round_1',
      readyPlayers: new Set(),
      rematchState: { requestedBy: null, status: 'none' }
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
    console.log(`🏠 Room Key Generated: ${roomCode} by ${cleanHostName}`);
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

    const cleanPlayerName = (playerName || 'Player 2').trim();
    const maxPlayers = (room.selectedMode === 'grid-battle' || room.selectedMode === 'katam-kutta') ? 2 : 5;
    
    // Check if player is rejoining (same name or socket)
    const existingIndex = room.players.findIndex(p => p.socketId === socket.id || (p.name && p.name.toLowerCase() === cleanPlayerName.toLowerCase()));
    
    if (existingIndex !== -1) {
      // Reconnecting existing player
      room.players[existingIndex].socketId = socket.id;
      room.players[existingIndex].name = cleanPlayerName;
    } else {
      if (room.players.length >= maxPlayers) {
        socket.emit('error_msg', `Room "${cleanCode}" is full! (${room.players.length}/${maxPlayers} players max)`);
        return;
      }
      const newPlayer = { socketId: socket.id, name: cleanPlayerName, isHost: false };
      room.players.push(newPlayer);
    }
    
    memoryRooms.set(cleanCode, room);

    socket.join(cleanCode);
    socket.emit('room_joined', { roomCode: cleanCode, room });
    io.to(cleanCode).emit('player_joined', { room, playerName: cleanPlayerName });
    console.log(`👤 ${cleanPlayerName} joined Room Key ${cleanCode}`);
  });

  // Relay Game Actions with Strict Turn Validation
  socket.on('game_action', ({ roomCode, action }) => {
    const room = memoryRooms.get(roomCode);
    if (!room) {
      socket.emit('error_msg', 'Room not found!');
      return;
    }

    if (!action) return;

    if (action.type === 'CHANGE_MODE') {
      room.selectedMode = action.mode || 'grid-battle';
      io.to(roomCode).emit('game_action_received', {
        type: 'MODE_CHANGED',
        selectedMode: room.selectedMode,
        room
      });
      return;
    }

    if (action.type === 'START_GAME') {
      room.status = 'playing';
      room.calledNumbers = [];
      room.readyPlayers = new Set();
      room.currentTurnSocketId = room.players[0].socketId; // Host starts turn 1
      action.currentTurnSocketId = room.currentTurnSocketId;
      action.roundId = room.roundId || 'round_1';
      action.players = room.players;
      io.to(roomCode).emit('game_action_received', action);
      console.log(`🚀 Match started in Room ${roomCode} (${room.roundId}). Turn: ${room.currentTurnSocketId}`);
      return;
    }

    if (action.type === 'PLAYER_READY') {
      if (!room.readyPlayers) room.readyPlayers = new Set();
      if (action.isReady) {
        room.readyPlayers.add(socket.id);
      } else {
        room.readyPlayers.delete(socket.id);
      }
      action.senderSocketId = socket.id;
      const senderPlayer = room.players.find(p => p.socketId === socket.id);
      action.senderName = senderPlayer ? senderPlayer.name : 'Player';
      action.readyCount = room.readyPlayers.size;
      action.totalPlayers = room.players.length;
      action.roundId = room.roundId || 'round_1';
      io.to(roomCode).emit('game_action_received', action);

      if (room.players.length >= 2 && room.readyPlayers.size >= room.players.length) {
        io.to(roomCode).emit('game_action_received', { type: 'ALL_PLAYERS_READY', roundId: room.roundId });
        console.log(`⚡ All players ready in Room ${roomCode}! (${room.roundId})`);
      }
      return;
    }

    if (action.type === 'GRID_VICTORY') {
      room.status = 'finished';
      action.winnerSocketId = action.winnerSocketId || socket.id;
      const winnerPlayer = room.players.find(p => p.socketId === action.winnerSocketId);
      const loserPlayer = room.players.find(p => p.socketId !== action.winnerSocketId);
      action.winnerName = action.winnerName || (winnerPlayer ? winnerPlayer.name : 'Player');
      action.loserName = loserPlayer ? loserPlayer.name : 'Opponent';
      action.roundId = room.roundId || 'round_1';
      io.to(roomCode).emit('game_action_received', action);
      console.log(`🏆 Match finished in Room ${roomCode}. Winner: ${action.winnerName} (${action.roundId})`);
      return;
    }

    if (action.type === 'REMATCH_REQUEST') {
      const requester = room.players.find(p => p.socketId === socket.id);
      const requesterName = requester ? requester.name : 'Opponent';
      room.rematchState = { requestedBy: socket.id, requesterName, status: 'pending' };
      
      io.to(roomCode).emit('game_action_received', {
        type: 'REMATCH_REQUESTED',
        requesterSocketId: socket.id,
        requesterName,
        roundId: room.roundId
      });
      console.log(`🔄 Rematch requested in Room ${roomCode} by ${requesterName}`);
      return;
    }

    if (action.type === 'REMATCH_RESPONSE') {
      if (action.accepted) {
        room.roundNumber = (room.roundNumber || 1) + 1;
        room.roundId = `round_${room.roundNumber}`;
        room.status = 'waiting_for_ready';
        room.calledNumbers = [];
        room.readyPlayers = new Set();
        room.rematchState = { requestedBy: null, status: 'none' };
        
        io.to(roomCode).emit('game_action_received', {
          type: 'REMATCH_ACCEPTED',
          newRoundId: room.roundId,
          roundNumber: room.roundNumber,
          players: room.players
        });
        console.log(`✅ Rematch ACCEPTED in Room ${roomCode}. New Round: ${room.roundId}`);
      } else {
        const decliner = room.players.find(p => p.socketId === socket.id);
        const declinerName = decliner ? decliner.name : 'Opponent';
        room.rematchState = { requestedBy: null, status: 'declined' };
        
        io.to(roomCode).emit('game_action_received', {
          type: 'REMATCH_DECLINED',
          declinerSocketId: socket.id,
          declinerName,
          roundId: room.roundId
        });
        console.log(`❌ Rematch DECLINED in Room ${roomCode} by ${declinerName}`);
      }
      return;
    }

    if (action.type === 'GRID_CALL_NUMBER') {
      if (room.status !== 'playing') {
        socket.emit('error_msg', 'Game has not started yet or is already finished!');
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
      action.roundId = room.roundId || 'round_1';

      io.to(roomCode).emit('game_action_received', action);
      console.log(`🎯 Room ${roomCode}: Number ${action.number} called by ${socket.id}. Next turn: ${room.currentTurnSocketId}`);
      return;
    }

    // Broadcast generic actions (e.g. Emoji reaction)
    action.roundId = room.roundId || 'round_1';
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
    if (socket.usernameLower) {
      onlineUsers.delete(socket.usernameLower);
    }
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
