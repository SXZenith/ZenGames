/**
 * SharedRoom.jsx
 * Reusable WaitingRoom and GameOver screens used by every game.
 * Each game passes its own settings renderer for the waiting room.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import './SharedRoom.css';

// ─────────────────────────────────────────────────────────────────────
// CHAT (injected into every game screen)
// ─────────────────────────────────────────────────────────────────────
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

  return { ChatUI, showChat };
}

// ─────────────────────────────────────────────────────────────────────
// WAITING ROOM
// ─────────────────────────────────────────────────────────────────────
export function WaitingRoom({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onUpdateSettings,
  SettingsComponent, // optional: renders game-specific settings
  error,
}) {
  const [copied, setCopied] = useState(false);
  const isHost = gameState.players[0]?.id === playerId;
  const { meta } = gameState; // might be undefined for UNO-style states

  const copy = (text) => navigator.clipboard.writeText(text).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  });

  const minPlayers = gameState.minPlayers ?? 2;

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        <div className="waiting-header">
          <div className="wh-game-badge">{gameState.gameEmoji ?? '🎮'}</div>
          <h2>{gameState.gameName ?? 'Waiting for players…'}</h2>
          <p className="waiting-sub">{gameState.players.length} / {gameState.maxPlayers ?? 4} players joined</p>
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
              {!p.isConnected && <span className="dc-badge">Disconnected</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, (gameState.maxPlayers ?? 4) - gameState.players.length) }).map((_, i) => (
            <div key={i} className="player-slot empty">
              <div className="player-avatar empty-avatar">?</div>
              <span className="player-slot-name">Waiting…</span>
            </div>
          ))}
        </div>

        {SettingsComponent && isHost && (
          <SettingsComponent settings={gameState.settings} onChange={onUpdateSettings} isHost={isHost} />
        )}

        {isHost
          ? <button className="btn-primary" onClick={onStartGame} disabled={gameState.players.length < minPlayers}>
              {gameState.players.length < minPlayers ? `Need ${minPlayers - gameState.players.length} more player${minPlayers - gameState.players.length > 1 ? 's' : ''}` : 'Start Game →'}
            </button>
          : <p className="waiting-for-host">Waiting for host to start…</p>
        }
        {error && <div className="error-msg">⚠ {error}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────────────────────
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
        {isHost && <p className="go-exit-note">Back to Lobby resets scores for everyone.</p>}
      </div>
    </div>
  );
}
