'use strict';
/**
 * YAHTZEE
 * 1–4 players, turn-based. Each turn: up to 3 rolls, pick dice to keep,
 * then score one of 13 categories. Highest total after 13 rounds wins.
 */

const meta = {
  id:          'yahtzee',
  name:        'Yahtzee',
  emoji:       '🎲',
  description: 'Roll 5 dice up to 3 times and score in 13 categories. Highest total wins!',
  minPlayers:  1,
  maxPlayers:  4,
  defaultSettings: {
    bonusYahtzee: true,   // Extra Yahtzees after first score 100 bonus pts each
    jokerRules:   true,   // Bonus Yahtzee can fill any category as a joker
  },
};

const CATEGORIES = [
  'ones','twos','threes','fours','fives','sixes',
  'threeOfAKind','fourOfAKind','fullHouse',
  'smallStraight','largeStraight','yahtzee','chance',
];

const UPPER_CATS = ['ones','twos','threes','fours','fives','sixes'];

function createRoom(roomCode, settings = {}) {
  return {
    roomCode,
    gameType:  'yahtzee',
    state:     'waiting',
    players:   [],
    settings:  { ...meta.defaultSettings, ...settings },
    // game state — reset on startGame
    currentPlayerIndex: 0,
    rollsLeft:  3,
    dice:       [0, 0, 0, 0, 0],
    held:       [false, false, false, false, false],
    scores:     {},   // { [playerId]: { [category]: number, bonusYahtzees: number } }
    round:      1,
    phase:      'rolling',   // 'rolling' | 'scored' (waiting for next turn roll)
    winner:     null,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function randomDie() { return Math.floor(Math.random() * 6) + 1; }

function scoreCategory(cat, dice) {
  const counts = [0,0,0,0,0,0,0];
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  switch (cat) {
    case 'ones':   return counts[1] * 1;
    case 'twos':   return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours':  return counts[4] * 4;
    case 'fives':  return counts[5] * 5;
    case 'sixes':  return counts[6] * 6;
    case 'threeOfAKind':  return counts.some(c => c >= 3) ? sum : 0;
    case 'fourOfAKind':   return counts.some(c => c >= 4) ? sum : 0;
    case 'fullHouse': {
      const has3 = counts.some(c => c === 3);
      const has2 = counts.some(c => c === 2);
      return has3 && has2 ? 25 : 0;
    }
    case 'smallStraight': {
      const u = [...new Set(dice)].sort().join('');
      return (u.includes('1234') || u.includes('2345') || u.includes('3456')) ? 30 : 0;
    }
    case 'largeStraight': {
      const u = [...new Set(dice)].sort().join('');
      return (u === '12345' || u === '23456') ? 40 : 0;
    }
    case 'yahtzee': return counts.some(c => c === 5) ? 50 : 0;
    case 'chance':  return sum;
    default: return 0;
  }
}

function upperSubtotal(sheet) {
  return UPPER_CATS.reduce((s, c) => s + (sheet[c] ?? 0), 0);
}

function calcTotal(sheet, bonusYahtzee) {
  let total = 0;
  CATEGORIES.forEach(c => { if (sheet[c] != null) total += sheet[c]; });
  if (upperSubtotal(sheet) >= 63) total += 35;
  if (bonusYahtzee && sheet.bonusYahtzees) total += sheet.bonusYahtzees * 100;
  return total;
}

function isYahtzeeRoll(dice) {
  return dice[0] > 0 && dice.every(d => d === dice[0]);
}

function getPublicState(room) {
  const scoreData = {};
  room.players.forEach(p => {
    const sheet = room.scores[p.id] || {};
    scoreData[p.id] = {
      sheet,
      upperSubtotal: upperSubtotal(sheet),
      upperBonus:    upperSubtotal(sheet) >= 63 ? 35 : 0,
      total:         calcTotal(sheet, room.settings.bonusYahtzee),
    };
  });
  return {
    roomCode:           room.roomCode,
    gameType:           'yahtzee',
    state:              room.state,
    winner:             room.winner,
    settings:           room.settings,
    players:            room.players.map(p => ({
      id: p.id, name: p.name, score: p.score || 0, isConnected: p.isConnected,
    })),
    currentPlayerIndex: room.currentPlayerIndex,
    rollsLeft:          room.rollsLeft,
    dice:               room.dice,
    held:               room.held,
    scores:             scoreData,
    round:              room.round,
    phase:              room.phase,
    categories:         CATEGORIES,
    minPlayers:         meta.minPlayers,
    maxPlayers:         meta.maxPlayers,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.state !== 'playing') return { error: 'Game not in progress' };
  const curPlayer = room.players[room.currentPlayerIndex];
  if (!curPlayer || curPlayer.id !== playerId) return { error: 'Not your turn' };

  // ── ROLL ──────────────────────────────────────────────────────────────────
  if (action === 'roll') {
    if (room.rollsLeft <= 0) return { error: 'No rolls left — pick a category to score' };
    // Roll unheld dice
    room.dice = room.dice.map((d, i) => room.held[i] ? d : randomDie());
    room.rollsLeft--;
    room.phase = 'scoring';

    // Bonus Yahtzee check: if already scored yahtzee=50 and this is another yahtzee
    if (isYahtzeeRoll(room.dice) && room.settings.bonusYahtzee) {
      const sheet = room.scores[playerId] || {};
      if (sheet.yahtzee === 50) {
        sheet.bonusYahtzees = (sheet.bonusYahtzees || 0) + 1;
        room.scores[playerId] = sheet;
      }
    }
    return null;
  }

  // ── HOLD ──────────────────────────────────────────────────────────────────
  if (action === 'hold') {
    const { index } = payload;
    if (index < 0 || index > 4) return { error: 'Invalid die index' };
    if (room.phase !== 'scoring') return { error: 'Roll first' };
    if (room.rollsLeft <= 0) return { error: 'No rolls left — pick a category' };
    room.held[index] = !room.held[index];
    return null;
  }

  // ── SCORE ─────────────────────────────────────────────────────────────────
  if (action === 'score') {
    if (room.phase !== 'scoring') return { error: 'Roll first' };
    const { category } = payload;
    if (!CATEGORIES.includes(category)) return { error: 'Invalid category' };
    const sheet = room.scores[playerId] || {};
    if (sheet[category] != null) return { error: 'Already scored that category' };

    sheet[category] = scoreCategory(category, room.dice);
    room.scores[playerId] = sheet;

    // Advance to next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    if (room.currentPlayerIndex === 0) room.round++;

    // Reset for next turn
    room.rollsLeft = 3;
    room.held      = [false, false, false, false, false];
    room.dice      = [0, 0, 0, 0, 0];
    room.phase     = 'rolling';

    // Check game over: all players have scored all 13 categories
    const allDone = room.players.every(p =>
      CATEGORIES.every(c => (room.scores[p.id] || {})[c] != null)
    );

    if (allDone) {
      // Find winner(s)
      let best = -1;
      let winnerName = null;
      room.players.forEach(p => {
        const total = calcTotal(room.scores[p.id] || {}, room.settings.bonusYahtzee);
        if (total > best) { best = total; winnerName = p.name; }
      });
      // Award win score
      room.players.forEach(p => {
        const total = calcTotal(room.scores[p.id] || {}, room.settings.bonusYahtzee);
        if (total === best) p.score = (p.score || 0) + 1;
      });
      room.winner = winnerName;
      room.state  = 'finished';
    }

    return null;
  }

  return { error: `Unknown action: ${action}` };
}

function startGame(room) {
  room.state              = 'playing';
  room.winner             = null;
  room.currentPlayerIndex = 0;
  room.rollsLeft          = 3;
  room.dice               = [0, 0, 0, 0, 0];
  room.held               = [false, false, false, false, false];
  room.round              = 1;
  room.phase              = 'rolling';
  room.scores             = {};
  room.players.forEach(p => { room.scores[p.id] = {}; });
}

function rematch(room) {
  startGame(room);
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
