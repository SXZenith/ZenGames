'use strict';

const meta = {
  id: 'battleship', name: 'Battleship', emoji: '🚢',
  description: "Place your fleet and sink your opponent's ships!",
  players: '2', minPlayers: 2, maxPlayers: 2,
  settings: [
    { key:'boardSize',       label:'Board Size',       type:'chips',  default:10, options:[10,12,15], desc:'Grid dimensions' },
    { key:'shipCount',       label:'Ships',            type:'chips',  default:5,  options:[5,6,7,8],  desc:'Number of ships per player' },
    { key:'includeBoat',     label:'Boat (1×1)',       type:'toggle', default:false, desc:'Add a tiny 1×1 boat ship' },
    { key:'continuousFire',  label:'Continuous Fire',  type:'toggle', default:false, desc:'Keep firing after a hit' },
  ],
};

// Base 5 ships always included
const BASE_SHIPS = [
  { name:'Carrier',    size:5 },
  { name:'Battleship', size:4 },
  { name:'Cruiser',    size:3 },
  { name:'Submarine',  size:3 },
  { name:'Destroyer',  size:2 },
];

function buildShipDefs(settings) {
  const count       = settings.shipCount    || 5;
  const includeBoat = settings.includeBoat  || false;
  const ships = [...BASE_SHIPS.slice(0, Math.min(count, 5))];
  // Extra ships beyond 5
  let extra = count - 5;
  if (extra > 0 && includeBoat) {
    ships.push({ name:'Boat', size:1 });
    extra--;
  }
  for (let i = 0; i < extra; i++) {
    ships.push({ name:`Cruiser${i+2}`, size:3 });
  }
  return ships;
}

function makeGrid(size) {
  return Array.from({ length:size }, () => Array(size).fill(null));
}

function autoPlace(shipDefs, size) {
  const grid = makeGrid(size);
  const ships = [];
  for (const def of shipDefs) {
    let ok=false, attempts=0;
    while (!ok && attempts++<1000) {
      const horiz = def.size===1 ? true : Math.random()<0.5;
      const row = Math.floor(Math.random()*(horiz ? size : size-def.size+1));
      const col = Math.floor(Math.random()*(horiz ? size-def.size+1 : size));
      const cells=[];
      let valid=true;
      for (let i=0;i<def.size;i++) {
        const r=horiz?row:row+i, c=horiz?col+i:col;
        if (r<0||r>=size||c<0||c>=size||grid[r][c]!==null){valid=false;break;}
        // check adjacency
        for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
          if (grid[r+dr]?.[c+dc]!=null){valid=false;break;}
        }
        if (!valid) break;
        cells.push([r,c]);
      }
      if (valid) {
        cells.forEach(([r,c])=>{grid[r][c]=def.name;});
        ships.push({name:def.name, size:def.size, cells, horiz, sunk:false});
        ok=true;
      }
    }
  }
  return {grid,ships};
}

function validatePlacement(ships, shipDefs, size) {
  if (ships.length !== shipDefs.length) return false;
  const grid = makeGrid(size);
  for (const ship of ships) {
    for (const [r,c] of ship.cells) {
      if (r<0||r>=size||c<0||c>=size) return false;
      if (grid[r][c]!==null) return false;
      grid[r][c]=ship.name;
    }
  }
  return true;
}

function createRoom(roomCode, settings={}) {
  return {
    roomCode, gameType:'battleship', state:'waiting',
    players:[], boards:{}, ready:{},
    currentPlayerIndex:0, winner:null,
    settings, minPlayers:2, maxPlayers:2,
  };
}

function getPublicState(room) {
  const size      = room.settings?.boardSize || 10;
  const shipDefs  = buildShipDefs(room.settings||{});
  const publicBoards = {};
  for (const p of room.players) {
    const mine  = room.boards[p.id];
    const oppId = room.players.find(op=>op.id!==p.id)?.id;
    const opp   = oppId ? room.boards[oppId] : null;
    publicBoards[p.id] = {
      myShips:      mine?.ships           || [],
      myShots:      mine?.shots           || [],
      oppShots:     opp?.shots            || [],
      oppSunkShips: opp?.ships.filter(s=>s.sunk) || [],
    };
  }
  return {
    gameType:'battleship', state:room.state,
    publicBoards, currentPlayerIndex:room.currentPlayerIndex,
    players: room.players.map(p=>({
      id:p.id, name:p.name, score:p.score||0,
      avatar:p.avatar||'penguin', isConnected:p.isConnected,
      ready:!!room.ready[p.id],
    })),
    winner:room.winner, settings:room.settings,
    minPlayers:2, maxPlayers:2,
    size, shipDefs,
  };
}

function handleAction(room, playerId, action, payload) {
  const size     = room.settings?.boardSize || 10;
  const shipDefs = buildShipDefs(room.settings||{});

  if (action==='placeShips') {
    const {ships} = payload;
    if (!validatePlacement(ships, shipDefs, size)) return;
    const grid = makeGrid(size);
    ships.forEach(s=>s.cells.forEach(([r,c])=>{grid[r][c]=s.name;}));
    room.boards[playerId] = {grid, ships:ships.map(s=>({...s,sunk:false})), shots:[]};
    return;
  }

  if (action==='ready') {
    if (!room.boards[playerId]) return;
    room.ready[playerId]=true;
    if (room.players.every(p=>room.ready[p.id])) {
      room.state='playing';
      room.currentPlayerIndex=Math.floor(Math.random()*2);
    }
    return;
  }

  if (action==='shoot' && room.state==='playing') {
    const cur = room.players[room.currentPlayerIndex];
    if (cur.id!==playerId) return;
    const {row,col} = payload;
    const oppId = room.players.find(p=>p.id!==playerId)?.id;
    if (!oppId) return;
    const oppBoard = room.boards[oppId];
    if (oppBoard.shots.find(s=>s.row===row&&s.col===col)) return;

    const cellVal = oppBoard.grid[row]?.[col];
    const hit = cellVal!==null;
    oppBoard.shots.push({row,col,hit,shipName:hit?cellVal:null});

    if (hit) {
      const ship = oppBoard.ships.find(s=>s.name===cellVal);
      if (ship) {
        const allHit = ship.cells.every(([r,c])=>
          oppBoard.shots.some(s=>s.row===r&&s.col===c&&s.hit)
        );
        if (allHit) ship.sunk=true;
      }
      if (oppBoard.ships.every(s=>s.sunk)) {
        room.state='finished';
        room.winner=cur.name;
        cur.score=(cur.score||0)+1;
        return;
      }
      // Continuous fire setting
      if (!room.settings?.continuousFire) {
        room.currentPlayerIndex=(room.currentPlayerIndex+1)%2;
      }
      // else same player fires again
    } else {
      room.currentPlayerIndex=(room.currentPlayerIndex+1)%2;
    }
  }
}

function startGame(room) {
  room.state='placing';
  room.boards={};
  room.ready={};
  room.currentPlayerIndex=0;
  room.winner=null;
}

function rematch(room) {
  // Reset to placing state — keep settings and scores
  room.state='placing';
  room.boards={};
  room.ready={};
  room.currentPlayerIndex=0;
  room.winner=null;
}

module.exports = {meta,createRoom,getPublicState,handleAction,startGame,rematch};
