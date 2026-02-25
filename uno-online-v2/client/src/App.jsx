import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const socketRef      = useRef(null);
  const reactionBridge = useRef({ onReaction: null });
  const drawResultCb   = useRef(null); // Game component registers this

  const [screen, setScreen]       = useState('lobby');
  const [roomCode, setRoomCode]   = useState('');
  const [playerId, setPlayerId]   = useState('');
  const [gameState, setGameState] = useState(null);
  const [error, setError]         = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect',       () => { setConnected(true); setError(''); });
    s.on('connect_error', () => setError('Cannot connect to server. Is it running on port 3001?'));
    s.on('disconnect',    () => setConnected(false));
    s.on('roomCreated',   ({ roomCode, playerId }) => { setRoomCode(roomCode); setPlayerId(playerId); setScreen('waiting'); setError(''); });
    s.on('roomJoined',    ({ roomCode, playerId }) => { setRoomCode(roomCode); setPlayerId(playerId); setScreen('waiting'); setError(''); });
    s.on('gameState',     (state) => {
      setGameState(state);
      if (state.state === 'playing' || state.state === 'finished') setScreen('game');
    });
    s.on('error',       ({ message }) => setError(message));
    s.on('reaction',    (data)         => { if (reactionBridge.current?.onReaction) reactionBridge.current.onReaction(data); });
    s.on('drawResult',  (data)         => { if (drawResultCb.current) drawResultCb.current(data); });

    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) { window.history.replaceState({}, '', '/'); sessionStorage.setItem('autoJoinCode', code.toUpperCase()); }

    return () => s.disconnect();
  }, []);

  const createRoom     = useCallback((playerName) => { setError(''); socketRef.current?.emit('createRoom', { playerName }); }, []);
  const joinRoom       = useCallback((code, name) => { setError(''); socketRef.current?.emit('joinRoom', { roomCode: code.toUpperCase(), playerName: name }); }, []);
  const startGame      = useCallback(() => socketRef.current?.emit('startGame'), []);
  const rematch        = useCallback(() => socketRef.current?.emit('rematch'), []);
  const playCard       = useCallback((cardId, color) => socketRef.current?.emit('playCard', { cardId, chosenColor: color }), []);
  const drawCard       = useCallback(() => socketRef.current?.emit('drawCard'), []);
  const callUno        = useCallback(() => socketRef.current?.emit('callUno'), []);
  const catchUno       = useCallback((tid) => socketRef.current?.emit('catchUno', { targetPlayerId: tid }), []);
  const updateSettings = useCallback((s) => socketRef.current?.emit('updateSettings', s), []);
  const sendReaction   = useCallback((emoji) => socketRef.current?.emit('sendReaction', { emoji }), []);

  const roomLink = roomCode ? `${window.location.origin}?room=${roomCode}` : '';

  return (
    <div className="app">
      {screen === 'lobby' && <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} connected={connected} />}
      {(screen === 'waiting' || screen === 'game') && gameState && (
        <Game
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          roomLink={roomLink}
          onStartGame={startGame}
          onPlayCard={playCard}
          onDrawCard={drawCard}
          onRematch={rematch}
          onCallUno={callUno}
          onCatchUno={catchUno}
          onUpdateSettings={updateSettings}
          onSendReaction={sendReaction}
          onReaction={reactionBridge.current}
          drawResultBridge={drawResultCb}
          error={error}
        />
      )}
      {screen === 'waiting' && !gameState && (
        <div className="waiting-stub"><div className="spinner" /><p>Connecting…</p></div>
      )}
    </div>
  );
}
