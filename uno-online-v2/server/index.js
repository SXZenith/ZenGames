'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const { v4: uuidv4 } = require('uuid');
const {
  createGame, dealCards, playCard, forceDraw, passTurn,
  drawCards, getPublicState, DEFAULT_SETTINGS,
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

const rooms        = {};  // roomCode -> game
const socketToRoom = {};  // socketId -> { roomCode, playerId }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function broadcastState(roomCode) {
  const game = rooms[roomCode];
  if (!game) return;
  for (const p of game.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('gameState', getPublicState(game, p.id));
  }
}

io.on('connection', (socket) => {
  console.log('+ connect', socket.id);

  socket.on('createRoom', ({ playerName }) => {
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });
    let roomCode;
    do { roomCode = generateRoomCode(); } while (rooms[roomCode]);
    const game = createGame(roomCode);
    const playerId = uuidv4();
    game.players.push({ id: playerId, socketId: socket.id, name: playerName.trim(), hand: [], isConnected: true, score: 0, unoCalled: false });
    rooms[roomCode] = game;
    socketToRoom[socket.id] = { roomCode, playerId };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, playerId });
    broadcastState(roomCode);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });
    const code = roomCode?.toUpperCase().trim();
    const game = rooms[code];
    if (!game)                    return socket.emit('error', { message: 'Room not found — check the code and try again' });
    if (game.state !== 'waiting') return socket.emit('error', { message: 'Game already in progress' });
    if (game.players.length >= 4) return socket.emit('error', { message: 'Room is full (max 4 players)' });
    if (game.players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase()))
                                  return socket.emit('error', { message: 'That name is already taken in this room' });
    const playerId = uuidv4();
    game.players.push({ id: playerId, socketId: socket.id, name: playerName.trim(), hand: [], isConnected: true, score: 0, unoCalled: false });
    socketToRoom[socket.id] = { roomCode: code, playerId };
    socket.join(code);
    socket.emit('roomJoined', { roomCode: code, playerId });
    broadcastState(code);
  });

  socket.on('updateSettings', (settings) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game || game.state !== 'waiting') return;
    if (game.players[0]?.id !== info.playerId) return;
    game.settings = { ...DEFAULT_SETTINGS, ...settings };
    broadcastState(info.roomCode);
  });

  socket.on('startGame', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    if (game.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can start' });
    if (game.players.length < 2)               return socket.emit('error', { message: 'Need at least 2 players' });
    if (game.state !== 'waiting')              return;
    game.state = 'playing';
    dealCards(game);
    broadcastState(info.roomCode);
  });

  socket.on('rematch', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game || game.state !== 'finished') return;
    if (game.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can start a rematch' });
    const fresh = createGame(info.roomCode, game.settings);
    fresh.players = game.players.map(p => ({ ...p, hand: [], unoCalled: false }));
    fresh.state = 'playing';
    rooms[info.roomCode] = fresh;
    dealCards(fresh);
    broadcastState(info.roomCode);
  });

  socket.on('playCard', ({ cardId, chosenColor }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const result = playCard(game, info.playerId, cardId, chosenColor);
    if (result.error) return socket.emit('error', { message: result.error });

    if (result.gameOver) {
      const winner = game.players.find(p => p.name === game.winner);
      if (winner) winner.score = (winner.score || 0) + 1;
      broadcastState(info.roomCode);
      return;
    }

    // UNO vulnerability: just played down to 1 card without calling UNO
    const player = game.players.find(p => p.id === info.playerId);
    if (player?.hand.length === 1 && !player.unoCalled) {
      game.unoVulnerable = { playerId: player.id, playerName: player.name };
      clearTimeout(game._unoTimeout);
      game._unoTimeout = setTimeout(() => {
        if (game.unoVulnerable?.playerId === player.id) {
          game.unoVulnerable = null;
          broadcastState(info.roomCode);
        }
      }, 5000);
    } else {
      // Clear stale vulnerability if hand is no longer at 1
      if (game.unoVulnerable?.playerId === info.playerId) {
        clearTimeout(game._unoTimeout);
        game.unoVulnerable = null;
      }
    }
    broadcastState(info.roomCode);
  });

  socket.on('drawCard', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const result = forceDraw(game, info.playerId);
    if (result.error) return socket.emit('error', { message: result.error });
    const player = game.players.find(p => p.id === info.playerId);
    if (player) player.unoCalled = false;
    broadcastState(info.roomCode);
  });

  socket.on('passTurn', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const result = passTurn(game, info.playerId);
    if (result.error) return socket.emit('error', { message: result.error });
    broadcastState(info.roomCode);
  });

  socket.on('callUno', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const player = game.players.find(p => p.id === info.playerId);
    if (!player) return;
    player.unoCalled = true;
    if (game.unoVulnerable?.playerId === player.id) {
      clearTimeout(game._unoTimeout);
      game.unoVulnerable = null;
    }
    broadcastState(info.roomCode);
  });

  socket.on('catchUno', ({ targetPlayerId }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    if (!game.unoVulnerable || game.unoVulnerable.playerId !== targetPlayerId)
      return socket.emit('error', { message: 'Too late — UNO window has closed' });
    clearTimeout(game._unoTimeout);
    game.unoVulnerable = null;
    drawCards(game, targetPlayerId, 4);
    const target = game.players.find(p => p.id === targetPlayerId);
    game.lastAction = { type: 'uno-catch', player: target?.name || '?', count: 4 };
    broadcastState(info.roomCode);
  });

  // Return to lobby after game — resets scores, goes back to waiting state
  socket.on('returnToLobby', () => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game || game.state !== 'finished') return;
    if (game.players[0]?.id !== info.playerId) return socket.emit('error', { message: 'Only the host can return to lobby' });
    // Reset game to waiting state, wipe scores, keep players
    const fresh = createGame(info.roomCode, game.settings);
    fresh.players = game.players.map(p => ({ ...p, hand: [], unoCalled: false, score: 0 }));
    fresh.state = 'waiting';
    rooms[info.roomCode] = fresh;
    broadcastState(info.roomCode);
  });

  // Chat message — broadcast to all players in the room
  socket.on('chatMessage', ({ text }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const player = game.players.find(p => p.id === info.playerId);
    if (!player) return;
    const trimmed = text?.trim().slice(0, 200); // max 200 chars
    if (!trimmed) return;
    io.to(info.roomCode).emit('chatMessage', {
      playerId:   info.playerId,
      playerName: player.name,
      text:       trimmed,
      ts:         Date.now(),
    });
  });

  socket.on('sendReaction', ({ emoji }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (!game) return;
    const player = game.players.find(p => p.id === info.playerId);
    if (!player) return;
    io.to(info.roomCode).emit('reaction', { playerId: info.playerId, playerName: player.name, emoji });
  });

  socket.on('disconnect', () => {
    console.log('- disconnect', socket.id);
    const info = socketToRoom[socket.id];
    if (!info) return;
    const game = rooms[info.roomCode];
    if (game) {
      const player = game.players.find(p => p.id === info.playerId);
      if (player) player.isConnected = false;
      broadcastState(info.roomCode);
      setTimeout(() => {
        const g = rooms[info.roomCode];
        if (g && g.players.every(p => !p.isConnected)) {
          clearTimeout(g._unoTimeout);
          delete rooms[info.roomCode];
          console.log('Room cleaned up:', info.roomCode);
        }
      }, 30000);
    }
    delete socketToRoom[socket.id];
  });

  socket.on('reconnectPlayer', ({ roomCode, playerId }) => {
    const game = rooms[roomCode];
    if (!game) return socket.emit('error', { message: 'Room has expired' });
    const player = game.players.find(p => p.id === playerId);
    if (!player) return socket.emit('error', { message: 'Player not found' });
    player.socketId    = socket.id;
    player.isConnected = true;
    socketToRoom[socket.id] = { roomCode, playerId };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, playerId });
    broadcastState(roomCode);
  });
});

app.get('/health', (_, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }));
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`UNO server on port ${PORT}`));
