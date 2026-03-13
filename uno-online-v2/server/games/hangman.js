// server/games/hangman.js
'use strict';

const WORDS = [
  'JAVASCRIPT','PYTHON','KEYBOARD','MONITOR','BROWSER','FUNCTION','VARIABLE',
  'ELEPHANT','GIRAFFE','PENGUIN','DOLPHIN','KANGAROO','CHEETAH','CROCODILE',
  'MOUNTAIN','VOLCANO','GLACIER','WATERFALL','PENINSULA','ARCHIPELAGO',
  'HAMBURGER','CHOCOLATE','SPAGHETTI','CROISSANT','AVOCADO','PINEAPPLE',
  'ASTRONAUT','TELESCOPE','SATELLITE','UNIVERSE','GRAVITY','NEBULA',
  'BASKETBALL','VOLLEYBALL','BADMINTON','SKATEBOARD','MARATHON',
  'ADVENTURE','MYSTERY','FANTASY','THRILLER','COMEDY',
  'UMBRELLA','BUTTERFLY','THUNDERSTORM','RAINBOW','AVALANCHE',
  'TREASURE','PIRATE','COMPASS','HORIZON','VOYAGE',
  'DIAMOND','EMERALD','SAPPHIRE','PLATINUM','CRYSTAL',
  'SUBMARINE','HELICOPTER','LOCOMOTIVE','CATAMARAN','ZEPPELIN',
  'SYMPHONY','ORCHESTRA','XYLOPHONE','ACCORDION','TRUMPET',
];

const CATEGORIES = {
  'JAVASCRIPT':'Technology','PYTHON':'Technology','KEYBOARD':'Technology',
  'MONITOR':'Technology','BROWSER':'Technology','FUNCTION':'Technology','VARIABLE':'Technology',
  'ELEPHANT':'Animal','GIRAFFE':'Animal','PENGUIN':'Animal','DOLPHIN':'Animal',
  'KANGAROO':'Animal','CHEETAH':'Animal','CROCODILE':'Animal',
  'MOUNTAIN':'Geography','VOLCANO':'Geography','GLACIER':'Geography',
  'WATERFALL':'Geography','PENINSULA':'Geography','ARCHIPELAGO':'Geography',
  'HAMBURGER':'Food','CHOCOLATE':'Food','SPAGHETTI':'Food',
  'CROISSANT':'Food','AVOCADO':'Food','PINEAPPLE':'Food',
  'ASTRONAUT':'Space','TELESCOPE':'Space','SATELLITE':'Space',
  'UNIVERSE':'Space','GRAVITY':'Space','NEBULA':'Space',
  'BASKETBALL':'Sport','VOLLEYBALL':'Sport','BADMINTON':'Sport',
  'SKATEBOARD':'Sport','MARATHON':'Sport',
};

const MAX_WRONG = 6;

const meta = {
  id: 'hangman', name: 'Hangman', emoji: '🪢',
  description: 'Guess the secret word letter by letter before the man is hanged!',
  players: '2–4', minPlayers: 2, maxPlayers: 4,
  settings: [
    { key: 'hardMode', label: 'Hard Mode', type: 'toggle', default: false,
      desc: 'Only 5 wrong guesses allowed' },
    { key: 'showCategory', label: 'Show Category', type: 'toggle', default: true,
      desc: 'Reveal the word category as a hint' },
  ],
};

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function createRoom(players, settings = {}) {
  const word = pickWord();
  return {
    state: 'playing',
    word,
    category: CATEGORIES[word] || 'General',
    guessed: [],        // letters guessed so far
    wrongGuesses: [],   // wrong letters
    maxWrong: settings.hardMode ? 5 : MAX_WRONG,
    showCategory: settings.showCategory !== false,
    currentGuesserIndex: 0,
    round: 1,
    wordHistory: [],    // { word, winner, guessedBy }
    settings,
    players: players.map(p => ({ ...p, score: p.score || 0 })),
  };
}

function getPublicState(room) {
  const { word, guessed, wrongGuesses, maxWrong, showCategory, category,
          currentGuesserIndex, round, wordHistory, settings, players, state } = room;
  const maskedWord = word.split('').map(c => guessed.includes(c) ? c : '_');
  const solved = maskedWord.every(c => c !== '_');
  const failed = wrongGuesses.length >= maxWrong;
  return {
    state,
    maskedWord,
    category: showCategory ? category : null,
    wordLength: word.length,
    guessed,
    wrongGuesses,
    maxWrong,
    wrongCount: wrongGuesses.length,
    solved,
    failed,
    revealedWord: (solved || failed) ? word : null,
    currentGuesserIndex,
    round,
    wordHistory,
    settings,
    players,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
  };
}

function handleAction(room, playerId, action, payload) {
  if (room.state !== 'playing') return;
  const curPlayer = room.players[room.currentGuesserIndex];
  if (curPlayer.id !== playerId) return; // not your turn

  if (action === 'guess') {
    const letter = (payload.letter || '').toUpperCase().trim();
    if (!letter || !/^[A-Z]$/.test(letter)) return;
    if (room.guessed.includes(letter)) return;

    room.guessed.push(letter);
    if (!room.word.includes(letter)) {
      room.wrongGuesses.push(letter);
    }

    const solved = room.word.split('').every(c => room.guessed.includes(c));
    const failed = room.wrongGuesses.length >= room.maxWrong;

    if (solved) {
      // current guesser wins this round
      curPlayer.score = (curPlayer.score || 0) + 1;
      room.wordHistory.push({ word: room.word, winner: curPlayer.name, result: 'solved' });
      _nextRound(room);
    } else if (failed) {
      room.wordHistory.push({ word: room.word, winner: null, result: 'failed' });
      _nextRound(room);
    } else {
      // rotate to next player
      room.currentGuesserIndex = (room.currentGuesserIndex + 1) % room.players.length;
    }
  }
}

function _nextRound(room) {
  if (room.round >= 5) {
    // 5 rounds → game over
    const topScore = Math.max(...room.players.map(p => p.score || 0));
    const winner = room.players.find(p => (p.score||0) === topScore);
    room.state = 'finished';
    room.winner = winner?.name || 'Nobody';
  } else {
    room.round++;
    room.word = pickWord();
    room.category = CATEGORIES[room.word] || 'General';
    room.guessed = [];
    room.wrongGuesses = [];
    // rotate who starts next round
    room.currentGuesserIndex = (room.currentGuesserIndex + 1) % room.players.length;
  }
}

function startGame(room) {
  // already started in createRoom
}

function rematch(room) {
  const newRoom = createRoom(room.players.map(p => ({ ...p, score: 0 })), room.settings);
  return newRoom;
}

module.exports = { meta, createRoom, getPublicState, handleAction, startGame, rematch };
