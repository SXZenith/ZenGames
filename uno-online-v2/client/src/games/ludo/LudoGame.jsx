import React, { useState } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import '../SharedRoom.css';
import './LudoGame.css';

// ── Board geometry ───────────────────────────────────────────────────────────
// The standard Ludo board is 15×15. Each player has a 6×6 home zone + home
// column. We render a simplified visual that's clear at glance.

const PLAYER_COLORS = ['#ff3b52','#4cc9f0','#06d6a0','#ffd93d'];
const HOME_LABELS   = ['▲','◀','▼','▶']; // directional hints

export default function LudoGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby,
  onUpdateSettings, onChangeGame, onSendChat, onChatMessage, onGameAction, error,
}) {
  const me       = gameState.players.find(p => p.id === playerId);
  const isHost   = gameState.players[0]?.id === playerId;
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const myColor  = gameState.players.find(p=>p.id===playerId)?.color;
  const curPlayer= gameState.players[gameState.currentPlayerIndex];

  const augmented = {
    ...gameState,
    gameEmoji: '🎲',
    gameName:  'Ludo',
    minPlayers: 2, maxPlayers: 4,
  };

  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error} />;
  }
  if (gameState.state === 'finished') {
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;
  }

  const rollDice   = () => onGameAction('rollDice', {});
  const moveToken  = (ti) => onGameAction('moveToken', { tokenIndex: ti });

  const myTokens = gameState.tokens?.[playerId] ?? [];
  const canRoll  = isMyTurn && gameState.dice === null && !gameState.mustRollAgain;
  const hasRolled = isMyTurn && gameState.dice !== null;

  return (
    <div className="ludo-game">
      {/* Turn indicator + dice */}
      <div className="ludo-header">
        <div className="ludo-status">
          {isMyTurn
            ? <span className="ludo-your-turn">✦ Your Turn!</span>
            : <span className="ludo-wait">{curPlayer?.name}'s turn</span>}
        </div>
        {gameState.dice && (
          <div className="ludo-dice-result">
            <span className="ludo-die">{dieFace(gameState.dice)}</span>
            <span className="ludo-die-num">Rolled {gameState.dice}</span>
          </div>
        )}
        {gameState.mustRollAgain && isMyTurn && (
          <div className="ludo-bonus">🎲 Rolled 6 — roll again!</div>
        )}
      </div>

      {/* Player panels */}
      <div className="ludo-players">
        {gameState.players.map((p, pi) => {
          const tokens  = gameState.tokens?.[p.id] ?? [];
          const isActive = gameState.players[gameState.currentPlayerIndex]?.id === p.id;
          const isMe    = p.id === playerId;
          return (
            <div key={p.id} className={`ludo-player-panel ${isActive ? 'active' : ''} ${isMe ? 'me' : ''}`}
              style={{ '--player-color': p.color }}>
              <div className="lpp-name">{p.name}{isMe ? ' (you)' : ''}</div>
              <div className="lpp-tokens">
                {tokens.map((pos, ti) => {
                  const finished = pos === 58;
                  const onBoard  = pos >= 0 && pos < 58;
                  const atHome   = pos === -1;
                  const isMovable = isMe && isMyTurn && hasRolled && !canMoveCheck(pos, gameState.dice, gameState.settings);
                  return (
                    <button key={ti}
                      className={`ludo-token ${finished?'done':''} ${atHome?'home':''} ${onBoard?'board':''}`}
                      style={{ background: p.color }}
                      onClick={() => isMe && isMyTurn && hasRolled && moveToken(ti)}
                      disabled={!isMe || !isMyTurn || !hasRolled}
                      title={finished?'Finished!':atHome?'In yard':onBoard?`Square ${pos}`:'?'}>
                      {finished ? '★' : ti + 1}
                    </button>
                  );
                })}
              </div>
              <div className="lpp-progress">
                <div className="lpp-bar-bg">
                  <div className="lpp-bar-fill"
                    style={{ width: `${(tokens.filter(p=>p===58).length / 4) * 100}%`, background: p.color }} />
                </div>
                <span className="lpp-bar-label">{tokens.filter(p=>p===58).length}/4 home</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action area */}
      <div className="ludo-actions">
        {isMyTurn && canRoll && (
          <button className="ludo-roll-btn" onClick={rollDice}>
            🎲 Roll Dice
          </button>
        )}
        {isMyTurn && hasRolled && (
          <div className="ludo-move-hint">
            Click one of your tokens above to move it {gameState.dice} space{gameState.dice !== 1 ? 's' : ''}
          </div>
        )}
        {!isMyTurn && (
          <div className="ludo-wait-hint">Waiting for {curPlayer?.name}…</div>
        )}
      </div>

      {/* Last action log */}
      {gameState.lastAction && (
        <div className="ludo-last-action">
          {describeAction(gameState.lastAction)}
        </div>
      )}

      {error && <div className="error-toast">⚠ {error}</div>}
    </div>
  );
}

function canMoveCheck(pos, dice, settings) {
  if (pos === 58) return true; // already done — can't move
  if (pos === -1 && settings?.mustUse6 && dice !== 6) return true; // can't enter
  return false; // movable
}

function dieFace(n) {
  return ['','⚀','⚁','⚂','⚃','⚄','⚅'][n] ?? n;
}

function describeAction(action) {
  if (!action) return '';
  switch(action.type) {
    case 'roll':    return `${action.player} rolled a ${action.roll}`;
    case 'move':    return `${action.player} moved token ${action.tokenIndex + 1}`;
    case 'capture': return `${action.player} sent ${action.victim}'s token back to yard! 💥`;
    default:        return '';
  }
}

function LudoSettings({ settings, onChange, isHost }) {
  const update = (k, v) => onChange({ ...settings, [k]: v });
  const opts = [
    { key:'safeSquares', label:'Safe Squares',  desc:'Marked squares where pieces cannot be captured' },
    { key:'extraTurn6',  label:'6 = Extra Turn', desc:'Rolling a 6 grants a bonus roll' },
    { key:'mustUse6',    label:'Need 6 to Enter',desc:'Must roll 6 to bring a token onto the board' },
  ];
  return (
    <div className="shared-settings">
      <div className="ss-title">Rules</div>
      {opts.map(opt => (
        <div key={opt.key} className="ss-row">
          <div className="ss-label">
            <span className="ss-name">{opt.label}</span>
            <span className="ss-desc">{opt.desc}</span>
          </div>
          <button type="button"
            className={`ss-toggle ${settings[opt.key] ? 'on' : 'off'}`}
            onClick={() => isHost && update(opt.key, !settings[opt.key])}
            disabled={!isHost}>
            {settings[opt.key] ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}
      {!isHost && <p className="ss-note">Only the host can change rules</p>}
    </div>
  );
}
