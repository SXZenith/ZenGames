'use strict';
/**
 * GAME REGISTRY
 * Each game must export: { meta, createRoom, getPublicState, handleAction }
 * 
 * meta: { id, name, minPlayers, maxPlayers, defaultSettings }
 * createRoom(roomCode, settings): returns initial room object
 * getPublicState(room, forPlayerId): returns state safe to send to that player
 * handleAction(room, playerId, action, payload): returns { error? } or mutates room
 *
 * The server never calls game-specific logic directly — it always goes through
 * this registry, keyed by room.gameType. This guarantees zero cross-game bleed.
 */

const uno      = require('./uno');
const connect4 = require('./connect4');
const checkers = require('./checkers');
const ludo     = require('./ludo');

const GAMES = { uno, connect4, checkers, ludo };

function getGame(gameType) {
  const g = GAMES[gameType];
  if (!g) throw new Error(`Unknown game type: "${gameType}"`);
  return g;
}

function listGames() {
  return Object.values(GAMES).map(g => g.meta);
}

module.exports = { getGame, listGames, GAMES };
