import React, { useState } from 'react';
import { WaitingRoom, GameOver, useChat } from '../SharedRoom';
import '../SharedRoom.css';
import './Connect4Game.css';

const COLS = 7;
const ROWS = 6;

export default function Connect4Game({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby,
  onUpdateSettings, onSendReaction, onSendChat,
  onReaction, onChatMessage, onGameAction, error,
}) {
  const [hoverCol, setHoverCol] = useState(null);
  const { ChatUI } = useChat(onChatMessage, onSendChat);

  const me        = gameState.players.find(p => p.id === playerId);
  const isHost    = gameState.players[0]?.id === playerId;
  const isMyTurn  = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const myColor   = me?.color;
  const curPlayer = gameState.players[gameState.currentPlayerIndex];

  // Augment gameState with display info for SharedRoom
  const augmented = {
    ...gameState,
    gameEmoji: '🔴',
    gameName:  'Connect 4',
    minPlayers: 2, maxPlayers: 2,
  };

  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onUpdateSettings={onUpdateSettings}
      SettingsComponent={Connect4Settings} error={error} />;
  }

  if (gameState.state === 'finished') {
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;
  }

  const dropDisc = (col) => {
    if (!isMyTurn) return;
    onGameAction('dropDisc', { col });
    setHoverCol(null);
  };

  return (
    <div className="c4-game">
      <ChatUI playerId={playerId} />

      <div className="c4-header">
        <div className="c4-players">
          {gameState.players.map(p => (
            <div key={p.id} className={`c4-player ${gameState.players[gameState.currentPlayerIndex]?.id === p.id ? 'active' : ''}`}>
              <div className="c4-disc-icon" style={{ background: p.color }} />
              <span>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              <span className="c4-score">{p.score}W</span>
            </div>
          ))}
        </div>
        <div className="c4-status">
          {isMyTurn
            ? <span className="c4-your-turn">✦ Your Turn!</span>
            : <span className="c4-wait">{curPlayer?.name}'s turn</span>}
        </div>
      </div>

      <div className="c4-board-wrap">
        {/* Drop zone arrows */}
        <div className="c4-arrows">
          {Array.from({ length: COLS }).map((_, col) => (
            <div key={col} className="c4-arrow-cell"
              onMouseEnter={() => isMyTurn && setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              onClick={() => dropDisc(col)}>
              {hoverCol === col && isMyTurn && (
                <div className="c4-ghost-disc" style={{ background: myColor }} />
              )}
            </div>
          ))}
        </div>

        {/* Board */}
        <div className="c4-board">
          {gameState.board.map((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className="c4-cell"
                onMouseEnter={() => isMyTurn && setHoverCol(c)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => dropDisc(c)}>
                <div className={`c4-disc ${hoverCol === c && isMyTurn && !cell ? 'preview' : ''}`}
                  style={{ background: cell ?? (hoverCol === c && isMyTurn ? myColor + '44' : undefined),
                           opacity: cell ? 1 : (hoverCol === c && isMyTurn ? 0.35 : undefined) }} />
              </div>
            ))
          )}
        </div>
        <div className="c4-col-numbers">
          {Array.from({ length: COLS }).map((_, c) => <div key={c} className="c4-col-num">{c + 1}</div>)}
        </div>
      </div>

      {gameState.lastMove && (
        <div className="c4-last-action">
          {gameState.lastMove.player} dropped in column {gameState.lastMove.col + 1}
        </div>
      )}
      {error && <div className="error-toast">⚠ {error}</div>}
    </div>
  );
}

function Connect4Settings({ settings, onChange, isHost }) {
  const update = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div className="shared-settings">
      <div className="ss-title">Rules</div>
      <div className="ss-row">
        <div className="ss-label"><span className="ss-name">Win Streak</span><span className="ss-desc">Discs in a row needed to win</span></div>
        <div className="ss-chips">
          {[3,4,5].map(v => <button key={v} type="button" className={`ss-chip ${settings.winStreak===v?'active':''}`} onClick={() => isHost && update('winStreak',v)} disabled={!isHost}>{v}</button>)}
        </div>
      </div>
      <div className="ss-row">
        <div className="ss-label"><span className="ss-name">Allow Undo</span><span className="ss-desc">Take back your last move</span></div>
        <button type="button" className={`ss-toggle ${settings.allowUndo?'on':'off'}`} onClick={() => isHost && update('allowUndo',!settings.allowUndo)} disabled={!isHost}>
          {settings.allowUndo?'ON':'OFF'}
        </button>
      </div>
      {!isHost && <p className="ss-note">Only the host can change rules</p>}
    </div>
  );
}
