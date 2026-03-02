import React, { useState } from 'react';
import { WaitingRoom, GameOver, useChat } from '../SharedRoom';
import '../SharedRoom.css';
import './CheckersGame.css';

export default function CheckersGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby,
  onUpdateSettings, onSendChat, onChatMessage, onGameAction, error,
}) {
  const [selected, setSelected] = useState(null); // [row, col] of selected piece
  const { ChatUI } = useChat(onChatMessage, onSendChat);

  const me       = gameState.players.find(p => p.id === playerId);
  const isHost   = gameState.players[0]?.id === playerId;
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const myColor  = me?.color;
  const curPlayer = gameState.players[gameState.currentPlayerIndex];

  const augmented = { ...gameState, gameEmoji: '⚫', gameName: 'Checkers', minPlayers: 2, maxPlayers: 2 };

  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onUpdateSettings={onUpdateSettings}
      SettingsComponent={CheckersSettings} error={error} />;
  }
  if (gameState.state === 'finished') {
    return <GameOver gameState={gameState} playerId={playerId} onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;
  }

  const board = gameState.board;

  const handleSquareClick = (r, c) => {
    if (!isMyTurn) return;
    const piece = board[r]?.[c];
    // Clicking own piece: select it
    if (piece && piece.color === myColor) {
      setSelected([r, c]);
      return;
    }
    // Clicking empty/enemy with a piece selected: attempt move
    if (selected) {
      onGameAction('move', { from: selected, to: [r, c] });
      setSelected(null);
    }
  };

  return (
    <div className="ck-game">
      <ChatUI playerId={playerId} />

      <div className="ck-header">
        <div className="ck-players">
          {gameState.players.map(p => (
            <div key={p.id} className={`ck-player ${gameState.players[gameState.currentPlayerIndex]?.id === p.id ? 'active' : ''}`}>
              <div className="ck-piece-icon" style={{ background: p.color }} />
              <span>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              <span className="ck-score">{p.score}W</span>
            </div>
          ))}
        </div>
        <div className="ck-status">
          {isMyTurn ? <span className="ck-your-turn">✦ Your Turn!</span>
                    : <span className="ck-wait">{curPlayer?.name}'s turn</span>}
        </div>
        {gameState.mustJump && isMyTurn && (
          <div className="ck-must-jump">⚡ Jump required! Continue your chain.</div>
        )}
      </div>

      <div className="ck-board">
        {board.map((row, r) => row.map((cell, c) => {
          const isDark      = (r + c) % 2 === 1;
          const isSelected  = selected && selected[0] === r && selected[1] === c;
          const isMustJump  = gameState.mustJump && gameState.mustJump[0] === r && gameState.mustJump[1] === c;

          return (
            <div key={`${r}-${c}`}
              className={`ck-square ${isDark ? 'dark' : 'light'} ${isSelected ? 'sel' : ''}`}
              onClick={() => isDark && handleSquareClick(r, c)}>
              {cell && (
                <div className={`ck-piece ${isMustJump ? 'must-jump' : ''} ${cell.color === myColor && isMyTurn ? 'mine' : ''}`}
                  style={{ background: cell.color }}>
                  {cell.king && <span className="ck-crown">♛</span>}
                </div>
              )}
            </div>
          );
        }))}
      </div>

      <div className="ck-hint">
        {isMyTurn && !selected && 'Click one of your pieces to select it'}
        {isMyTurn && selected  && 'Click a square to move there'}
        {!isMyTurn             && `Waiting for ${curPlayer?.name}…`}
      </div>
      {error && <div className="error-toast">⚠ {error}</div>}
    </div>
  );
}

function CheckersSettings({ settings, onChange, isHost }) {
  const update = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div className="shared-settings">
      <div className="ss-title">Rules</div>
      {[
        { key:'mandatoryCapture', label:'Must Capture', desc:'You must capture if possible' },
        { key:'flyingKings',      label:'Flying Kings', desc:'Kings move multiple squares' },
      ].map(opt => (
        <div key={opt.key} className="ss-row">
          <div className="ss-label"><span className="ss-name">{opt.label}</span><span className="ss-desc">{opt.desc}</span></div>
          <button type="button" className={`ss-toggle ${settings[opt.key]?'on':'off'}`}
            onClick={() => isHost && update(opt.key, !settings[opt.key])} disabled={!isHost}>
            {settings[opt.key]?'ON':'OFF'}
          </button>
        </div>
      ))}
      {!isHost && <p className="ss-note">Only the host can change rules</p>}
    </div>
  );
}
