// server/games/battleship.js
'use strict';

const meta = {
  id: 'battleship', name: 'Battleship', emoji: '🚢',
  description: 'Place your fleet and sink your opponent\'s ships!',
  players: '2', minPlayers: 2, maxPlayers: 2,
  settings: [
    { key: 'gridSize', label: 'Grid Size', type: 'chips', default: 10,
      options: [8, 10], desc: '8×8 or 10×10 grid' },
    { key: 'showMisses', label: 'Show Misses', type: 'toggle', default: true,
      desc: 'Display missed shots on the board' },
  ],
};

const SHIPS_10 = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Submarine',  size: 3 },
  { name: 'Destroyer',  size: 2 },
];
const SHIPS_8 = [
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Submarine',  size: 3 },
  { name: 'Destroyer',  size: 2 },
];

function emptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function autoPlace(ships, size) {
  const grid = emptyGrid(size);
  const placed = [];
  for (const ship of ships) {
    let placed_ok = false;
    let attempts = 0;
    while (!placed_ok && attempts < 200) {
      attempts++;
      const horiz = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horiz ? size : size - ship.size + 1));
      const col = Math.floor(Math.random() * (horiz ? size - ship.size + 1 : size));
      const cells = [];
      let ok = true;
      for (let i = 0; i < ship.size; i++) {
        const r = horiz ? row : row + i;
        const c = horiz ? col + i : col;
        if (grid[r][c] !== null) { ok = false; break; }
        cells.push([r, c]);
      }
      if (ok) {
        cells.forEach(([r, c]) => { grid[r][c] = ship.name; });
        placed.push({ ...ship, cells, horiz, sunk: false });
        placed_ok = true;
      }
    }
  }
  return { grid, ships: placed };
}

function createRoom(players, settings = {}) {
  const size = settings.gridSize || 10;
  const shipDefs = size === 8 ? SHIPS_8 : SHIPS_10;

  const boards = {};
  for (const p of players) {
    const { grid, ships } = autoPlace(shipDefs, size);
    boards[p.id] = {
      grid,       // what's placed
      ships,      // ship objects with cells + sunk flag
      shots: [],  // { row, col, hit }
    };
  }

  return {
    state: 'playing',
    phase: 'battle', // could add 'placement' phase later
    size,
    boards,
    currentPlayerIndex: 0,
    players: players.map(p => ({ ...p, score: p.score || 0 })),
    settings,
    winner: null,
  };
}

function getPublicState(room) {
  const { state, size, boards, currentPlayerIndex, players, settings, winner } = room;
  // Build per-player view: own full board + opponent's shot-result board only
  const publicBoards = {};
  for (const p of players) {
    const myBoard = boards[p.id];
    const oppId = players.find(op => op.id !== p.id)?.id;
    const oppBoard = oppId ? boards[oppId] : null;

    publicBoards[p.id] = {
      myGrid: myBoard.grid,
      myShips: myBoard.ships,
      myShots: myBoard.shots,
      oppShots: oppBoard ? oppBoard.shots : [],
      oppShips: oppBoard ? oppBoard.ships.filter(s => s.sunk) : [], // only reveal sunk ships
    };
  }

  return {
    state,
    size,
    publicBoards,
    currentPlayerIndex,
    players,
    settings,
    winner,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.state !== 'playing') return;
  const curPlayer = room.players[room.currentPlayerIndex];
  if (curPlayer.id !== playerId) return;

  if (action === 'shoot') {
    const { row, col } = payload;
    const oppId = room.players.find(p => p.id !== playerId)?.id;
    if (!oppId) return;
    const oppBoard = room.boards[oppId];
    if (oppBoard.shots.find(s => s.row === row && s.col === col)) return; // already shot

    const cellValue = oppBoard.grid[row]?.[col];
    const hit = cellValue !== null;
    oppBoard.shots.push({ row, col, hit, shipName: hit ? cellValue : null });

    if (hit) {
      // check if ship sunk
      const ship = oppBoard.ships.find(s => s.name === cellValue);
      if (ship) {
        const allHit = ship.cells.every(([r,c]) => oppBoard.shots.find(s=>s.row===r&&s.col===c&&s.hit));
        if (allHit) ship.sunk = true;
      }
      // check win
      const allSunk = oppBoard.ships.every(s => s.sunk);
      if (allSunk) {
        room.state = 'finished';
        room.winner = curPlayer.name;
        curPlayer.score = (curPlayer.score || 0) + 1;
        return;
      }
      // hit → same player shoots again
    } else {
      // miss → next player
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    }
  }
}

function startGame(room) {}

function rematch(room) {
  return createRoom(room.players.map(p => ({ ...p, score: p.score || 0 })), room.settings);
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
