'use strict';
/**
 * LUDO
 * 2–4 players. Each has 4 tokens starting in their home. Roll dice to move.
 * First to get all 4 tokens to the finish wins.
 * Track positions on 52-square outer track + home columns.
 */

const meta = {
  id:          'ludo',
  name:        'Ludo',
  emoji:       '🎲',
  description: 'Roll dice and race your 4 tokens home — land on opponents to send them back!',
  minPlayers:  2,
  maxPlayers:  4,
  defaultSettings: {
    safeSquares:   true,  // marked squares where pieces can't be captured
    extraTurn6:    true,  // rolling 6 gives an extra roll
    mustUse6:      true,  // need to roll 6 to enter the board
  },
};

// Each player has 4 tokens. Token position:
//  -1 = in home (not yet entered)
//   0–51 = on outer track (relative to player's start)
//  52–57 = in home column
//  58 = finished (at goal)
const GOAL_POS   = 58;
const HOME_COL_START = 52;

// Player start squares on the 52-square track (absolute positions)
const START_SQUARES = { 0:0, 1:13, 2:26, 3:39 };
// Safe squares (absolute on 52-track): player starts + marked squares
const SAFE_ABSOLUTE = new Set([0,8,13,21,26,34,39,47]);

function createTokens() {
  return [-1,-1,-1,-1]; // all 4 start in home yard
}

function createRoom(roomCode, settings={}) {
  return {
    roomCode,
    gameType: 'ludo',
    state:    'waiting',
    players:  [],
    settings: { ...meta.defaultSettings, ...settings },
    tokens:   {},   // playerId -> [pos0,pos1,pos2,pos3]
    colors:   {},   // playerId -> color string
    currentPlayerIndex: 0,
    dice:     null, // last roll
    mustRollAgain: false,
    winner:   null,
    lastAction: null,
  };
}

function rollDice() { return Math.floor(Math.random()*6)+1; }

function getPublicState(room) {
  return {
    roomCode:           room.roomCode,
    gameType:           'ludo',
    state:              room.state,
    minPlayers:         2,
    maxPlayers:         4,
    players:            room.players.map(p=>({id:p.id,name:p.name,isConnected:p.isConnected,score:p.score||0,color:room.colors[p.id]})),
    tokens:             room.tokens,
    currentPlayerIndex: room.currentPlayerIndex,
    dice:               room.dice,
    mustRollAgain:      room.mustRollAgain,
    winner:             room.winner,
    lastAction:         room.lastAction,
    settings:           room.settings,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.gameType !== 'ludo') return { error: 'Wrong game' };
  const pi = room.players.findIndex(p=>p.id===playerId);
  if (pi !== room.currentPlayerIndex) return { error: 'Not your turn' };
  if (room.state !== 'playing') return { error: 'Game not in progress' };

  if (action === 'rollDice') {
    if (room.dice !== null && !room.mustRollAgain) return { error: 'Already rolled — move a token' };
    const roll = rollDice();
    room.dice = roll;
    room.mustRollAgain = false;
    room.lastAction = { type:'roll', player:room.players[pi].name, roll };

    // If no move possible, skip turn
    const tokens = room.tokens[playerId];
    const canMove = tokens.some((pos,ti) => canMoveToken(room, playerId, ti, roll));
    if (!canMove) {
      // Auto-advance turn
      room.dice = null;
      advanceTurn(room);
    }
    return { success:true, roll };
  }

  if (action === 'moveToken') {
    if (room.dice === null) return { error: 'Roll the dice first' };
    const { tokenIndex } = payload;
    const tokens = room.tokens[playerId];
    if (tokenIndex<0||tokenIndex>3) return { error: 'Invalid token' };
    if (!canMoveToken(room, playerId, tokenIndex, room.dice)) return { error: 'Cannot move that token' };

    const roll = room.dice;
    let pos = tokens[tokenIndex];

    // Enter the board
    if (pos===-1) {
      if (roll!==6 && room.settings.mustUse6) return { error: 'Need a 6 to enter the board' };
      pos = 0; // player's start square (relative)
    } else {
      pos += roll;
    }

    // Check if entering home column or goal
    if (pos >= GOAL_POS) {
      pos = GOAL_POS;
    } else if (pos >= HOME_COL_START) {
      // In home column — can't be captured
    } else {
      // Check captures on outer track
      const absPos = toAbsolute(pos, pi);
      if (!SAFE_ABSOLUTE.has(absPos) || !room.settings.safeSquares) {
        room.players.forEach((opp,oi) => {
          if (oi===pi) return;
          room.tokens[opp.id].forEach((opos,oti) => {
            if (opos>=0 && opos<HOME_COL_START) {
              if (toAbsolute(opos,oi)===absPos) {
                room.tokens[opp.id][oti] = -1; // send home
                room.lastAction = { type:'capture', player:room.players[pi].name, victim:opp.name };
              }
            }
          });
        });
      }
    }

    tokens[tokenIndex] = pos;
    room.lastAction = { type:'move', player:room.players[pi].name, tokenIndex, from:tokens[tokenIndex]-roll, to:pos };

    // Check win
    if (tokens.every(p=>p===GOAL_POS)) {
      room.state  = 'finished';
      room.winner = room.players[pi].name;
      room.players[pi].score = (room.players[pi].score||0)+1;
      room.dice = null;
      return { success:true, gameOver:true };
    }

    // Extra turn on 6
    if (roll===6 && room.settings.extraTurn6) {
      room.dice = null;
      room.mustRollAgain = true;
    } else {
      room.dice = null;
      advanceTurn(room);
    }
    return { success:true };
  }

  return { error: `Unknown action: ${action}` };
}

function toAbsolute(relPos, playerIndex) {
  return (START_SQUARES[playerIndex] + relPos) % 52;
}

function canMoveToken(room, playerId, tokenIndex, roll) {
  const pi = room.players.findIndex(p=>p.id===playerId);
  const pos = room.tokens[playerId][tokenIndex];
  if (pos===GOAL_POS) return false;
  if (pos===-1) return !room.settings.mustUse6 || roll===6;
  if (pos+roll > GOAL_POS) return false; // can't overshoot goal (must land exactly or stop at 58)
  // Actually allow landing at 58 from HOME_COL_START range
  return true;
}

function advanceTurn(room) {
  room.currentPlayerIndex = (room.currentPlayerIndex+1) % room.players.length;
}

function startGame(room) {
  room.state  = 'playing';
  room.winner = null;
  room.dice   = null;
  room.mustRollAgain = false;
  room.currentPlayerIndex = 0;
  const colors = ['#ff3b52','#4cc9f0','#06d6a0','#ffd93d'];
  room.players.forEach((p,i) => {
    p.color = colors[i];
    room.colors[p.id] = colors[i];
    room.tokens[p.id] = createTokens();
  });
}

function rematch(room) {
  room.state  = 'playing';
  room.winner = null;
  room.dice   = null;
  room.mustRollAgain = false;
  room.currentPlayerIndex = 0;
  room.players.forEach(p => { room.tokens[p.id] = createTokens(); });
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
