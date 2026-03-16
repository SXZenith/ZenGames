import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Lobby        from './components/Lobby';
import Game         from './components/Game';
import Connect4Game  from './games/connect4/Connect4Game';
import CheckersGame  from './games/checkers/CheckersGame';
import YahtzeeGame   from './games/yahtzee/YahtzeeGame';
import HangmanGame    from './games/hangman/HangmanGame';
import BattleshipGame from './games/battleship/BattleshipGame';
import BounceGame     from './games/bounce/BounceGame';
import { isMuted, toggleMute, soundReaction } from './sounds';
import './App.css';
import './AppHUD.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const REACTIONS  = ['🔥','😂','😤','🎉','💀','👍'];
const CHAT_HIDE_MS = 8000;

export default function App() {
  const socketRef         = useRef(null);
  const reactionBridgeRef = useRef({ onReaction: null });

  // ── Socket state ──────────────────────────────────────────────────────────
  const [gameState,    setGameState]    = useState(null);
  const [roomCode,     setRoomCode]     = useState('');
  const [playerId,     setPlayerId]     = useState('');
  const [error,        setError]        = useState('');
  const [connected,    setConnected]    = useState(false);
  const [autoJoinCode, setAutoJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('room');
    if (code) window.history.replaceState({}, '', '/');
    return code ? code.toUpperCase() : '';
  });

  // ── Global HUD state (persists across all games) ──────────────────────────
  const [mutedState,        setMutedState]        = useState(isMuted());
  const [showScoreboard,    setShowScoreboard]    = useState(false);
  const [showReactions,     setShowReactions]     = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showChat,      setShowChat]      = useState(false);
  const [chatMessages,  setChatMessages]  = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatUnread,    setChatUnread]    = useState(0);
  const chatHideRef = useRef(null);
  const chatEndRef  = useRef(null);

  const inRoom   = !!roomCode && !!gameState;
  const gameType = gameState?.gameType;

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect',      () => { setConnected(true); setError(''); });
    s.on('connect_error',() => setError('Cannot connect to server'));
    s.on('disconnect',   () => setConnected(false));
    s.on('roomCreated',  ({ roomCode, playerId }) => { setRoomCode(roomCode); setPlayerId(playerId); setError(''); });
    s.on('roomJoined',   ({ roomCode, playerId }) => { setRoomCode(roomCode); setPlayerId(playerId); setError(''); });
    s.on('gameState',    (state) => setGameState(state));
    s.on('error',        ({ message }) => setError(message));

    s.on('reaction', (data) => {
      soundReaction();
      const id = Date.now() + Math.random();
      setFloatingReactions(prev => [...prev, { ...data, id }]);
      setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2500);
      if (reactionBridgeRef.current?.onReaction) reactionBridgeRef.current.onReaction(data);
    });

    s.on('chatMessage', (data) => {
      setChatMessages(prev => [...prev.slice(-99), data]);
      setShowChat(prev => {
        if (!prev) setChatUnread(u => u + 1);
        clearTimeout(chatHideRef.current);
        chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
        return true;
      });
    });

    return () => s.disconnect();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (showChat) setChatUnread(0); }, [showChat]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const emit = (ev, data) => socketRef.current?.emit(ev, data);

  const createRoom     = useCallback((name, gameType, settings) => { setError(''); emit('createRoom', { playerName: name, gameType, settings }); }, []);
  const joinRoom       = useCallback((code, name) => { setError(''); emit('joinRoom', { roomCode: code.toUpperCase(), playerName: name }); }, []);
  const startGame      = useCallback(() => emit('startGame'), []);
  const rematch        = useCallback(() => emit('rematch'), []);
  const returnToLobby  = useCallback(() => emit('returnToLobby'), []);
  const changeGame     = useCallback((gameType, settings) => emit('changeGame', { gameType, settings }), []);
  const updateSettings = useCallback((s) => emit('updateSettings', s), []);
  const gameAction     = useCallback((action, payload = {}) => emit('gameAction', { action, payload }), []);
  const sendReaction   = useCallback((emoji) => emit('sendReaction', { emoji }), []);
  const sendChat       = useCallback((text)  => emit('chatMessage', { text }), []);
  // UNO-specific
  const playCard  = useCallback((id, color) => emit('playCard', { cardId: id, chosenColor: color }), []);
  const drawCard  = useCallback(() => emit('drawCard'), []);
  const passTurn  = useCallback(() => emit('passTurn'), []);
  const callUno   = useCallback(() => emit('callUno'), []);
  const catchUno  = useCallback((tid) => emit('catchUno', { targetPlayerId: tid }), []);

  // ── HUD handlers ──────────────────────────────────────────────────────────
  const handleMuteToggle = () => setMutedState(toggleMute());
  const openChat = () => {
    setShowChat(s => !s);
    setChatUnread(0);
    clearTimeout(chatHideRef.current);
    chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
    setShowReactions(false);
  };
  const handleChatSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
    clearTimeout(chatHideRef.current);
    chatHideRef.current = setTimeout(() => setShowChat(false), CHAT_HIDE_MS);
  };
  const handleReaction = (emoji) => {
    soundReaction();
    sendReaction(emoji);
    setShowReactions(false);
  };

  const roomLink = roomCode ? `${window.location.origin}?room=${roomCode}` : '';

  const sharedProps = {
    gameState, playerId, roomCode, roomLink,
    onStartGame: startGame, onRematch: rematch,
    onReturnToLobby: returnToLobby,
    onChangeGame: changeGame,
    onUpdateSettings: updateSettings,
    onSendReaction: sendReaction,
    onReaction: reactionBridgeRef.current,
    onChatMessage: null,
    onSendChat: sendChat,
    error,
  };

  return (
    <div className="app" onClick={() => { if (showReactions) setShowReactions(false); }}>

      {/* ══ GAME CONTENT ══ */}
      {!inRoom ? (
        <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom}
          error={error} connected={connected} autoJoinCode={autoJoinCode} />
      ) : gameType === 'uno' ? (
        <Game {...sharedProps}
          onPlayCard={playCard} onDrawCard={drawCard}
          onPassTurn={passTurn} onCallUno={callUno} onCatchUno={catchUno} />
      ) : gameType === 'connect4' ? (
        <Connect4Game {...sharedProps} onGameAction={gameAction} />
      ) : gameType === 'checkers' ? (
        <CheckersGame {...sharedProps} onGameAction={gameAction} />
      ) : gameType === 'yahtzee' ? (
        <YahtzeeGame {...sharedProps} onGameAction={gameAction} />
      ) : gameType === 'hangman' ? (
        <HangmanGame {...sharedProps} onGameAction={gameAction} />
      ) : gameType === 'battleship' ? (
        <BattleshipGame {...sharedProps} onGameAction={gameAction} />
      ) : gameType === 'bounce' ? (
        <BounceGame {...sharedProps} onGameAction={gameAction} />
      ) : (
        <div style={{color:'white',padding:40}}>Unknown game: {gameType}</div>
      )}

      {/* ══ GLOBAL HUD — visible in all in-room screens ══ */}
      {inRoom && (
        <>
          {floatingReactions.map((r) => (
            <div key={r.id} className="floating-reaction"
              style={{ left: `${10 + (gameState.players.findIndex(p=>p.id===r.playerId)) * 22}%` }}>
              <span className="fr-name">{r.playerName}</span>
              <span className="fr-emoji">{r.emoji}</span>
            </div>
          ))}

          {showScoreboard && (
            <div className="mid-scoreboard" onClick={() => setShowScoreboard(false)}>
              <div className="mid-sb-card" onClick={e => e.stopPropagation()}>
                <div className="mid-sb-title">🏆 Scores</div>
                {[...gameState.players].sort((a,b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className={`mid-sb-row ${p.id === playerId ? 'me' : ''}`}>
                    <span className="mid-sb-rank">#{i+1}</span>
                    <span className="mid-sb-name">{p.name}</span>
                    <span className="mid-sb-score">{p.score}W</span>
                  </div>
                ))}
                <button className="btn-secondary small" style={{marginTop:12,width:'100%'}} onClick={() => setShowScoreboard(false)}>Close</button>
              </div>
            </div>
          )}

          {/* HUD top-right: mute, scoreboard, reactions */}
          <div className="global-hud-right" onClick={e => e.stopPropagation()}>
            <button className="hud-btn" onClick={handleMuteToggle}>{mutedState ? '🔇' : '🔊'}</button>
            <button className="hud-btn" onClick={() => setShowScoreboard(s => !s)}>🏆</button>
            <div className="reaction-wrapper">
              <button className="hud-btn" onClick={() => setShowReactions(s => !s)}>😄</button>
              {showReactions && (
                <div className="reaction-picker">
                  {REACTIONS.map(e => <button key={e} className="react-btn" onClick={() => handleReaction(e)}>{e}</button>)}
                </div>
              )}
            </div>
            <button className="hud-btn hud-exit-btn" title="Exit to Lobby"
              onClick={() => {
                if (window.confirm('Exit game? All players will be returned to the lobby.')) {
                  returnToLobby();
                }
              }}>🚪</button>
          </div>

          {/* HUD top-left: chat */}
          <div className="global-hud-left" onClick={e => e.stopPropagation()}>
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
                <form className="chat-input-row" onSubmit={handleChatSend}>
                  <input className="chat-input" placeholder="Say something…"
                    value={chatInput} onChange={e => setChatInput(e.target.value)}
                    maxLength={200} autoFocus />
                  <button className="chat-send" type="submit" disabled={!chatInput.trim()}>➤</button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
