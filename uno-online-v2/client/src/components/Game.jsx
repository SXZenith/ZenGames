import React, { useState, useCallback, useEffect, useRef } from 'react';
import { UnoCard, CardBack } from './Card';
import ColorPicker from './ColorPicker';
import {
  soundCardPlace, soundCardDraw, soundWild, soundUno, soundCatch,
  soundSkip, soundDraw2, soundYourTurn,
} from '../sounds';
import './Game.css';
import { WaitingRoom } from '../games/SharedRoom';

const COLOR_NAMES = { red:'#ff3b52', yellow:'#ffd93d', green:'#06d6a0', blue:'#4cc9f0' };

function getFanStyle(index, total, isSelected) {
  if (total === 0) return {};
  // Use viewport width to keep cards on screen
  const vw = Math.min(window.innerWidth, 600); // cap at 600px
  const cardW = Math.min(80, Math.floor((vw - 32) / Math.max(total, 1) * 1.4));
  const clampedCard = Math.max(40, Math.min(80, cardW));
  const overlap = total <= 7
    ? Math.max(0, clampedCard - Math.floor((vw - 32 - clampedCard) / Math.max(total - 1, 1)))
    : clampedCard - Math.floor((vw - 32 - clampedCard) / Math.max(total - 1, 1));
  const step = Math.max(18, clampedCard - Math.max(0, overlap));
  const totalWidth = (total - 1) * step + clampedCard;
  const startOffset = -totalWidth / 2;
  const offsetFromCenter = startOffset + index * step;
  return {
    left:   `calc(50% + ${offsetFromCenter}px)`,
    zIndex: isSelected ? 100 : index,
  };
}

