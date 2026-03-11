import React, { useState, useEffect } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './YahtzeeGame.css';

// ─── constants ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  'ones','twos','threes','fours','fives','sixes',
  'threeOfAKind','fourOfAKind','fullHouse',
  'smallStraight','largeStraight','yahtzee','chance',
];
const UPPER_CATS = ['ones','twos','threes','fours','fives','sixes'];

const CAT_LABEL = {
  ones:'Ones', twos:'Twos', threes:'Threes', fours:'Fours', fives:'Fives', sixes:'Sixes',
  threeOfAKind:'3 of a Kind', fourOfAKind:'4 of a Kind', fullHouse:'Full House',
  smallStraight:'Sm. Straight', largeStraight:'Lg. Straight', yahtzee:'YAHTZEE!', chance:'Chance',
};
const CAT_DESC = {
  ones:'Sum of all 1s', twos:'Sum of all 2s', threes:'Sum of all 3s',
  fours:'Sum of all 4s', fives:'Sum of all 5s', sixes:'Sum of all 6s',
  threeOfAKind:'3 same → sum all', fourOfAKind:'4 same → sum all',
  fullHouse:'3+2 → 25 pts', smallStraight:'4-seq → 30 pts',
  largeStraight:'5-seq → 40 pts', yahtzee:'5 same → 50 pts', chance:'Sum all',
};

// ─── score preview (client-side mirror of server logic) ──────────────────────
function previewScore(cat, dice) {
  if (!dice || dice.every(d => d === 0)) return null;
  const counts = [0,0,0,0,0,0,0];
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a,b) => a+b, 0);
  switch (cat) {
    case 'ones':   return counts[1]*1;
    case 'twos':   return counts[2]*2;
    case 'threes': return counts[3]*3;
    case 'fours':  return counts[4]*4;
    case 'fives':  return counts[5]*5;
    case 'sixes':  return counts[6]*6;
    case 'threeOfAKind':  return counts.some(c=>c>=3)?sum:0;
    case 'fourOfAKind':   return counts.some(c=>c>=4)?sum:0;
    case 'fullHouse':     return (counts.some(c=>c===3)&&counts.some(c=>c===2))?25:0;
    case 'smallStraight': {
      const u=[...new Set(dice)].sort().join('');
      return(u.includes('1234')||u.includes('2345')||u.includes('3456'))?30:0;
    }
    case 'largeStraight': {
      const u=[...new Set(dice)].sort().join('');
      return(u==='12345'||u==='23456')?40:0;
    }
    case 'yahtzee': return counts.some(c=>c===5)?50:0;
    case 'chance':  return sum;
    default: return 0;
  }
}

// ─── Die component ───────────────────────────────────────────────────────────
const DOT_POSITIONS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,25],[72,25],[28,50],[72,50],[28,75],[72,75]],
};

