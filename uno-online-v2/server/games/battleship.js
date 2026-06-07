'use strict';

const meta = {
  id: 'battleship', name: 'Battleship', emoji: '🚢',
  description: "Place your fleet and sink your opponent's ships!",
  players: '2', minPlayers: 2, maxPlayers: 2,
  settings: [],
};

const SHIP_DEFS = [
  { name: 'Carrier',    size: 5, label: 'Carrier (5)' },
  { name: 'Battleship', size: 4, label: 'Battleship (4)' },
  { name: 'Cruiser',    size: 3, label: 'Cruiser (3)' },
  { name: 'Submarine',  size: 3, label: 'Submarine (3)' },
  { name: 'Destroyer',  size: 2, label: 'Destroyer (2)' },
];
const SIZE = 10;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function autoPlace() {
  const grid = emptyGrid();
  const ships = [];
  for (const def of SHIP_DEFS) {
    let ok = false, attempts = 0;
    while (!ok && attempts++ < 500) {
      const horiz = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horiz ? SIZE : SIZE - def.size + 1));
      const col = Math.floor(Math.random() * (horiz ? SIZE - def.size + 1 : SIZE));
      const cells = [];
      let valid = true;
      for (let i = 0; i < def.size; i++) {
        const r = horiz ? row : row + i;
        const c = horiz ? col + i : col;
        if (grid[r]?.[c] !== null) { valid = false; break; }
        // check adjacency
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (grid[r+dr]?.[c+dc] != null) { valid = false; break; }
        }
        if (!valid) break;
        cells.push([r, c]);
      }
      if (valid) {
        cells.forEach(([r,c]) => { grid[r][c] = def.name; });
        ships.push({ name: def.name, size: def.size, cells, horiz, sunk: false });
        ok = true;
      }
    }
  }
  return { grid, ships };
}

function validatePlacement(ships) {
  if (ships.length !== SHIP_DEFS.length) return false;
  const grid = emptyGrid();
  for (const ship of ships) {
    for (const [r,c] of ship.cells) {
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
      if (grid[r][c] !== null) return false;
      grid[r][c] = ship.name;
    }
  }
  return true;
}

function createRoom(roomCode, settings = {}) {
  return {
    roomCode, gameType: 'battleship', state: 'waiting',
    players: [], boards: {}, ready: {},
    currentPlayerIndex: 0, winner: null,
    settings, minPlayers: 2, maxPlayers: 2,
  };
}

function getPublicState(room) {
  const publicBoards = {};
  for (const p of room.players) {
    const mine = room.boards[p.id];
    const oppId = room.players.find(op => op.id !== p.id)?.id;
    const opp  = oppId ? room.boards[oppId] : null;
    publicBoards[p.id] = {
      myShips:   mine?.ships  || [],
      myShots:   mine?.shots  || [],
      oppShots:  opp?.shots   || [],
      // only reveal sunk opp ships
      oppSunkShips: opp?.ships.filter(s => s.sunk) || [],
    };
  }
  return {
    gameType: 'battleship', state: room.state,
    publicBoards, currentPlayerIndex: room.currentPlayerIndex,
    players: room.players.map(p => ({
      id: p.id, name: p.name, score: p.score||0,
      avatar: p.avatar||'penguin', isConnected: p.isConnected,
      ready: !!room.ready[p.id],
    })),
    winner: room.winner, settings: room.settings,
    minPlayers: 2, maxPlayers: 2, size: SIZE,
  };
}

function handleAction(room, playerId, action, payload) {
  // Ship placement
  if (action === 'placeShips') {
    const { ships } = payload;
    if (!validatePlacement(ships)) return;
    const grid = emptyGrid();
    ships.forEach(s => s.cells.forEach(([r,c]) => { grid[r][c] = s.name; }));
    room.boards[playerId] = { grid, ships: ships.map(s=>({...s, sunk:false})), shots: [] };
    return;
  }

  if (action === 'ready') {
    if (!room.boards[playerId]) return; // must place ships first
    room.ready[playerId] = true;
    // Both ready → start
    if (room.players.every(p => room.ready[p.id])) {
      room.state = 'playing';
      room.currentPlayerIndex = Math.floor(Math.random() * 2);
    }
    return;
  }

  if (action === 'shoot' && room.state === 'playing') {
    const cur = room.players[room.currentPlayerIndex];
    if (cur.id !== playerId) return;
    const { row, col } = payload;
    const oppId = room.players.find(p => p.id !== playerId)?.id;
    if (!oppId) return;
    const oppBoard = room.boards[oppId];
    if (oppBoard.shots.find(s => s.row===row && s.col===col)) return; // duplicate

    const cellVal = oppBoard.grid[row]?.[col];
    const hit = cellVal !== null;
    oppBoard.shots.push({ row, col, hit, shipName: hit ? cellVal : null });

    if (hit) {
      const ship = oppBoard.ships.find(s => s.name === cellVal);
      if (ship) {
        const allHit = ship.cells.every(([r,c]) =>
          oppBoard.shots.some(s => s.row===r && s.col===c && s.hit)
        );
        if (allHit) ship.sunk = true;
      }
      if (oppBoard.ships.every(s => s.sunk)) {
        room.state = 'finished';
        room.winner = cur.name;
        cur.score = (cur.score||0) + 1;
        return;
      }
      // Hit → same player goes again (real battleship rules)
    } else {
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % 2;
    }
  }
}

function startGame(room) {
  room.state = 'placing'; // placement phase first
  room.boards = {};
  room.ready = {};
  room.currentPlayerIndex = 0;
  room.winner = null;
}

function rematch(room) {
  const fresh = createRoom(room.roomCode, room.settings);
  fresh.players = room.players.map(p => ({ ...p, score: p.score||0 }));
  return fresh;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
