'use strict';
/**
 * UNO game module
 * Wraps the existing gameLogic.js so it fits the registry interface.
 */
const logic = require('../gameLogic');

const meta = {
  id:          'uno',
  name:        'UNO',
  emoji:       '🃏',
  description: 'Classic card game — match colors and numbers, first to empty their hand wins!',
  minPlayers:  2,
  maxPlayers:  4,
  defaultSettings: logic.DEFAULT_SETTINGS,
};

function createRoom(roomCode, settings = {}) {
  const room = logic.createGame(roomCode, settings);
  room.gameType = 'uno';
  return room;
}

function getPublicState(room, forPlayerId) {
  return { ...logic.getPublicState(room, forPlayerId), gameType: 'uno' };
}

// All UNO actions are handled directly in index.js via existing socket events.
// handleAction is provided for completeness but UNO uses dedicated socket events.
function handleAction(room, playerId, action, payload) {
  if (room.gameType !== 'uno') return { error: 'Wrong game' };
  switch (action) {
    case 'playCard':  return logic.playCard(room, playerId, payload.cardId, payload.chosenColor);
    case 'drawCard':  return logic.forceDraw(room, playerId);
    case 'passTurn':  return logic.passTurn(room, playerId);
    default: return { error: `Unknown UNO action: ${action}` };
  }
}

module.exports = { meta, createRoom, getPublicState, handleAction };