function Die({ value, held, onClick, canInteract, shaking }) {
  return (
    <button
      className={[
        'yz-die',
        held        ? 'held'    : '',
        shaking     ? 'shaking' : '',
        !canInteract? 'locked'  : '',
        value === 0 ? 'unrolled': '',
      ].join(' ')}
      onClick={canInteract ? onClick : undefined}
      title={canInteract ? (held ? 'Click to unhold' : 'Click to hold') : ''}
    >
      <svg viewBox="0 0 100 100">
        <rect x="4" y="4" width="92" height="92" rx="20"
          className="die-face" />
        {value > 0
          ? (DOT_POSITIONS[value] || []).map(([cx,cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="9" className="die-dot" />
            ))
          : <text x="50" y="62" textAnchor="middle" fontSize="36" className="die-q">?</text>
        }
      </svg>
      {held && <span className="held-label">HELD</span>}
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function YahtzeeGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby,
  onChangeGame, onGameAction, error,
}) {
  const [shakingDice, setShakingDice] = useState([]);
  const [scoreFlash,  setScoreFlash]  = useState(null); // { cat, pts }
  const [hoverCat,    setHoverCat]    = useState(null);
  const [viewingPlayer, setViewingPlayer] = useState(null); // for multi-player scorecard tabs

  // augment for WaitingRoom
  const augmented = { ...gameState, minPlayers: gameState.minPlayers ?? 1, maxPlayers: gameState.maxPlayers ?? 4 };

  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error} />;
  }
  if (gameState.state === 'finished') {
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;
  }

  const { dice, held, rollsLeft, currentPlayerIndex, scores, players,
          settings, round, phase } = gameState;

  const curPlayer   = players[currentPlayerIndex];
  const isMyTurn    = curPlayer?.id === playerId;
  const mySheet     = scores[playerId]?.sheet || {};
  const myTotal     = scores[playerId]?.total  ?? 0;
  const myUbSub     = scores[playerId]?.upperSubtotal ?? 0;
  const myUbBonus   = scores[playerId]?.upperBonus    ?? 0;

  // which player's scorecard to show (default: me)
  const viewId = viewingPlayer ?? playerId;
  const viewSheet = scores[viewId]?.sheet || {};
  const viewTotal = scores[viewId]?.total  ?? 0;
  const viewUbSub = scores[viewId]?.upperSubtotal ?? 0;
  const viewUbBonus = scores[viewId]?.upperBonus  ?? 0;
  const isViewingMe = viewId === playerId;

  const canRoll  = isMyTurn && rollsLeft > 0 && phase !== 'scored';
  const canScore = isMyTurn && phase === 'scoring' && dice.some(d => d > 0);

  function handleRoll() {
    if (!canRoll) return;
    // animate unheld dice
    const animIdx = held.map((h, i) => !h ? i : -1).filter(i => i >= 0);
    setShakingDice(animIdx);
    setTimeout(() => setShakingDice([]), 500);
    onGameAction('roll');
  }

  function handleHold(i) {
    if (!isMyTurn || !canScore) return;
    onGameAction('hold', { index: i });
  }

  function handleScore(cat) {
    if (!canScore) return;
    if (viewSheet[cat] != null) return;
    const pts = previewScore(cat, dice);
    setScoreFlash({ cat, pts });
    setTimeout(() => setScoreFlash(null), 1800);
    onGameAction('score', { category: cat });
  }

  // ── render a single scorecard row ────────────────────────────────────────
  function ScoreRow({ cat }) {
    const scored   = viewSheet[cat] != null;
    const isMe     = isViewingMe;
    const preview  = !scored && isMe && canScore
                     ? previewScore(cat, dice)
                     : null;
    const isHov    = hoverCat === cat;
    const isZero   = preview === 0;
    const clickable = !scored && isMe && canScore;

    return (
      <div
        className={[
          'yz-row',
          scored        ? 'scored'    : '',
          clickable     ? 'clickable' : '',
          isHov&&clickable?'hovered'  : '',
          isZero&&isHov ? 'zero-warn' : '',
          scoreFlash?.cat === cat ? 'flash' : '',
        ].join(' ')}
        onClick={() => clickable && handleScore(cat)}
        onMouseEnter={() => setHoverCat(cat)}
        onMouseLeave={() => setHoverCat(null)}
        title={CAT_DESC[cat]}
      >
        <span className="yz-cat-name">{CAT_LABEL[cat]}</span>
        <span className="yz-cat-score">
          {scored
            ? viewSheet[cat]
            : preview !== null
              ? <span className={`yz-preview ${isZero?'zero':''}`}>{preview}</span>
              : <span className="yz-dash">—</span>
          }
        </span>
      </div>
    );
  }

  const rollBtnLabel = () => {
    if (!isMyTurn)   return `${curPlayer?.name || '?'}'s turn…`;
    if (rollsLeft === 3) return '🎲 Roll Dice';
    if (rollsLeft > 0)   return `🎲 Roll Again (${rollsLeft} left)`;
    return '✅ Pick a category to score';
  };

  return (
    <div className="yz-game">

      {/* ── header bar ── */}
      <div className="yz-topbar">
        <div className="yz-topbar-left">
          <span className="yz-round-badge">Round {round} / 13</span>
        </div>
        <div className="yz-topbar-center">
          {isMyTurn
            ? <span className="yz-your-turn">🎲 Your Turn</span>
            : <span className="yz-wait">⏳ {curPlayer?.name}'s turn</span>
          }
        </div>
        <div className="yz-topbar-right">
          <span className="yz-roll-pips">
            {Array.from({length:3}).map((_,i)=>(
              <span key={i} className={`yz-pip ${i < rollsLeft ? 'on':''}`}>●</span>
            ))}
          </span>
        </div>
      </div>

      <div className="yz-body">

        {/* ── dice + roll button ── */}
        <div className="yz-dice-panel">
          <div className="yz-dice-row">
            {dice.map((val, i) => (
              <Die key={i} value={val} held={held[i]}
                shaking={shakingDice.includes(i)}
                canInteract={isMyTurn && canScore && rollsLeft > 0}
                onClick={() => handleHold(i)} />
            ))}
          </div>

          <button
            className={`yz-roll-btn ${!canRoll ? 'disabled' : ''}`}
            onClick={handleRoll}
            disabled={!canRoll}
          >
            {rollBtnLabel()}
          </button>

          {canScore && rollsLeft > 0 && (
            <p className="yz-hint">Hold dice to keep, then roll again — or pick a category below</p>
          )}
          {canScore && rollsLeft === 0 && (
            <p className="yz-hint warn">No rolls left — you must score a category!</p>
          )}

          {/* mini scores for all players */}
          {players.length > 1 && (
            <div className="yz-mini-scores">
              {players.map((p, i) => {
                const tot = scores[p.id]?.total ?? 0;
                const isActive = i === currentPlayerIndex;
                return (
                  <div key={p.id}
                    className={`yz-mini-player ${isActive?'active':''} ${p.id===playerId?'me':''}`}
                    onClick={() => setViewingPlayer(p.id === viewingPlayer ? null : p.id)}
                    title={`Click to view ${p.name}'s scorecard`}
                  >
                    <span className="yz-mini-name">{p.name}</span>
                    <span className="yz-mini-total">{tot}</span>
                    {isActive && <span className="yz-mini-arrow">▲</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── scorecard ── */}
        <div className="yz-scorecard">
          {players.length > 1 && (
            <div className="yz-sc-header">
              <span className="yz-sc-title">
                {isViewingMe ? 'Your Scorecard' : `${players.find(p=>p.id===viewId)?.name}'s Scorecard`}
              </span>
              {!isViewingMe && (
                <button className="yz-sc-back" onClick={() => setViewingPlayer(null)}>
                  View Mine
                </button>
              )}
            </div>
          )}

          {/* upper section */}
          <div className="yz-section-label">
            Upper Section
            <span className="yz-bonus-progress">
              {viewUbSub}/63
              {viewUbBonus > 0 ? ' ✅ +35' : viewUbSub >= 63 ? '' : ` (need ${63-viewUbSub} more)`}
            </span>
          </div>
          <div className="yz-progress-bar">
            <div className="yz-progress-fill" style={{width:`${Math.min(100,(viewUbSub/63)*100)}%`}}/>
          </div>

          {UPPER_CATS.map(cat => <ScoreRow key={cat} cat={cat} />)}

          <div className="yz-bonus-row">
            <span>Upper Bonus (≥63)</span>
            <span className="yz-bonus-val">{viewUbBonus > 0 ? '+35' : '—'}</span>
          </div>

          {/* lower section */}
          <div className="yz-section-label" style={{marginTop:6}}>Lower Section</div>
          {CATEGORIES.filter(c => !UPPER_CATS.includes(c)).map(cat => <ScoreRow key={cat} cat={cat} />)}

          {settings?.bonusYahtzee && (
            <div className="yz-bonus-row">
              <span>Bonus Yahtzees</span>
              <span className="yz-bonus-val">
                {viewSheet.bonusYahtzees
                  ? `×${viewSheet.bonusYahtzees} = +${viewSheet.bonusYahtzees*100}`
                  : '—'}
              </span>
            </div>
          )}

          <div className="yz-total-row">
            <span>TOTAL</span>
            <span className="yz-total-val">{viewTotal}</span>
          </div>
        </div>

      </div>

      {/* score flash */}
      {scoreFlash && (
        <div className="yz-score-flash">
          +{scoreFlash.pts} — {CAT_LABEL[scoreFlash.cat]}
        </div>
      )}
    </div>
  );
}
