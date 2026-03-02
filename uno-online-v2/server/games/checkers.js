'use strict';
/**
 * CHECKERS (Draughts)
 * 2 players. 8×8 board. Standard rules: diagonal moves, mandatory captures,
 * kings when reaching back row.
 */

const meta = {
  id:          'checkers',
  name:        'Checkers',
  emoji:       '⚫',
  description: 'Classic draughts — capture all your opponent\'s pieces to win!',
  minPlayers:  2,
  maxPlayers:  2,
  defaultSettings: {
    mandatoryCapture: true,   // must capture if possible
    flyingKings:      false,  // kings can move multiple squares
  },
};

const EMPTY = null;

function initialBoard() {
  // 8×8: rows 0-2 = red (top), rows 5-7 = black (bottom)
  const board = Array.from({length:8}, () => Array(8).fill(EMPTY));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r+c)%2===1) board[r][c] = { color:'red', king:false };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r+c)%2===1) board[r][c] = { color:'black', king:false };
  return board;
}

function createRoom(roomCode, settings={}) {
  return {
    roomCode,
    gameType: 'checkers',
    state:    'waiting',
    players:  [],
    settings: { ...meta.defaultSettings, ...settings },
    board:    initialBoard(),
    currentPlayerIndex: 0,
    winner:   null,
    lastMove: null,
    mustJump: null, // if set, this piece MUST continue jumping
  };
}

function inBounds(r,c) { return r>=0&&r<8&&c>=0&&c<8; }

function getJumps(board, r, c, piece) {
  const jumps = [];
  const dirs = piece.king ? [[-1,-1],[-1,1],[1,-1],[1,1]] : piece.color==='black' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  for (const [dr,dc] of dirs) {
    const mr=r+dr, mc=c+dc, lr=r+dr*2, lc=c+dc*2;
    if (inBounds(lr,lc) && board[mr][mc] && board[mr][mc].color!==piece.color && !board[lr][lc])
      jumps.push({from:[r,c],to:[lr,lc],capture:[mr,mc]});
  }
  return jumps;
}

function getMoves(board, r, c, piece) {
  const moves = [];
  const dirs = piece.king ? [[-1,-1],[-1,1],[1,-1],[1,1]] : piece.color==='black' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  for (const [dr,dc] of dirs) {
    const nr=r+dr, nc=c+dc;
    if (inBounds(nr,nc) && !board[nr][nc]) moves.push({from:[r,c],to:[nr,nc]});
  }
  return moves;
}

function allJumps(board, color) {
  const jumps = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]?.color===color) jumps.push(...getJumps(board,r,c,board[r][c]));
  return jumps;
}

function allMoves(board, color) {
  const moves = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]?.color===color) moves.push(...getMoves(board,r,c,board[r][c]));
  return moves;
}

function getPublicState(room) {
  return {
    roomCode:           room.roomCode,
    gameType:           'checkers',
    state:              room.state,
    minPlayers:         2,
    maxPlayers:         2,
    players:            room.players.map(p=>({id:p.id,name:p.name,isConnected:p.isConnected,score:p.score||0,color:p.color})),
    board:              room.board,
    currentPlayerIndex: room.currentPlayerIndex,
    winner:             room.winner,
    lastMove:           room.lastMove,
    settings:           room.settings,
    mustJump:           room.mustJump,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.gameType !== 'checkers') return { error: 'Wrong game' };
  const pi = room.players.findIndex(p=>p.id===playerId);
  if (pi !== room.currentPlayerIndex) return { error: 'Not your turn' };
  if (room.state !== 'playing') return { error: 'Game not in progress' };

  if (action === 'move') {
    const { from, to } = payload;
    const [fr,fc] = from, [tr,tc] = to;
    const piece = room.board[fr]?.[fc];
    if (!piece) return { error: 'No piece there' };
    if (piece.color !== room.players[pi].color) return { error: 'Not your piece' };

    const color = room.players[pi].color;

    // If mustJump active, must use that piece
    if (room.mustJump && (room.mustJump[0]!==fr || room.mustJump[1]!==fc))
      return { error: 'You must continue the jump chain with the same piece' };

    const jumps    = getJumps(room.board,fr,fc,piece);
    const isJump   = jumps.some(j=>j.to[0]===tr&&j.to[1]===tc);
    const allJ     = allJumps(room.board, color);

    if (!isJump) {
      // Regular move
      if (room.mustJump) return { error: 'You must complete your jump' };
      if (room.settings.mandatoryCapture && allJ.length>0) return { error: 'You must capture' };
      const moves = getMoves(room.board,fr,fc,piece);
      if (!moves.some(m=>m.to[0]===tr&&m.to[1]===tc)) return { error: 'Invalid move' };
      room.board[tr][tc] = piece;
      room.board[fr][fc] = EMPTY;
      room.mustJump = null;
    } else {
      // Jump
      const jump = jumps.find(j=>j.to[0]===tr&&j.to[1]===tc);
      room.board[tr][tc] = piece;
      room.board[fr][fc] = EMPTY;
      room.board[jump.capture[0]][jump.capture[1]] = EMPTY;
      // King promotion
      const backRow = piece.color==='black' ? 0 : 7;
      if (tr===backRow) piece.king=true;
      // Check for chain jump
      const chainJumps = getJumps(room.board,tr,tc,room.board[tr][tc]);
      if (chainJumps.length>0) {
        room.mustJump = [tr,tc];
        room.lastMove = { from,to,player:room.players[pi].name };
        return { success:true }; // same player continues
      }
      room.mustJump = null;
    }

    // King promotion (non-jump)
    if (!room.mustJump) {
      const backRow = piece.color==='black' ? 0 : 7;
      if (tr===backRow) piece.king=true;
    }

    room.lastMove = { from,to,player:room.players[pi].name };

    // Check win: opponent has no pieces or no moves
    const opp = room.players[(pi+1)%2]?.color;
    if (opp) {
      const hasP = room.board.flat().some(c=>c?.color===opp);
      const canM = allJumps(room.board,opp).length>0 || allMoves(room.board,opp).length>0;
      if (!hasP || !canM) {
        room.state  = 'finished';
        room.winner = room.players[pi].name;
        room.players[pi].score = (room.players[pi].score||0)+1;
        return { success:true, gameOver:true };
      }
    }

    if (!room.mustJump) room.currentPlayerIndex = (pi+1)%room.players.length;
    return { success:true };
  }

  return { error: `Unknown action: ${action}` };
}

function startGame(room) {
  room.state  = 'playing';
  room.board  = initialBoard();
  room.winner = null;
  room.lastMove = null;
  room.mustJump = null;
  room.currentPlayerIndex = 0;
  const colors = ['black','red'];
  room.players.forEach((p,i)=>{ p.color=colors[i]; });
}

function rematch(room) {
  room.board  = initialBoard();
  room.state  = 'playing';
  room.winner = null;
  room.lastMove = null;
  room.mustJump = null;
  room.currentPlayerIndex = 0;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