export default function Game({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onPlayCard, onDrawCard, onPassTurn, onRematch, onReturnToLobby,
  onCallUno, onCatchUno, onUpdateSettings, onSendReaction, onSendChat,
  onChangeGame,
  error,
}) {
  const [selectedCard,    setSelectedCard]    = useState(null);
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [copied,          setCopied]          = useState(false);
  const [timerLeft,       setTimerLeft]       = useState(null);
  const [deckShake,       setDeckShake]       = useState(false);
  const [unoTimer,        setUnoTimer]        = useState(null);
  const [toastMsg,        setToastMsg]        = useState('');
  const [actionMsg,       setActionMsg]       = useState(null); // {text, color}
  const [showWinner,      setShowWinner]      = useState(false);
  const [showScoreboard,  setShowScoreboard]  = useState(false);

  const toastRef        = useRef(null);
  const prevFinishedRef = useRef(false);
  const timerRef        = useRef(null);
  const unoTimerRef     = useRef(null);
  const prevTurnRef     = useRef(null);
  const prevLastAction  = useRef(null);
  const prevUnoVuln     = useRef(null);

  // Auto-dismiss error toast after 3s
  useEffect(() => {
    if (error) {
      setToastMsg(error);
      clearTimeout(toastRef.current);
      toastRef.current = setTimeout(() => setToastMsg(''), 3000);
    }
  }, [error]);

  const me            = gameState.players.find(p => p.id === playerId);
  const isHost        = gameState.players[0]?.id === playerId;
  const isMyTurn      = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const myHandSize    = me?.hand?.length ?? 0;
  const settings      = gameState.settings ?? {};
  const unoVuln       = gameState.unoVulnerable;
  const iAmVulnerable = unoVuln?.playerId === playerId;
  const iCalledUno    = me?.unoCalled ?? false;
  const isFinished    = gameState.state === 'finished';
  const drawingStreak = gameState.drawingStreak === true && isMyTurn;

  // UNO button: show at 1 OR 2 cards — can call after playing down to 1
  const showUnoButton = !iCalledUno && (
    (isMyTurn && myHandSize === 2) ||       // your turn, about to play 2nd-to-last
    (!isMyTurn && myHandSize === 1)          // just played down to 1, forgot to call
  );

  // ── Turn sound (no flash) ─────────────────────────────────────────────────
  useEffect(() => {
    if (isMyTurn && prevTurnRef.current === false) soundYourTurn();
    prevTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // ── Sounds + action message ──────────────────────────────────────────────
  useEffect(() => {
    if (!gameState.lastAction || gameState.lastAction === prevLastAction.current) return;
    prevLastAction.current = gameState.lastAction;
    const { type, card, player } = gameState.lastAction;
    const C = { red:'#ff3b52', yellow:'#ffd93d', green:'#06d6a0', blue:'#4cc9f0', wild:'#c840ff' };
    if (type === 'play') {
      const col = C[card?.color] || '#fff';
      if (card?.value === 'skip') {
        soundSkip();
        setActionMsg({ text: [player, ' played a ', 'Skip!',    col] });
      } else if (card?.value === 'reverse') {
        soundSkip();
        setActionMsg({ text: [player, ' played a ', 'Reverse!', col] });
      } else if (card?.value === 'draw2') {
        soundDraw2();
        setActionMsg({ text: [player, ' played a ', '+2!',      col] });
      } else if (card?.value === 'wild4') {
        soundWild();
        setActionMsg({ text: [player, ' played a ', '+4 Wild!', col] });
      } else if (card?.color === 'wild') {
        soundWild();
        setActionMsg({ text: [player, ' played a ', 'Wild!',    col] });
      } else {
        soundCardPlace();
        setActionMsg({ text: [player, ' played a card', '', col] });
      }
    } else if (type === 'draw') {
      soundCardDraw();
      setDeckShake(true); setTimeout(() => setDeckShake(false), 500);
      setActionMsg({ text: [player, ` drew ${gameState.lastAction.count} card${gameState.lastAction.count!==1?'s':''}`, '', '#aaa'] });
    } else if (type === 'uno-catch') {
      soundCatch();
      setActionMsg({ text: [player, ' was caught! ', '+4 cards 🎯', '#ff3b52'] });
    }
  }, [gameState.lastAction]);

  // ── Pick timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!isMyTurn || !settings.pickTimer || isFinished || drawingStreak) {
      setTimerLeft(null); return;
    }
    setTimerLeft(settings.pickTimer);
    timerRef.current = setInterval(() => {
      setTimerLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); onDrawCard(); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isMyTurn, gameState.currentPlayerIndex, settings.pickTimer, isFinished, drawingStreak]);

  // ── UNO countdown ring ────────────────────────────────────────────────────
  useEffect(() => {
    const vuln = gameState.unoVulnerable;
    if (vuln && vuln !== prevUnoVuln.current) {
      setUnoTimer(5);
      clearInterval(unoTimerRef.current);
      unoTimerRef.current = setInterval(() => {
        setUnoTimer(prev => { if (prev <= 1) { clearInterval(unoTimerRef.current); return null; } return prev - 1; });
      }, 1000);
    }
    if (!vuln) { clearInterval(unoTimerRef.current); setUnoTimer(null); }
    prevUnoVuln.current = vuln;
  }, [gameState.unoVulnerable]);

  // ── Win delay: show winner popup for 5s before scoreboard ─────────────────
  useEffect(() => {
    if (gameState.state === 'finished' && !prevFinishedRef.current) {
      prevFinishedRef.current = true;
      setShowWinner(true);
      setShowScoreboard(false);
      setTimeout(() => {
        setShowWinner(false);
        setShowScoreboard(true);
      }, 3000);
    }
    if (gameState.state !== 'finished') {
      prevFinishedRef.current = false;
      setShowWinner(false);
      setShowScoreboard(false);
    }
  }, [gameState.state]);

  // ── Keep-alive ping to prevent Render from sleeping ─────────────────────
  useEffect(() => {
    const ping = setInterval(() => {
      fetch('https://zengames.onrender.com/health').catch(() => {});
    }, 30000);
    return () => clearInterval(ping);
  }, []);

  const copyCode = useCallback(() => navigator.clipboard.writeText(roomCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }), [roomCode]);

  // ── Card click ────────────────────────────────────────────────────────────
  const handleCardClick = (card, isPlayable) => {
    if (!isMyTurn || !isPlayable) return;
    if (selectedCard?.id === card.id) {
      if (card.color === 'wild') { setPendingWildCard(card); setSelectedCard(null); }
      else { onPlayCard(card.id); setSelectedCard(null); }
    } else {
      setSelectedCard(card);
    }
  };
  const handleColorChosen = (color) => {
    if (pendingWildCard) { onPlayCard(pendingWildCard.id, color); setPendingWildCard(null); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // WAITING ROOM
  // ════════════════════════════════════════════════════════════════════════
  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={{...gameState, maxPlayers:4, settings: gameState.settings || {}}}
      playerId={playerId} roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error} />;
  }

  // ════════════════════════════════════════════════════════════════════════
  // GAME OVER
  // ════════════════════════════════════════════════════════════════════════
  if (gameState.state === 'finished') {
    const amWinner   = gameState.winner === me?.name;
    const scoreToWin = settings.scoreToWin || 500;
    const sorted = [...gameState.players].sort((a,b) => (b.totalScore||0) - (a.totalScore||0));
    const winner = gameState.players.find(p => p.name === gameState.winner);
    const winnerPts = winner?.roundPoints ?? 0;

    // Show winner splash for 5s, then scoreboard
    if (showWinner && !showScoreboard) {
      return (
        <div className="win-splash">
          <div className="win-splash-emoji">{amWinner ? '🎉' : '😢'}</div>
          <div className="win-splash-name">{amWinner ? 'YOU WON!' : `${gameState.winner} Won!`}</div>
          <div className="win-splash-score">+{winnerPts} points this round</div>
          <div className="win-splash-sub">Scoreboard in a moment…</div>
          <div className="win-splash-bar"><div className="win-splash-fill" style={{animationDuration:"3s"}} /></div>
        </div>
      );
    }

    return (
      <div className="game-over">
        <div className="game-over-card">
          <div className="go-emoji">{amWinner ? '🎉' : '😢'}</div>
          <h1 className="go-title">{amWinner ? 'You Won!' : `${gameState.winner} Won!`}</h1>

          {/* Round result */}
          <div className="go-section-label" style={{marginTop:0}}>This Round</div>
          <div className="go-scores">
            {gameState.players.map(p => {
              const isWinner = p.name === gameState.winner;
              return (
                <div key={p.id} className={`go-player ${p.id===playerId?'me':''} ${isWinner?'winner-row':''}`}>
                  <span className="go-player-name">
                    {isWinner && <span className="go-crown">👑 </span>}
                    {p.name}{p.id===playerId?' (you)':''}
                  </span>
                  <span className="go-round-pts">
                    {isWinner ? `+${p.roundPoints ?? 0} pts` : `${p.handSize} cards left`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Match scoreboard: points + wins */}
          <div className="go-section-label">
            Match Score <span className="go-score-target">(first to {scoreToWin})</span>
          </div>
          <div className="go-scoreboard">
            {sorted.map((p,i) => (
              <div key={p.id} className={`go-score-row ${p.id===playerId?'me':''}`}>
                <span className="go-rank">#{i+1}</span>
                <span className="go-score-name">{p.name}{p.id===playerId?' (you)':''}</span>
                <div className="go-score-right">
                  <span className="go-pts">{p.totalScore||0} pts</span>
                  <span className="go-wins-small">{p.score||0}W</span>
                </div>
              </div>
            ))}
          </div>

          {/* Match winner banner */}
          {gameState.matchWinner && (
            <div className="go-match-winner">
              🏆 {gameState.matchWinner} wins the match!
            </div>
          )}

          <div className="go-actions">
            {isHost ? (
              <>
                <button className="btn-primary" onClick={onRematch}>Rematch →</button>
                <button className="btn-exit" onClick={onReturnToLobby}>← Back to Lobby</button>
              </>
            ) : (
              <p className="waiting-for-host" style={{marginTop:0}}>Waiting for host…</p>
            )}
          </div>
          <p className="go-exit-note">
            {isHost ? 'Back to Lobby resets scores and returns everyone to the room.' : ''}
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // IN GAME
  // ════════════════════════════════════════════════════════════════════════
  const opponents    = gameState.players.filter(p => p.id !== playerId);
  const topCard      = gameState.topCard;
  const currentColor = gameState.currentColor;
  const hand         = me?.hand ?? [];

  const playableSet = new Set();
  if (isMyTurn) {
    hand.forEach(card => {
      let ok = false;
      if (gameState.pendingDraw > 0) {
        const t = gameState.pendingDrawType;
        if (t==='draw2' && card.value==='draw2' && settings.stackDraw2) ok = true;
        if (t==='wild4' && card.value==='wild4' && settings.stackDraw4) ok = true;
      } else {
        if (card.color==='wild')              ok = true;
        else if (card.color===currentColor)   ok = true;
        else if (card.value===topCard?.value) ok = true;
      }
      if (ok) playableSet.add(card.id);
    });
  }

  const drawLabel = gameState.pendingDraw > 0
    ? `Draw ${gameState.pendingDraw}`
    : drawingStreak ? 'Draw Again' : 'Draw';

  return (
    <div className="game">
      {pendingWildCard && <ColorPicker onChoose={handleColorChosen} />}



      {/* ── Opponents ── */}
      <div className="opponents-row">
        {opponents.map(p => {
          const isTheirTurn  = gameState.players[gameState.currentPlayerIndex]?.id === p.id;
          const pi           = gameState.players.indexOf(p);
          const fanCount     = Math.min(p.handSize, 16);
          const isVulnerable = unoVuln?.playerId === p.id;
          return (
            <div key={p.id} className={`opponent-area ${isTheirTurn?'active-turn':''}`}>
              <div className="opp-info">
                <div className="opp-avatar" style={{background:`hsl(${pi*90},60%,50%)`}}>{p.name[0]}</div>
                <div>
                  <div className="opp-name">{p.name}</div>
                  <div className="opp-count">{p.handSize} card{p.handSize!==1?'s':''}</div>
                </div>
                {isTheirTurn    && <div className="turn-dot" />}
                {!p.isConnected && <div className="dc-dot" />}
              </div>
              <div className="opp-hand-fan">
                {Array.from({length:fanCount}).map((_,idx) => {
                  const s   = fanCount<=1 ? 0 : (idx/(fanCount-1))-0.5;
                  const tx  = s * Math.min(55, fanCount*5);
                  const rot = s * Math.min(38, fanCount*3);
                  return (
                    <div key={idx} className="opp-fan-card" style={{transform:`translateX(${tx}px) rotate(${rot}deg)`,zIndex:idx}}>
                      <CardBack small />
                    </div>
                  );
                })}
                {p.handSize>16 && <span className="more-cards">+{p.handSize-16}</span>}
              </div>
              {isVulnerable && (
                <div className="uno-catch-wrap">
                  <button className="uno-call-btn" onClick={() => onCatchUno(p.id)}>🎯 Catch UNO!</button>
                  {unoTimer !== null && (
                    <div className="uno-countdown-ring">
                      <svg viewBox="0 0 36 36" className="uno-ring-svg">
                        <circle cx="18" cy="18" r="15" className="uno-ring-bg" />
                        <circle cx="18" cy="18" r="15" className="uno-ring-fill" strokeDasharray={`${(unoTimer/5)*94} 94`} />
                      </svg>
                      <span className="uno-ring-num">{unoTimer}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div className="table-area">
        <div className="game-info-strip">
          {timerLeft !== null && <div className={`timer-badge ${timerLeft<=5?'urgent':''}`}>{timerLeft}s</div>}
          <div className="turn-indicator">
            {isMyTurn
              ? <span className="your-turn">✦ Your Turn!</span>
              : <span className="their-turn">{currentPlayer?.name}'s turn</span>}
          </div>
          {gameState.pendingDraw > 0 && (
            <div className="draw-stack-badge">
              {gameState.pendingDrawType==='draw2'?`+2 Stack (${gameState.pendingDraw})`:`+4 Stack (${gameState.pendingDraw})`}
            </div>
          )}
          <div className="color-pill" style={{
            background: `${COLOR_NAMES[currentColor] ?? '#888'}22`,
            border: `2px solid ${COLOR_NAMES[currentColor] ?? '#888'}`,
            boxShadow: `0 0 16px 4px ${COLOR_NAMES[currentColor] ?? '#888'}55`,
          }}>
            <div className="color-pill-dot" style={{ background: COLOR_NAMES[currentColor] ?? '#888' }} />
            <span className="color-pill-name">{currentColor}</span>
          </div>
        </div>

        <div className="play-area">
          <div className="deck-area">
            <div className={deckShake?'deck-shake':''}><CardBack /></div>
            <div className="deck-count">{gameState.deckSize} left</div>
            {isMyTurn && (
              <button className="draw-btn" onClick={onDrawCard}>{drawLabel}</button>
            )}
            {isMyTurn && drawingStreak && gameState.pendingDraw===0 && gameState.deckSize===0 && (
              <button className="pass-btn" onClick={onPassTurn}>Pass (deck empty)</button>
            )}
          </div>
          <div className="discard-area">
            {topCard && <UnoCard card={topCard} disabled />}
          </div>

        </div>

        <div className="action-feed-area">
          <div className="action-msg">
            {actionMsg ? (
              <span>
                <span className="am-player">{actionMsg.text[0]}</span>
                <span className="am-plain">{actionMsg.text[1]}</span>
                {actionMsg.text[2] && (
                  <span className="am-special" style={{color: actionMsg.text[3]}}>{actionMsg.text[2]}</span>
                )}
              </span>
            ) : (
              <span className="am-idle">—</span>
            )}
          </div>
          <div className="uno-status-row">
            {gameState.players
              .filter(p => p.unoCalled && (p.hand?.length === 1 || p.handSize === 1))
              .map(p => (
                <span key={p.id} className={`uno-status-pill ${p.id === playerId ? 'mine' : ''}`}>
                  🃏 {p.id === playerId ? 'You have' : `${p.name} has`} UNO!
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* ── My hand: flat scrollable row ── */}
      <div className="my-hand-area">
        <div className="hand-label">
          <div className="hand-stats">
            <span className="hand-stat">Cards <span className="hand-stat-val">({myHandSize})</span></span>
            <span className="hand-stat-div">|</span>
            <span className="hand-stat">Score <span className="hand-stat-val score-stat">{hand.reduce((s,c) => {
              const n = parseInt(c.value); if (!isNaN(n)) return s+n;
              if (c.value==='draw2'||c.value==='skip'||c.value==='reverse') return s+20;
              if (c.color==='wild') return s+50;
              return s;
            }, 0)}</span></span>
          </div>
          {iAmVulnerable && <span className="uno-warn">⚠ Call UNO!</span>}
          {drawingStreak && playableSet.size > 0 && <span className="drawing-hint">▲ Play it!</span>}
          {drawingStreak && playableSet.size === 0 && <span className="drawing-hint">Keep drawing…</span>}
        </div>

        <div className="hand-fan-container">
          {hand.map((card, idx) => {
            const isSelected = selectedCard?.id === card.id;
            const isPlayable = playableSet.has(card.id);
            const style = getFanStyle(idx, hand.length, isSelected);
            return (
              <div
                key={card.id}
                className={`hand-fan-item ${isSelected?'selected':''} ${isPlayable&&isMyTurn?'playable':'not-playable'}`}
                style={style}
                onClick={() => handleCardClick(card, isPlayable)}
              >
                <UnoCard card={card} selected={isSelected} disabled={!isPlayable||!isMyTurn} />

              </div>
            );
          })}
        </div>

        {selectedCard && isMyTurn && <div className="play-hint">Click the card again to play it</div>}

        {showUnoButton && (
          <button className="my-uno-btn" onClick={() => { onCallUno(); soundUno(); }}>
            🃏 UNO!
          </button>
        )}
        {iCalledUno && (myHandSize === 1 || myHandSize === 2) && (
          <div className="uno-called-badge">✓ UNO Called!</div>
        )}
      </div>

      {toastMsg && <div className="error-toast">⚠ {toastMsg}</div>}
    </div>
  );
}
