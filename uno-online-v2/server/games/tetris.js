'use strict';

const meta = {
  id: 'tetris',
  name: 'Chaos Tetris',
  emoji: '🧱',
  description: 'Both players control the SAME Tetris board simultaneously. Pure chaos!',
  minPlayers: 2,
  maxPlayers: 4,
  defaultSettings: {
    startSpeed: 800,   // ms per drop
    chaosMode: true,   // both players control simultaneously
    garbageLines: true, // cleared lines send garbage to opponents
  },
};

const PIECES = {
  I: { cells: [[0,0],[1,0],[2,0],[3,0]], color: 'cyan' },
  O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: 'yellow' },
  T: { cells: [[0,0],[1,0],[2,0],[1,1]], color: 'purple' },
  S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: 'green' },
  Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: 'red' },
  J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: 'blue' },
  L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: 'orange' },
};
const PIECE_TYPES = Object.keys(PIECES);
const BOARD_W = 10;
const BOARD_H = 20;

function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return {
    type,
    cells: PIECES[type].cells.map(c => [...c]),
    color: PIECES[type].color,
    x: 3,
    y: 0,
  };
}

function rotateCells(cells) {
  // 90° clockwise rotation around centroid
  const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
  const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
  return cells.map(([x, y]) => [
    Math.round(cx + (y - cy)),
    Math.round(cy - (x - cx)),
  ]);
}

function createBoard() {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(null));
}

function isValid(board, cells, px, py) {
  for (const [cx, cy] of cells) {
    const nx = px + cx, ny = py + cy;
    if (nx < 0 || nx >= BOARD_W || ny >= BOARD_H) return false;
    if (ny >= 0 && board[ny][nx] !== null) return false;
  }
  return true;
}

function lockPiece(board, piece) {
  const b = board.map(r => [...r]);
  for (const [cx, cy] of piece.cells) {
    const nx = piece.x + cx, ny = piece.y + cy;
    if (ny >= 0) b[ny][nx] = piece.color;
  }
  return b;
}

function clearLines(board) {
  const cleared = [];
  const newBoard = board.filter((row, i) => {
    if (row.every(c => c !== null)) { cleared.push(i); return false; }
    return true;
  });
  while (newBoard.length < BOARD_H) newBoard.unshift(Array(BOARD_W).fill(null));
  return { board: newBoard, linesCleared: cleared.length };
}

function addGarbageLines(board, count) {
  const b = board.slice(count);
  for (let i = 0; i < count; i++) {
    const hole = Math.floor(Math.random() * BOARD_W);
    const row = Array(BOARD_W).fill('gray');
    row[hole] = null;
    b.push(row);
  }
  return b;
}

function lineScore(lines) {
  return [0, 100, 300, 500, 800][Math.min(lines, 4)];
}

function createRoom(roomCode, settings = {}) {
  const s = { ...meta.defaultSettings, ...settings };
  return {
    roomCode,
    gameType: 'tetris',
    state: 'waiting',
    settings: s,
    players: [],
    winner: null,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    // shared game state
    board: createBoard(),
    currentPiece: null,
    nextPiece: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    lastDrop: Date.now(),
    dropInterval: s.startSpeed || 800,
    lastActions: [],       // last N actions for display
    comboCount: 0,
    funnyEvents: [],       // e.g. "Curtis went ROGUE!", "CHAOS ROTATION!"
  };
}

