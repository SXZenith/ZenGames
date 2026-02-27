import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game  from './components/Game';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const socketRef      = useRef(null);
  const reactionBridge = useRef({ onReaction: null });
  const chatBridge     = useRef({ onMessage: null });

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

  const inRoom = !!roomCode && !!gameState;

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
    s.on('reaction',     (data) => { if (reactionBridge.current?.onReaction) reactionBridge.current.onReaction(data); });
    s.on('chatMessage',  (data) => { if (chatBridge.current?.onMessage)    chatBridge.current.onMessage(data); });

    return () => s.disconnect();
  }, []);

  const createRoom     = useCallback((name)       => { setError(''); socketRef.current?.emit('createRoom', { playerName: name }); }, []);
  const joinRoom       = useCallback((code, name) => { setError(''); socketRef.current?.emit('joinRoom', { roomCode: code.toUpperCase(), playerName: name }); }, []);
  const startGame      = useCallback(()           => socketRef.current?.emit('startGame'), []);
  const rematch        = useCallback(()           => socketRef.current?.emit('rematch'), []);
  const returnToLobby  = useCallback(()           => socketRef.current?.emit('returnToLobby'), []);
  const playCard       = useCallback((id, color)  => socketRef.current?.emit('playCard', { cardId: id, chosenColor: color }), []);
  const drawCard       = useCallback(()           => socketRef.current?.emit('drawCard'), []);
  const passTurn       = useCallback(()           => socketRef.current?.emit('passTurn'), []);
  const callUno        = useCallback(()           => socketRef.current?.emit('callUno'), []);
  const catchUno       = useCallback((tid)        => socketRef.current?.emit('catchUno', { targetPlayerId: tid }), []);
  const updateSettings = useCallback((s)          => socketRef.current?.emit('updateSettings', s), []);
  const sendReaction   = useCallback((emoji)      => socketRef.current?.emit('sendReaction', { emoji }), []);
  const sendChat       = useCallback((text)       => socketRef.current?.emit('chatMessage', { text }), []);

  const roomLink = roomCode ? `${window.location.origin}?room=${roomCode}` : '';

  return (
    <div className="app">
      {!inRoom ? (
        <Lobby
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          error={error}
          connected={connected}
          autoJoinCode={autoJoinCode}
        />
      ) : (
        <Game
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          roomLink={roomLink}
          onStartGame={startGame}
          onPlayCard={playCard}
          onDrawCard={drawCard}
          onPassTurn={passTurn}
          onRematch={rematch}
          onReturnToLobby={returnToLobby}
          onCallUno={callUno}
          onCatchUno={catchUno}
          onUpdateSettings={updateSettings}
          onSendReaction={sendReaction}
          onSendChat={sendChat}
          onReaction={reactionBridge.current}
          onChatMessage={chatBridge.current}
          error={error}
        />
      )}
    </div>
  );
}
