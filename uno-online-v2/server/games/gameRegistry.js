// server/games/gameRegistry.js
'use strict';

const uno        = require('./uno');
const connect4   = require('./connect4');
const checkers   = require('./checkers');
const yahtzee    = require('./yahtzee');
const hangman    = require('./hangman');
const battleship = require('./battleship');
const bounce     = require('./bounce');
const tetris     = require('./tetris');

const GAMES = { uno, connect4, checkers, yahtzee, hangman, battleship, bounce, tetris };

function getGame(type) {
  const game = GAMES[type];
  if (!game) throw new Error(`Unknown game: ${type}`);
  return game;
}
function listGames() { return Object.values(GAMES).map(g => g.meta); }

module.exports = { GAMES, getGame, listGames };
