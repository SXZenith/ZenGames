'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const { v4: uuidv4 } = require('uuid');

// ── UNO-specific logic (used by dedicated UNO socket events) ──
const unoLogic = require('./gameLogic');

// ── Multi-game registry ──
const { getGame, listGames } = require('./games/gameRegistry');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

const rooms        = {};  // roomCode -> room object
const socketToRoom = {};  // socketId -> { roomCode, playerId }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Send personalised game state to every player in the room */
function broadcastState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const game = getGame(room.gameType);
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('gameState', game.getPublicState(room, p.id));
  }
}

/** Utility: get room + verify it exists and player is in it */
function getRoom(socketId) {
  const info = socketToRoom[socketId];
  if (!info) return {};
  return { info, room: rooms[info.roomCode] };
}

// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ connect', socket.id);

  // ── List available games ─────────────────────────────────────────────────
  socket.on('listGames', () => {
    socket.emit('gameList', listGames());
  });

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('createRoom', ({ playerName, gameType = 'uno', settings = {} }) => {
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });
    let game;
    try { game = getGame(gameType); }
    catch(e) { return socket.emit('error', { message: `Unknown game: ${gameType}` }); }

    let roomCode;
    do { roomCode = generateRoomCode(); } while (rooms[roomCode]);
    const room     = game.createRoom(roomCode, settings);
    const playerId = uuidv4();
    room.players.push({ id:playerId, socketId:socket.id, name:playerName.trim(), isConnected:true, score:0, hand:[], unoCalled:false });
    rooms[roomCode]         = room;
    socketToRoom[socket.id] = { roomCode, playerId };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, playerId, gameType });
    broadcastState(roomCode);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });
    const code = roomCode?.toUpperCase().trim();
    const room = rooms[code];
    if (!room)                    return socket.emit('error', { message: 'Room not found — check the code and try again' });
    if (room.state !== 'waiting') return socket.emit('error', { message: 'Game already in progress' });
    const { meta } = getGame(room.gameType);
    if (room.players.length >= meta.maxPlayers) return socket.emit('error', { message: `Room is full (max ${meta.maxPlayers} players)` });
    if (room.players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase()))
                                  return socket.emit('error', { message: 'That name is already taken in this room' });
    const playerId = uuidv4();
    room.players.push({ id:playerId, socketId:socket.id, name:playerName.trim(), isConnected:true, score:0, hand:[], unoCalled:false });
    socketToRoom[socket.id] = { roomCode:code, playerId };
    socket.join(code);
    socket.emit('roomJoined', { roomCode:code, playerId, gameType:room.gameType });
    broadcastState(code);
  });

  // ── Update Settings (host only, waiting state only) ──────────────────────
  socket.on('updateSettings', (settings) => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.state !== 'waiting') return;
    if (room.players[0]?.id !== info.playerId) return;
    // Merge with existing — don't allow changing gameType via settings
    room.settings = { ...room.settings, ...settings };
    delete room.settings.gameType; // safety: gameType lives on room root only
    broadcastState(info.roomCode);
  });

  // ── Start Game ───────────────────────────────────────────────────────────
  socket.on('startGame', () => {
    const { info, room } = getRoom(socket.id);
    if (!room) return;
    if (room.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can start' });
    const { meta, startGame } = getGame(room.gameType);
    if (room.players.length < meta.minPlayers) return socket.emit('error', { message: `Need at least ${meta.minPlayers} players` });
    if (room.state !== 'waiting') return;

    if (room.gameType === 'uno') {
      // UNO uses its own init path
      room.state = 'playing';
      unoLogic.dealCards(room);
    } else {
      startGame(room);
    }
    broadcastState(info.roomCode);
  });

  // ── Rematch ──────────────────────────────────────────────────────────────
  socket.on('rematch', () => {
    const { info, room } = getRoom(socket.id);
    if (!room) return; // allow exit from any state
    if (room.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can start a rematch' });
    const { rematch } = getGame(room.gameType);

    if (room.gameType === 'uno') {
      // UNO rematch: full fresh game preserving scores
      const fresh = unoLogic.createGame(info.roomCode, room.settings);
      fresh.gameType = 'uno';
      fresh.players  = room.players.map(p => ({ ...p, hand:[], unoCalled:false, roundPoints:0 })); // preserve totalScore for match
      fresh.state    = 'playing';
      rooms[info.roomCode] = fresh;
      unoLogic.dealCards(fresh);
    } else {
      rematch(room); // other games reset in-place
    }
    broadcastState(info.roomCode);
  });

  // ── Return to Lobby (same game, reset scores) ──────────────────────────
  socket.on('returnToLobby', () => {
    const { info, room } = getRoom(socket.id);
    if (!room) return; // allow exit from any state
    if (room.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can return to lobby' });
    const game  = getGame(room.gameType);
    const fresh = game.createRoom(info.roomCode, room.settings);
    fresh.players = room.players.map(p => ({ ...p, hand:[], unoCalled:false, score:0, totalScore:0, roundPoints:0 }));
    fresh.state   = 'waiting';
    rooms[info.roomCode] = fresh;
    broadcastState(info.roomCode);
  });

  // ── Change Game (host only, waiting state) ───────────────────────────────
  // Switches game type in-place — players stay connected, scores preserved.
  socket.on('changeGame', ({ gameType, settings = {} }) => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.state !== 'waiting') return socket.emit('error', { message: 'Can only change game in the lobby' });
    if (room.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can change the game' });
    let game;
    try { game = getGame(gameType); }
    catch(e) { return socket.emit('error', { message: `Unknown game: ${gameType}` }); }
    const fresh = game.createRoom(info.roomCode, settings);
    fresh.players = room.players.map(p => ({ ...p, hand:[], unoCalled:false })); // keep scores
    fresh.state   = 'waiting';
    rooms[info.roomCode] = fresh;
    broadcastState(info.roomCode);
  });

  // ── Generic Game Action (Connect4, Checkers, Ludo) ───────────────────────
  // UNO keeps its dedicated events below for backwards compat.
  socket.on('gameAction', ({ action, payload = {} }) => {
    const { info, room } = getRoom(socket.id);
    if (!room) return;
    if (room.gameType === 'uno') return; // UNO uses its own events
    const game   = getGame(room.gameType);
    const result = game.handleAction(room, info.playerId, action, payload);
    if (result?.error) return socket.emit('error', { message: result.error });
    broadcastState(info.roomCode);
  });

  // ════════════════════════════════════════════════════════════════════════
  // UNO-SPECIFIC EVENTS (unchanged from before — full isolation)
  // ════════════════════════════════════════════════════════════════════════

  socket.on('playCard', ({ cardId, chosenColor }) => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.gameType !== 'uno') return;
    const result = unoLogic.playCard(room, info.playerId, cardId, chosenColor);
    if (result.error) return socket.emit('error', { message: result.error });
    if (result.gameOver) {
      const winner = room.players.find(p => p.name === room.winner);
      if (winner) winner.score = (winner.score||0)+1;
      broadcastState(info.roomCode); return;
    }
    const player = room.players.find(p => p.id === info.playerId);
    if (player?.hand.length === 1 && !player.unoCalled) {
      room.unoVulnerable = { playerId:player.id, playerName:player.name };
      clearTimeout(room._unoTimeout);
      room._unoTimeout = setTimeout(() => {
        if (room.unoVulnerable?.playerId === player.id) { room.unoVulnerable=null; broadcastState(info.roomCode); }
      }, 5000);
    } else if (room.unoVulnerable?.playerId === info.playerId) {
      clearTimeout(room._unoTimeout); room.unoVulnerable=null;
    }
    broadcastState(info.roomCode);
  });

  socket.on('drawCard', () => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.gameType !== 'uno') return;
    const result = unoLogic.forceDraw(room, info.playerId);
    if (result.error) return socket.emit('error', { message: result.error });
    const player = room.players.find(p => p.id === info.playerId);
    if (player) player.unoCalled = false;
    broadcastState(info.roomCode);
  });

  socket.on('passTurn', () => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.gameType !== 'uno') return;
    const result = unoLogic.passTurn(room, info.playerId);
    if (result.error) return socket.emit('error', { message: result.error });
    broadcastState(info.roomCode);
  });

  socket.on('callUno', () => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.gameType !== 'uno') return;
    const player = room.players.find(p => p.id === info.playerId);
    if (!player) return;
    player.unoCalled = true;
    if (room.unoVulnerable?.playerId === player.id) { clearTimeout(room._unoTimeout); room.unoVulnerable=null; }
    broadcastState(info.roomCode);
  });

  socket.on('catchUno', ({ targetPlayerId }) => {
    const { info, room } = getRoom(socket.id);
    if (!room || room.gameType !== 'uno') return;
    if (!room.unoVulnerable || room.unoVulnerable.playerId !== targetPlayerId)
      return socket.emit('error', { message: 'Too late — UNO window has closed' });
    clearTimeout(room._unoTimeout);
    room.unoVulnerable = null;
    unoLogic.drawCards(room, targetPlayerId, 4);
    const target = room.players.find(p => p.id === targetPlayerId);
    room.lastAction = { type:'uno-catch', player:target?.name||'?', count:4 };
    broadcastState(info.roomCode);
  });

  // ── Chat & Reactions (all games) ─────────────────────────────────────────
  socket.on('sendReaction', ({ emoji }) => {
    const { info, room } = getRoom(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === info.playerId);
    if (!player) return;
    io.to(info.roomCode).emit('reaction', { playerId:info.playerId, playerName:player.name, emoji });
  });

  socket.on('chatMessage', ({ text }) => {
    const { info, room } = getRoom(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === info.playerId);
    if (!player) return;
    const trimmed = text?.trim().slice(0,200);
    if (!trimmed) return;
    io.to(info.roomCode).emit('chatMessage', { playerId:info.playerId, playerName:player.name, text:trimmed, ts:Date.now() });
  });

  // ── Disconnect / Reconnect ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('- disconnect', socket.id);
    const { info, room } = getRoom(socket.id);
    if (room) {
      const player = room.players.find(p => p.id === info.playerId);
      if (player) player.isConnected = false;
      broadcastState(info.roomCode);
      setTimeout(() => {
        const r = rooms[info.roomCode];
        if (r && r.players.every(p => !p.isConnected)) {
          clearTimeout(r._unoTimeout);
          delete rooms[info.roomCode];
          console.log('Room cleaned up:', info.roomCode);
        }
      }, 30000);
    }
    delete socketToRoom[socket.id];
  });

  socket.on('reconnectPlayer', ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('error', { message: 'Room has expired' });
    const player = room.players.find(p => p.id === playerId);
    if (!player) return socket.emit('error', { message: 'Player not found' });
    player.socketId    = socket.id;
    player.isConnected = true;
    socketToRoom[socket.id] = { roomCode, playerId };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, playerId, gameType:room.gameType });
    broadcastState(roomCode);
  });
});

app.get('/health', (_, res) => res.json({ ok:true, rooms:Object.keys(rooms).length }));
app.get('/games',  (_, res) => res.json(listGames()));

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`ZenGames server on port ${PORT}`));
