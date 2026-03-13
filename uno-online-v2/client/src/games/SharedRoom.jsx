/**
 * SharedRoom.jsx
 * Shared WaitingRoom, GameOver, Chat hook — used by Connect4, Checkers, Yahtzee.
 * UNO uses its own Game.jsx but imports the GamePicker from here.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import './SharedRoom.css';

// ─────────────────────────────────────────────────────────────────────────────
// GAME DEFINITIONS (single source of truth for the picker)
// ─────────────────────────────────────────────────────────────────────────────
export const GAME_LIST = [
  {
    id: 'uno', name: 'UNO', emoji: '🃏',
    description: 'Match colors & numbers. First to empty their hand wins!',
    players: '2–4', minPlayers: 2, maxPlayers: 4,
    settings: [
      { key:'stackDraw2',        label:'Stack +2',           type:'toggle', default:true,  desc:'Play +2 on +2 to pass the penalty' },
      { key:'stackDraw4',        label:'Stack +4',           type:'toggle', default:true,  desc:'Play +4 on +4 to pass the penalty' },
      { key:'drawUntilPlayable', label:'Draw Until Playable', type:'toggle', default:false, desc:'Keep drawing until you get a playable card' },
      { key:'freeWild4',         label:'Free Wild +4',        type:'toggle', default:false, desc:'Play Wild Draw 4 any time' },
      { key:'pickTimer',         label:'Turn Timer',          type:'timer',  default:0 },
    ],
  },
  {
    id: 'connect4', name: 'Connect 4', emoji: '🔴',
    description: 'Drop discs to connect 4 in a row!',
    players: '2', minPlayers: 2, maxPlayers: 2,
    settings: [
      { key:'allowUndo', label:'Allow Undo', type:'toggle', default:false, desc:'Take back your last move' },
      { key:'winStreak', label:'Win Streak', type:'chips',  default:4, options:[3,4,5], desc:'Discs in a row to win' },
    ],
  },
  {
    id: 'checkers', name: 'Checkers', emoji: '⚫',
    description: "Capture all your opponent's pieces to win!",
    players: '2', minPlayers: 2, maxPlayers: 2,
    settings: [
      { key:'mandatoryCapture', label:'Must Capture', type:'toggle', default:true,  desc:'You must capture if possible' },
      { key:'flyingKings',      label:'Flying Kings', type:'toggle', default:false, desc:'Kings move multiple squares' },
    ],
  },
  {
    id: 'yahtzee', name: 'Yahtzee', emoji: '🎲',
    description: 'Roll dice to score in 13 categories. Highest total wins!',
    players: '1–4', minPlayers: 1, maxPlayers: 4,
    settings: [
      { key:'bonusYahtzee', label:'Bonus Yahtzee', type:'toggle', default:true,  desc:'Extra Yahtzees score 100 bonus points each' },
      { key:'jokerRules',   label:'Joker Rules',   type:'toggle', default:true,  desc:'Bonus Yahtzee can fill any open category' },
    ],
  },
  {
    id: 'hangman', name: 'Hangman', emoji: '🪢',
    description: 'Guess the secret word before the man is hanged! 5 rounds.',
    players: '2–4', minPlayers: 2, maxPlayers: 4,
    settings: [
      { key:'hardMode',     label:'Hard Mode',     type:'toggle', default:false, desc:'Only 5 wrong guesses allowed' },
      { key:'showCategory', label:'Show Category', type:'toggle', default:true,  desc:'Show the word category as a hint' },
    ],
  },
  {
    id: 'battleship', name: 'Battleship', emoji: '🚢',
    description: "Sink your opponent's fleet before they sink yours!",
    players: '2', minPlayers: 2, maxPlayers: 2,
    settings: [
      { key:'gridSize',   label:'Grid Size',   type:'chips',  default:10, options:[8,10], desc:'8×8 or 10×10 board' },
      { key:'showMisses', label:'Show Misses', type:'toggle', default:true, desc:'Display missed shots on board' },
    ],
  },
  {
    id: 'bounce', name: 'Bounce', emoji: '🔵',
    description: 'Race to the top! Tap to jump and switch colors to pass through obstacles.',
    players: '2–4', minPlayers: 2, maxPlayers: 4,
    settings: [
      { key:'courseLength', label:'Course Length', type:'chips', default:60, options:[40,60,80], desc:'Number of obstacle rows' },
      { key:'speed',        label:'Speed',         type:'chips', default:2,  options:[1,2,3],    desc:'Ball speed' },
    ],
  },
];

const TIMER_OPTIONS = [0,10,15,20,30];

export function defaultSettingsFor(gameId) {
  const game = GAME_LIST.find(g => g.id === gameId);
  if (!game) return {};
  const s = {};
  game.settings.forEach(opt => { s[opt.key] = opt.default; });
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME PICKER — embedded in waiting room for host to switch games
// ─────────────────────────────────────────────────────────────────────────────
export function GamePicker({ currentGameId, settings, onChangeGame, isHost }) {
  const [localGameId,   setLocalGameId]   = useState(currentGameId);
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalGameId(currentGameId);
    setLocalSettings(settings);
  }, [currentGameId]);

  const selectGame = (g) => {
    if (!isHost) return;
    const newSettings = defaultSettingsFor(g.id);
    setLocalGameId(g.id);
    setLocalSettings(newSettings);
    onChangeGame(g.id, newSettings);
  };

  const updateSetting = (key, val) => {
    if (!isHost) return;
    const newSettings = { ...localSettings, [key]: val };
    setLocalSettings(newSettings);
    onChangeGame(localGameId, newSettings);
  };

  const selectedGame = GAME_LIST.find(g => g.id === localGameId);

  return (
    <div className="game-picker-section">
      <div className="gps-label">Game</div>
      <div className="game-picker-grid">
        {GAME_LIST.map(g => (
          <button key={g.id} type="button"
            className={`game-tile ${localGameId === g.id ? 'selected' : ''} ${!isHost ? 'readonly' : ''}`}
            onClick={() => selectGame(g)}>
            <span className="game-tile-emoji">{g.emoji}</span>
            <span className="game-tile-name">{g.name}</span>
            <span className="game-tile-players">{g.players}p</span>
          </button>
        ))}
      </div>

      {selectedGame && (
        <div className="gps-settings">
          {selectedGame.settings.map(opt => (
            <div key={opt.key} className="gps-row">
              <div className="gps-label-wrap">
                <span className="gps-name">{opt.label}</span>
                {opt.desc && <span className="gps-desc">{opt.desc}</span>}
              </div>
              {opt.type === 'toggle' && (
                <button type="button"
                  className={`gps-toggle ${localSettings[opt.key] ? 'on' : 'off'}`}
                  onClick={() => updateSetting(opt.key, !localSettings[opt.key])}
                  disabled={!isHost}>
                  {localSettings[opt.key] ? 'ON' : 'OFF'}
                </button>
              )}
              {opt.type === 'timer' && (
                <div className="gps-chips">
                  {TIMER_OPTIONS.map(t => (
                    <button key={t} type="button"
                      className={`gps-chip ${localSettings[opt.key] === t ? 'active' : ''}`}
                      onClick={() => isHost && updateSetting(opt.key, t)}
                      disabled={!isHost}>
                      {t === 0 ? 'Off' : `${t}s`}
                    </button>
                  ))}
                </div>
              )}
              {opt.type === 'chips' && (
                <div className="gps-chips">
                  {opt.options.map(v => (
                    <button key={v} type="button"
                      className={`gps-chip ${localSettings[opt.key] === v ? 'active' : ''}`}
                      onClick={() => isHost && updateSetting(opt.key, v)}
                      disabled={!isHost}>
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!isHost && <p className="gps-note">Only the host can change the game</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT HOOK
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_HIDE_MS = 8000;

export function useChat(onChatMessage, onSendChat) {
  const [showChat,     setShowChat]     = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatUnread,   setChatUnread]   = useState(0);
  const chatHideRef = useRef(null);
  const chatEndRef  = useRef(null);

  const handleIncoming = useCallback((msg) => {
    setChatMessages(prev => [...prev.slice(-99), msg]);
    setShowChat(prev => {
      if (!prev) setChatUnread(u => u + 1);
      clearTimeout(chatHideRef.current);
      chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
      return true;
    });
  }, []);

  useEffect(() => { if (onChatMessage) onChatMessage.onMessage = handleIncoming; });
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (showChat) setChatUnread(0); }, [showChat]);

  const openChat = () => {
    setShowChat(s => !s);
    setChatUnread(0);
    clearTimeout(chatHideRef.current);
    chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
    clearTimeout(chatHideRef.current);
    chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
  };

  const ChatUI = ({ playerId }) => (
    <div className="chat-hud" onClick={e => e.stopPropagation()}>
      <button className="hud-btn chat-toggle-btn" onClick={openChat}>
        💬
        {chatUnread > 0 && !showChat && <span className="chat-unread">{chatUnread}</span>}
      </button>
      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Chat</span>
            <button className="chat-close" onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {chatMessages.length === 0 && <div className="chat-empty">No messages yet…</div>}
            {chatMessages.map((msg, i) => {
              const isMe = msg.playerId === playerId;
              return (
                <div key={i} className={`chat-msg ${isMe ? 'chat-msg-me' : ''}`}>
                  {!isMe && <div className="chat-sender">{msg.playerName}</div>}
                  <div className="chat-bubble">{msg.text}</div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleSend}>
            <input className="chat-input" placeholder="Say something…" value={chatInput}
              onChange={e => setChatInput(e.target.value)} maxLength={200} autoFocus />
            <button className="chat-send" type="submit" disabled={!chatInput.trim()}>➤</button>
          </form>
        </div>
      )}
    </div>
  );

  return { ChatUI, showChat, chatMessages };
}

// ─────────────────────────────────────────────────────────────────────────────
// WAITING ROOM
// ─────────────────────────────────────────────────────────────────────────────
export function WaitingRoom({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onChangeGame,
  error,
}) {
  const [copied, setCopied] = useState(false);
  const isHost = gameState.players[0]?.id === playerId;
  const minPlayers = gameState.minPlayers ?? 2;

  const copy = (text) => navigator.clipboard.writeText(text).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  });

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        <div className="waiting-header">
          <div className="zen-logo-small">ZG</div>
          <h2>Game Lobby</h2>
          <p className="waiting-sub">{gameState.players.length} / {gameState.maxPlayers ?? 4} players</p>
        </div>

        <div className="room-code-block">
          <span className="rc-label">Room Code</span>
          <div className="rc-code" onClick={() => copy(roomCode)}>{roomCode}</div>
          <div className="rc-actions">
            <button className="btn-secondary small" onClick={() => copy(roomCode)}>{copied ? '✓ Copied!' : 'Copy Code'}</button>
            <button className="btn-secondary small" onClick={() => copy(roomLink)}>{copied ? '✓ Copied!' : '🔗 Copy Link'}</button>
          </div>
        </div>

        <div className="player-list">
          {gameState.players.map((p, i) => (
            <div key={p.id} className={`player-slot filled ${p.id === playerId ? 'me' : ''}`}>
              <div className="player-avatar" style={{ background: `hsl(${i * 90},60%,50%)` }}>{p.name[0].toUpperCase()}</div>
              <span className="player-slot-name">{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              {i === 0 && <span className="host-badge">Host</span>}
              {!p.isConnected && <span className="dc-badge">✕</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, (gameState.maxPlayers ?? 4) - gameState.players.length) }).map((_, i) => (
            <div key={i} className="player-slot empty">
              <div className="player-avatar empty-avatar">?</div>
              <span className="player-slot-name">Waiting…</span>
            </div>
          ))}
        </div>

        <GamePicker
          currentGameId={gameState.gameType}
          settings={gameState.settings}
          onChangeGame={onChangeGame}
          isHost={isHost}
        />

        {isHost
          ? <button className="btn-primary" onClick={onStartGame}
              disabled={gameState.players.length < minPlayers}>
              {gameState.players.length < minPlayers
                ? `Need ${minPlayers - gameState.players.length} more player${minPlayers - gameState.players.length > 1 ? 's' : ''}`
                : `Play ${GAME_LIST.find(g=>g.id===gameState.gameType)?.name ?? 'Game'} →`}
            </button>
          : <p className="waiting-for-host">Waiting for host to start…</p>
        }
        {error && <div className="error-msg">⚠ {error}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────────────────────────────
export function GameOver({ gameState, playerId, onRematch, onReturnToLobby }) {
  const isHost   = gameState.players[0]?.id === playerId;
  const isDraw   = gameState.winner === 'draw';
  const amWinner = !isDraw && gameState.players.find(p => p.name === gameState.winner)?.id === playerId;
  const sorted   = [...gameState.players].sort((a, b) => b.score - a.score);

  return (
    <div className="game-over">
      <div className="game-over-card">
        <div className="go-emoji">{isDraw ? '🤝' : amWinner ? '🎉' : '😢'}</div>
        <h1 className="go-title">
          {isDraw ? "It's a draw!" : amWinner ? 'You Won!' : `${gameState.winner} Won!`}
        </h1>

        <div className="go-section-label" style={{ marginTop: 0 }}>Total Score</div>
        <div className="go-scoreboard">
          {sorted.map((p, i) => (
            <div key={p.id} className={`go-score-row ${p.id === playerId ? 'me' : ''}`}>
              <span className="go-rank">#{i + 1}</span>
              <span className="go-score-name">{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              <span className="go-wins">{p.score} {p.score === 1 ? 'win' : 'wins'}</span>
            </div>
          ))}
        </div>

        <div className="go-actions">
          {isHost ? (
            <>
              <button className="btn-primary" onClick={onRematch}>Rematch →</button>
              <button className="btn-exit" onClick={onReturnToLobby}>← Back to Lobby</button>
            </>
          ) : (
            <p className="waiting-for-host" style={{ marginTop: 0 }}>Waiting for host…</p>
          )}
        </div>
        {isHost && <p className="go-exit-note">Back to Lobby keeps everyone connected. Scores reset.</p>}
      </div>
    </div>
  );
}
