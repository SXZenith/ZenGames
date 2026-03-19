// server/games/bounce.js
'use strict';

const COLORS = ['#e63946', '#4cc9f0', '#06d6a0', '#ffd60a']; // red, blue, green, yellow
const COLOR_NAMES = ['red', 'blue', 'green', 'yellow'];
const COURSE_LENGTH = 60; // number of obstacle rows
const FINISH_Y = COURSE_LENGTH + 5;

const meta = {
  id: 'bounce', name: 'Bounce', emoji: '🔵',
  description: 'Race to the top! Switch your color to pass through matching obstacles.',
  players: '2–4', minPlayers: 2, maxPlayers: 4,
  settings: [
    { key: 'courseLength', label: 'Course Length', type: 'chips',
      default: 60, options: [40, 60, 80], desc: 'Number of obstacle rows' },
    { key: 'speed', label: 'Speed', type: 'chips',
      default: 2, options: [1, 2, 3], desc: 'Ball speed multiplier' },
  ],
};

// Generate a seeded random obstacle course
// Each obstacle is { y, gaps: [{color, x, width}] }
// Gaps are the passable sections; rest is solid wall of that color's complement
function generateCourse(length, seed) {
  const rng = mulberry32(seed);
  const obstacles = [];
  for (let i = 0; i < length; i++) {
    const y = i + 3; // start a few rows above player
    // 1-3 colored sections per row, one of which is a gap
    const numSections = 2 + Math.floor(rng() * 2); // 2 or 3
    const sections = [];
    let x = 0;
    const totalWidth = 100; // percentage
    const sectionWidth = totalWidth / numSections;
    const gapIndex = Math.floor(rng() * numSections);
    for (let s = 0; s < numSections; s++) {
      const colorIndex = Math.floor(rng() * COLORS.length);
      sections.push({
        x: x,
        width: sectionWidth,
        color: COLOR_NAMES[colorIndex],
        isGap: s === gapIndex,
      });
      x += sectionWidth;
    }
    obstacles.push({ y, sections });
  }
  return obstacles;
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createRoom(roomCode, settings = {}) {
  const courseLength = settings.courseLength || 60;
  const seed = Math.floor(Math.random() * 999999);
  const course = generateCourse(courseLength, seed);

  return {
    roomCode,
    gameType: 'bounce',
    state: 'waiting',
    course,
    courseLength,
    finishY: courseLength + 3,
    seed,
    playerStates: {},
    finishOrder: [],
    startTime: null,
    settings,
    players: [],
    winner: null,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function getPublicState(room) {
  return {
    gameType: 'bounce',
    state: room.state,
    course: room.course,
    courseLength: room.courseLength,
    finishY: room.finishY,
    playerStates: room.playerStates,
    finishOrder: room.finishOrder,
    startTime: room.startTime,
    players: room.players,
    settings: room.settings,
    winner: room.winner || null,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.state !== 'playing') return;
  const ps = room.playerStates[playerId];
  if (!ps || ps.finished) return;

  if (action === 'progress') {
    // Client reports current y position and color
    const { y, colorIndex } = payload;
    if (typeof y === 'number' && y >= ps.y) {
      ps.y = Math.min(y, room.finishY);
    }
    if (typeof colorIndex === 'number') {
      ps.colorIndex = colorIndex % COLORS.length;
    }

    // Check win
    if (ps.y >= room.finishY && !ps.finished) {
      ps.finished = true;
      ps.finishTime = Date.now() - room.startTime;
      room.finishOrder.push(playerId);

      if (room.finishOrder.length === 1) {
        // First to finish wins
        const winner = room.players.find(p => p.id === playerId);
        if (winner) winner.score = (winner.score || 0) + 1;
        room.state = 'finished';
        room.winner = winner?.name || 'Unknown';
      }
    }
  }

  if (action === 'colorSwitch') {
    // Player tapped to change color
    ps.colorIndex = (ps.colorIndex + 1) % COLORS.length;
  }
}

function startGame(room) {
  room.state = 'playing';
  room.startTime = Date.now();
  room.finishOrder = [];
  room.winner = null;
  room.playerStates = {};
  room.players.forEach(p => {
    room.playerStates[p.id] = {
      y: 0,
      colorIndex: 0,
      finished: false,
      finishTime: null,
    };
  });
}

function rematch(room) {
  const fresh = createRoom(room.roomCode, room.settings);
  fresh.players = room.players.map(p => ({ ...p, score: p.score || 0 }));
  return fresh;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch, COLORS, COLOR_NAMES };
