'use strict';
/**
 * CONNECT 4
 * 2 players. 7 columns × 6 rows. First to connect 4 in a row (horiz/vert/diag) wins.
 */

const ROWS = 6;
const COLS = 7;

const meta = {
  id:          'connect4',
  name:        'Connect 4',
  emoji:       '🔴',
  description: 'Drop discs to connect 4 in a row — horizontally, vertically, or diagonally!',
  minPlayers:  2,
  maxPlayers:  2,
  defaultSettings: {
    allowUndo: false,   // players can undo their last move
    winStreak: 4,       // could be 3 or 5 for variants
  },
};

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createRoom(roomCode, settings = {}) {
  return {
    roomCode,
    gameType: 'connect4',
    state:    'waiting',
    players:  [],
    settings: { ...meta.defaultSettings, ...settings },
    board:    emptyBoard(),
    currentPlayerIndex: 0,
    winner:   null,
    lastMove: null,
    scores:   {},
    direction: 1,
  };
}

function dropDisc(board, col, color) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][col]) { board[row][col] = color; return row; }
  }
  return -1; // column full
}

function checkWin(board, row, col, streak) {
  const color = board[row][col];
  if (!color) return false;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let count = 1;
    for (let i = 1; i < streak; i++) { const r=row+dr*i,c=col+dc*i; if(r<0||r>=ROWS||c<0||c>=COLS||board[r][c]!==color) break; count++; }
    for (let i = 1; i < streak; i++) { const r=row-dr*i,c=col-dc*i; if(r<0||r>=ROWS||c<0||c>=COLS||board[r][c]!==color) break; count++; }
    if (count >= streak) return true;
  }
  return false;
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== null);
}

function getPublicState(room, forPlayerId) {
  return {
    roomCode:           room.roomCode,
    gameType:           'connect4',
    state:              room.state,
    minPlayers:         2,
    maxPlayers:         2,
    players:            room.players.map(p => ({ id:p.id, name:p.name, isConnected:p.isConnected, score:p.score||0, color:p.color })),
    board:              room.board,
    currentPlayerIndex: room.currentPlayerIndex,
    winner:             room.winner,
    lastMove:           room.lastMove,
    settings:           room.settings,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.gameType !== 'connect4') return { error: 'Wrong game' };
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== room.currentPlayerIndex) return { error: 'Not your turn' };
  if (room.state !== 'playing') return { error: 'Game not in progress' };

  if (action === 'dropDisc') {
    const { col } = payload;
    if (col < 0 || col >= COLS) return { error: 'Invalid column' };
    const row = dropDisc(room.board, col, room.players[playerIndex].color);
    if (row === -1) return { error: 'Column is full' };
    room.lastMove = { player: room.players[playerIndex].name, col, row, color: room.players[playerIndex].color };
    if (checkWin(room.board, row, col, room.settings.winStreak)) {
      room.state  = 'finished';
      room.winner = room.players[playerIndex].name;
      room.players[playerIndex].score = (room.players[playerIndex].score || 0) + 1;
      return { success: true, gameOver: true };
    }
    if (isBoardFull(room.board)) {
      room.state  = 'finished';
      room.winner = 'draw';
      return { success: true, gameOver: true, draw: true };
    }
    // Advance turn
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    return { success: true };
  }

  return { error: `Unknown action: ${action}` };
}

function startGame(room) {
  room.state  = 'playing';
  room.board  = emptyBoard();
  room.winner = null;
  room.lastMove = null;
  room.currentPlayerIndex = 0;
  // Assign colors
  const colors = ['#ff3b52','#ffd93d'];
  room.players.forEach((p,i) => { p.color = colors[i]; });
}

function rematch(room) {
  room.board  = emptyBoard();
  room.state  = 'playing';
  room.winner = null;
  room.lastMove = null;
  room.currentPlayerIndex = 0;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
