const COLORS = ['red', 'yellow', 'green', 'blue'];
const VALUES = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (const value of VALUES) {
      deck.push({ color, value, id: `${color}-${value}-a` });
      if (value !== '0') deck.push({ color, value, id: `${color}-${value}-b` });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild', id: `wild-${i}` });
    deck.push({ color: 'wild', value: 'wild4', id: `wild4-${i}` });
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DEFAULT_SETTINGS = {
  pickTimer: 0,          // seconds, 0 = no timer
  stackDraw2: true,      // +2 can stack on +2
  stackDraw4: true,      // +4 can stack on +4
  drawUntilPlayable: false, // keep drawing until you get a playable card
};

function createGame(roomCode, settings = {}) {
  const deck = createDeck();
  return {
    roomCode,
    deck,
    discard: [],
    players: [],
    currentPlayerIndex: 0,
    direction: 1,
    state: 'waiting',
    winner: null,
    pendingDraw: 0,
    pendingDrawType: null, // 'draw2' or 'wild4' — tracks what started the stack
    currentColor: null,
    lastAction: null,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    unoVulnerable: null,
  };
}

function dealCards(game) {
  let topCard;
  do { topCard = game.deck.pop(); } while (topCard.color === 'wild');
  game.discard.push(topCard);
  game.currentColor = topCard.color;
  for (const player of game.players) {
    player.hand = [];
    for (let i = 0; i < 7; i++) player.hand.push(game.deck.pop());
  }
}

function drawCards(game, playerId, count) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return [];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (game.deck.length === 0) reshuffleDeck(game);
    if (game.deck.length > 0) {
      const card = game.deck.pop();
      player.hand.push(card);
      drawn.push(card);
    }
  }
  return drawn;
}

function reshuffleDeck(game) {
  const top = game.discard.pop();
  game.deck = shuffle(game.discard);
  game.discard = [top];
}

function canPlay(card, topCard, currentColor, game) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function canStack(card, game) {
  if (game.pendingDraw === 0) return true; // no stack in progress
  const type = game.pendingDrawType;
  if (type === 'draw2' && card.value === 'draw2' && game.settings.stackDraw2) return true;
  if (type === 'wild4' && card.value === 'wild4' && game.settings.stackDraw4) return true;
  return false;
}

function isPlayableCard(card, game) {
  const topCard = game.discard[game.discard.length - 1];
  if (game.pendingDraw > 0) return canStack(card, game);
  return canPlay(card, topCard, game.currentColor, game);
}

function playCard(game, playerId, cardId, chosenColor) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.currentPlayerIndex) return { error: 'Not your turn' };

  const player = game.players[playerIndex];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { error: 'Card not in hand' };

  const card = player.hand[cardIdx];

  if (game.pendingDraw > 0 && !canStack(card, game)) {
    return { error: 'Must draw or stack with the same type' };
  }
  if (game.pendingDraw === 0) {
    const topCard = game.discard[game.discard.length - 1];
    if (!canPlay(card, topCard, game.currentColor, game)) return { error: 'Card cannot be played' };
  }

  player.hand.splice(cardIdx, 1);
  game.discard.push(card);

  if (card.color === 'wild') {
    game.currentColor = chosenColor || 'red';
  } else {
    game.currentColor = card.color;
  }

  game.lastAction = { type: 'play', player: player.name, card };

  if (player.hand.length === 0) {
    game.state = 'finished';
    game.winner = player.name;
    return { success: true, gameOver: true };
  }

  applyEffect(game, card);
  return { success: true };
}

function applyEffect(game, card) {
  const numPlayers = game.players.length;
  if (card.value === 'reverse') {
    game.direction *= -1;
    if (numPlayers === 2) advanceTurn(game);
    advanceTurn(game);
  } else if (card.value === 'skip') {
    advanceTurn(game);
    advanceTurn(game);
  } else if (card.value === 'draw2') {
    game.pendingDraw += 2;
    game.pendingDrawType = 'draw2';
    advanceTurn(game);
  } else if (card.value === 'wild4') {
    game.pendingDraw += 4;
    game.pendingDrawType = 'wild4';
    advanceTurn(game);
  } else {
    advanceTurn(game);
  }
}

function advanceTurn(game) {
  const n = game.players.length;
  game.currentPlayerIndex = ((game.currentPlayerIndex + game.direction) % n + n) % n;
}

function forceDraw(game, playerId) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.currentPlayerIndex) return { error: 'Not your turn' };

  if (game.settings.drawUntilPlayable && game.pendingDraw === 0) {
    // Keep drawing until finding a playable card
    let drew = 0;
    let foundPlayable = false;
    let safetyLimit = 20;
    while (!foundPlayable && safetyLimit-- > 0) {
      if (game.deck.length === 0) reshuffleDeck(game);
      if (game.deck.length === 0) break;
      const card = game.deck.pop();
      const player = game.players[playerIndex];
      player.hand.push(card);
      drew++;
      if (isPlayableCard(card, game)) {
        foundPlayable = true;
      }
    }
    game.lastAction = { type: 'draw', player: game.players[playerIndex].name, count: drew };
    // Don't advance turn — player can now play the drawn card
    return { success: true, drew };
  }

  // Normal draw
  const count = game.pendingDraw > 0 ? game.pendingDraw : 1;
  game.pendingDraw = 0;
  game.pendingDrawType = null;
  drawCards(game, playerId, count);
  game.lastAction = { type: 'draw', player: game.players[playerIndex].name, count };
  advanceTurn(game);
  return { success: true, drew: count };
}

function getPublicState(game, forPlayerId) {
  return {
    roomCode: game.roomCode,
    state: game.state,
    winner: game.winner,
    direction: game.direction,
    currentPlayerIndex: game.currentPlayerIndex,
    currentColor: game.currentColor,
    pendingDraw: game.pendingDraw,
    pendingDrawType: game.pendingDrawType,
    topCard: game.discard[game.discard.length - 1] || null,
    deckSize: game.deck.length,
    lastAction: game.lastAction,
    unoVulnerable: game.unoVulnerable || null,
    settings: game.settings,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.hand.length,
      hand: p.id === forPlayerId ? p.hand : undefined,
      isConnected: p.isConnected,
      score: p.score || 0,
      unoCalled: p.unoCalled || false,
    })),
  };
}

module.exports = { createGame, dealCards, playCard, forceDraw, drawCards, canPlay, isPlayableCard, getPublicState, DEFAULT_SETTINGS };