function getPublicState(room) {
  return {
    gameType: 'tetris',
    state: room.state,
    board: room.board,
    currentPiece: room.currentPiece,
    nextPiece: room.nextPiece ? { type: room.nextPiece.type, color: room.nextPiece.color, cells: room.nextPiece.cells } : null,
    score: room.score,
    lines: room.lines,
    level: room.level,
    gameOver: room.gameOver,
    winner: room.winner,
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score || 0, isConnected: p.isConnected })),
    lastActions: room.lastActions || [],
    comboCount: room.comboCount || 0,
    funnyEvents: room.funnyEvents || [],
    dropInterval: room.dropInterval,
    settings: room.settings,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.state !== 'playing' || room.gameOver) return;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  const piece = room.currentPiece;
  if (!piece) return;

  let newCells = piece.cells.map(c => [...c]);
  let newX = piece.x, newY = piece.y;
  let moved = false;
  let funnyMsg = null;

  if (action === 'left') {
    if (isValid(room.board, newCells, newX - 1, newY)) { newX--; moved = true; }
  } else if (action === 'right') {
    if (isValid(room.board, newCells, newX + 1, newY)) { newX++; moved = true; }
  } else if (action === 'rotate') {
    const rotated = rotateCells(newCells);
    // wall kick attempts
    for (const [kx, ky] of [[0,0],[1,0],[-1,0],[2,0],[-2,0],[0,-1]]) {
      if (isValid(room.board, rotated, newX + kx, newY + ky)) {
        newCells = rotated; newX += kx; newY += ky; moved = true;
        funnyMsg = Math.random() < 0.15 ? `${player.name} spun it! 🌀` : null;
        break;
      }
    }
  } else if (action === 'softDrop') {
    if (isValid(room.board, newCells, newX, newY + 1)) { newY++; moved = true; }
    else { lockAndSpawn(room, player); return; }
  } else if (action === 'hardDrop') {
    // slam to bottom
    while (isValid(room.board, newCells, newX, newY + 1)) newY++;
    room.currentPiece = { ...piece, cells: newCells, x: newX, y: newY };
    funnyMsg = Math.random() < 0.3 ? `${player.name} SLAMMED IT! 💥` : null;
    lockAndSpawn(room, player);
    if (funnyMsg) pushFunny(room, funnyMsg);
    return;
  } else if (action === 'gravityTick') {
    // server-side gravity
    if (isValid(room.board, newCells, newX, newY + 1)) { newY++; moved = true; }
    else { lockAndSpawn(room, player); return; }
  }

  if (moved) {
    room.currentPiece = { ...piece, cells: newCells, x: newX, y: newY };
  }

  // Log action for display
  const actionLog = { playerId, playerName: player.name, action, ts: Date.now() };
  room.lastActions = [actionLog, ...(room.lastActions || [])].slice(0, 5);

  if (funnyMsg) pushFunny(room, funnyMsg);
}

function pushFunny(room, msg) {
  room.funnyEvents = [{ msg, id: Date.now() + Math.random() }, ...(room.funnyEvents || [])].slice(0, 3);
}

function lockAndSpawn(room, player) {
  const piece = room.currentPiece;
  if (!piece) return;

  // Lock piece onto board
  const locked = lockPiece(room.board, piece);

  // Check for game over BEFORE clearing lines:
  // If any locked cell is in row 0, the stack has reached the top
  const topRowFilled = locked[0].some(c => c !== null);
  const { board: clearedBoard, linesCleared } = clearLines(locked);
  room.board = clearedBoard;

  if (linesCleared > 0) {
    room.comboCount = (room.comboCount || 0) + 1;
    const combo = room.comboCount;
    const pts = lineScore(linesCleared) * room.level * (combo > 1 ? combo : 1);
    room.score += pts;
    room.lines += linesCleared;
    room.level = Math.floor(room.lines / 10) + 1;
    room.dropInterval = Math.max(100, 800 - (room.level - 1) * 70);

    const msgs = {
      1: [`${player.name} cleared a line! 👌`, `Nice one, ${player.name}!`],
      2: [`${player.name} got a double! 🔥`, `TWO LINES by ${player.name}!`],
      3: [`${player.name} TRIPLE! 🤯`, `${player.name} is on FIRE! 🔥🔥🔥`],
      4: [`TETRIS by ${player.name}!!! 🎉🎉🎉`, `${player.name} GOT A TETRIS! 👑`],
    };
    const pool = msgs[Math.min(linesCleared, 4)] || msgs[4];
    pushFunny(room, pool[Math.floor(Math.random() * pool.length)]);
    player.score = (player.score || 0) + pts;
  } else {
    room.comboCount = 0;
  }

  // Spawn next piece
  const next = room.nextPiece || randomPiece();
  const spawnPiece = { ...next, x: 3, y: 0 };
  room.nextPiece = randomPiece();

  // Game over: top row was filled before clear, OR new spawn is blocked
  if (topRowFilled || !isValid(room.board, spawnPiece.cells, spawnPiece.x, spawnPiece.y)) {
    room.gameOver = true;
    room.state = 'finished';
    const sorted = [...room.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    room.winner = sorted[0]?.name || 'Nobody';
    room.currentPiece = null;
    pushFunny(room, `💀 GAME OVER! ${room.winner} wins with ${room.score} pts!`);
    return;
  }

  room.currentPiece = spawnPiece;
}

function startGame(room) {
  room.state = 'playing';
  room.board = createBoard();
  room.currentPiece = randomPiece();
  room.nextPiece = randomPiece();
  room.score = 0;
  room.lines = 0;
  room.level = 1;
  room.gameOver = false;
  room.dropInterval = room.settings.startSpeed || 800;
  room.lastActions = [];
  room.comboCount = 0;
  room.funnyEvents = [];
  room.lastDrop = Date.now();
  room.players.forEach(p => { p.score = 0; });
}

function rematch(room) {
  const fresh = createRoom(room.roomCode, room.settings);
  fresh.players = room.players.map(p => ({ ...p, score: p.score || 0 }));
  return fresh;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
