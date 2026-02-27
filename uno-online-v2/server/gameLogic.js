'use strict';

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
    deck.push({ color: 'wild', value: 'wild',  id: `wild-${i}`  });
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
  pickTimer: 0,
  stackDraw2: true,
  stackDraw4: true,
  drawUntilPlayable: false,
  freeWild4: false,        // if true, Wild Draw 4 can be played any time
};

function createGame(roomCode, settings = {}) {
  return {
    roomCode,
    deck: createDeck(),
    discard: [],
    players: [],
    currentPlayerIndex: 0,
    direction: 1,
    state: 'waiting',
    winner: null,
    pendingDraw: 0,
    pendingDrawType: null,
    currentColor: null,
    lastAction: null,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    unoVulnerable: null,
    drawingStreak: false,  // true while player is mid draw-until-playable streak
  };
}

function dealCards(game) {
  // Find a non-wild starting card
  let topCard;
  do { topCard = game.deck.pop(); } while (topCard.color === 'wild');
  game.discard.push(topCard);
  game.currentColor = topCard.color;

  // Deal 7 cards to each player
  for (const player of game.players) {
    player.hand = [];
    for (let i = 0; i < 7; i++) player.hand.push(game.deck.pop());
  }

  // Apply starting card effect (real UNO rules)
  // currentPlayerIndex starts at 0 already
  if (topCard.value === 'skip') {
    advanceTurn(game); // skip player 0, player 1 goes first
    advanceTurn(game);
  } else if (topCard.value === 'reverse') {
    game.direction = -1;
    // With multiple players reverse means last player goes first
    // With 2 players acts like skip
    if (game.players.length === 2) {
      advanceTurn(game);
      advanceTurn(game);
    } else {
      advanceTurn(game);
    }
  } else if (topCard.value === 'draw2') {
    game.pendingDraw = 2;
    game.pendingDrawType = 'draw2';
    advanceTurn(game); // player 0 skipped, player 1 must draw
  }
  // wild4 cannot be a starting card (loop above ensures this)
  // number cards: player 0 goes first, no extra advance needed
}

function reshuffleDeck(game) {
  if (game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.deck = shuffle(game.discard);
  game.discard = [top];
}

function ensureDeck(game) {
  if (game.deck.length === 0) reshuffleDeck(game);
}

function canPlay(card, topCard, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function canStack(card, game) {
  if (game.pendingDraw === 0) return false;
  const t = game.pendingDrawType;
  if (t === 'draw2' && card.value === 'draw2' && game.settings.stackDraw2) return true;
  if (t === 'wild4' && card.value === 'wild4' && game.settings.stackDraw4) return true;
  return false;
}

function isPlayableCard(card, game) {
  if (game.pendingDraw > 0) return canStack(card, game);
  const topCard = game.discard[game.discard.length - 1];
  return canPlay(card, topCard, game.currentColor);
}

function playCard(game, playerId, cardId, chosenColor) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.currentPlayerIndex) return { error: 'Not your turn' };

  const player = game.players[playerIndex];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { error: 'Card not in hand' };

  const card = player.hand[cardIdx];

  // Validate legality
  if (game.pendingDraw > 0) {
    if (!canStack(card, game)) {
      return { error: `You must draw ${game.pendingDraw} cards or stack with a matching draw card` };
    }
  } else {
    const topCard = game.discard[game.discard.length - 1];
    if (!canPlay(card, topCard, game.currentColor)) {
      return { error: 'That card cannot be played here' };
    }
  }

  // Wild Draw 4 can only be played if you have no card matching current color
  // (unless freeWild4 house rule is enabled)
  if (card.value === 'wild4' && game.pendingDraw === 0 && !game.settings.freeWild4) {
    const hasMatchingColor = player.hand.some((c, i) => i !== cardIdx && c.color === game.currentColor);
    if (hasMatchingColor) {
      return { error: 'Wild Draw 4 can only be played when you have no cards matching the current color' };
    }
  }

  // Play the card
  player.hand.splice(cardIdx, 1);
  game.discard.push(card);
  game.drawingStreak = false;

  // Set color
  if (card.color === 'wild') {
    game.currentColor = chosenColor || 'red';
  } else {
    game.currentColor = card.color;
  }

  game.lastAction = { type: 'play', player: player.name, card };

  // Win condition
  if (player.hand.length === 0) {
    game.state = 'finished';
    game.winner = player.name;
    return { success: true, gameOver: true };
  }

  // Reset unoCalled when hand grows back above 1
  if (player.hand.length > 1) player.unoCalled = false;

  applyEffect(game, card);
  return { success: true };
}

