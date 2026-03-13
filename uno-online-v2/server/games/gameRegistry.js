// server/games/gameRegistry.js
'use strict';

const uno        = require('./uno');
const connect4   = require('./connect4');
const checkers   = require('./checkers');
const yahtzee    = require('./yahtzee');
const hangman    = require('./hangman');
const battleship = require('./battleship');
const bounce     = require('./bounce');

const GAMES = { uno, connect4, checkers, yahtzee, hangman, battleship, bounce };

function getGame(type) { return GAMES[type]; }
function listGames()   { return Object.values(GAMES).map(g => g.meta); }

module.exports = { GAMES, getGame, listGames };