function applyEffect(game, card) {
  if (card.value === 'reverse') {
    game.direction *= -1;
    if (game.players.length === 2) {
      // Reverse acts as skip in 2-player
      advanceTurn(game);
      advanceTurn(game);
    } else {
      advanceTurn(game);
    }
  } else if (card.value === 'skip') {
    advanceTurn(game); // skip next
    advanceTurn(game); // player after skip goes
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

// Draw one card. Behaviour depends on mode and context.
function forceDraw(game, playerId) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.currentPlayerIndex) return { error: 'Not your turn' };

  const player = game.players[playerIndex];

  // ── Penalty draw (from +2 / +4 stack) ─────────────────────────────────
  if (game.pendingDraw > 0) {
    const count = game.pendingDraw;
    game.pendingDraw = 0;
    game.pendingDrawType = null;
    game.drawingStreak = false;
    for (let i = 0; i < count; i++) {
      ensureDeck(game);
      if (game.deck.length > 0) player.hand.push(game.deck.pop());
    }
    game.lastAction = { type: 'draw', player: player.name, count };
    advanceTurn(game);
    return { success: true, drew: count };
  }

  // ── Draw-until-playable: ONE card per click ─────────────────────────────
  // Server STAYS on this player's turn every time (whether or not playable).
  // Client shows a "Pass" button once drawingStreak is true.
  // Player may play any playable card from their hand at any point.
  // Player ends turn with "Pass" after drawing at least once.
  if (game.settings.drawUntilPlayable) {
    ensureDeck(game);
    if (game.deck.length === 0) return { error: 'Deck is empty' };

    const card = game.deck.pop();
    player.hand.push(card);
    game.drawingStreak = true; // flag: player has drawn at least once this turn
    game.lastAction = { type: 'draw', player: player.name, count: 1 };

    // NOTE: we do NOT advance turn here — player stays until they pass or play
    return { success: true, drew: 1, foundPlayable: isPlayableCard(card, game) };
  }

  // ── Normal draw: draw 1 then end turn ─────────────────────────────────
  ensureDeck(game);
  if (game.deck.length === 0) return { error: 'Deck is empty' };
  const card = game.deck.pop();
  player.hand.push(card);
  game.drawingStreak = false;
  game.lastAction = { type: 'draw', player: player.name, count: 1 };
  advanceTurn(game);
  return { success: true, drew: 1 };
}

// End turn without playing (only valid after drawing in drawUntilPlayable mode)
function passTurn(game, playerId) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.currentPlayerIndex) return { error: 'Not your turn' };
  if (!game.drawingStreak) return { error: 'You must draw at least one card before passing' };
  game.drawingStreak = false;
  advanceTurn(game);
  return { success: true };
}

// Give cards to a player (used for UNO catch penalty)
function drawCards(game, playerId, count) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return [];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    ensureDeck(game);
    if (game.deck.length > 0) {
      const c = game.deck.pop();
      player.hand.push(c);
      drawn.push(c);
    }
  }
  return drawn;
}

function getPublicState(game, forPlayerId) {
  return {
    roomCode:           game.roomCode,
    state:              game.state,
    winner:             game.winner,
    direction:          game.direction,
    currentPlayerIndex: game.currentPlayerIndex,
    currentColor:       game.currentColor,
    pendingDraw:        game.pendingDraw,
    pendingDrawType:    game.pendingDrawType,
    topCard:            game.discard[game.discard.length - 1] || null,
    deckSize:           game.deck.length,
    lastAction:         game.lastAction,
    unoVulnerable:      game.unoVulnerable || null,
    settings:           game.settings,
    drawingStreak:      game.drawingStreak || false,
    players: game.players.map(p => ({
      id:          p.id,
      name:        p.name,
      handSize:    p.hand.length,
      hand:        p.id === forPlayerId ? p.hand : undefined,
      isConnected: p.isConnected,
      score:       p.score || 0,
      unoCalled:   p.unoCalled || false,
    })),
  };
}

module.exports = {
  createGame, dealCards, playCard, forceDraw, passTurn,
  drawCards, canPlay, isPlayableCard, getPublicState, DEFAULT_SETTINGS,
};
