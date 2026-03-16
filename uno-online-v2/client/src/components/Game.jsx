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
  // Flat stacking: cards overlap, spread across the container width
  // Each card is 80px wide; overlap tightens as more cards are added
  const cardW = 80;
  const containerW = 600; // approximate container width
  const maxVisible = containerW - cardW; // space for all but last card
  const step = total <= 1 ? 0 : Math.min(cardW - 4, maxVisible / (total - 1));
  const totalWidth = (total - 1) * step + cardW;
  const startX = Math.max(0, (containerW - totalWidth) / 2);
  const left = startX + index * step;
  return {
    left:   `${left}px`,
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
  const [turnFlash,       setTurnFlash]       = useState(false);

  const timerRef       = useRef(null);
  const unoTimerRef    = useRef(null);
  const prevTurnRef    = useRef(null);
  const prevLastAction = useRef(null);
  const prevUnoVuln    = useRef(null);

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

  // UNO button: only on YOUR turn with exactly 2 cards, not yet called
  const showUnoButton = isMyTurn && myHandSize === 2 && !iCalledUno;

  // ── Sounds ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState.lastAction || gameState.lastAction === prevLastAction.current) return;
    prevLastAction.current = gameState.lastAction;
    const { type, card } = gameState.lastAction;
    if (type === 'play') {
      if (card?.color === 'wild')                                    soundWild();
      else if (card?.value === 'draw2')                              soundDraw2();
      else if (card?.value === 'skip' || card?.value === 'reverse')  soundSkip();
      else                                                           soundCardPlace();
    } else if (type === 'draw') {
      soundCardDraw();
      setDeckShake(true); setTimeout(() => setDeckShake(false), 500);
    } else if (type === 'uno-catch') {
      soundCatch();
    }
  }, [gameState.lastAction]);

  // ── Turn flash ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMyTurn && prevTurnRef.current === false) {
      soundYourTurn();
      setTurnFlash(true);
      setTimeout(() => setTurnFlash(false), 1800);
    }
    prevTurnRef.current = isMyTurn;
  }, [isMyTurn]);

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
    return <WaitingRoom gameState={{...gameState, maxPlayers:4}}
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

      {turnFlash && (
        <div className="turn-flash-overlay">
          <div className="turn-flash-text">YOUR TURN</div>
        </div>
      )}

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
          <div className="color-indicator" style={{
            background: COLOR_NAMES[currentColor] ?? '#888',
            boxShadow:  `0 0 12px 4px ${COLOR_NAMES[currentColor]??'#888'}55`,
          }} />
        </div>

        <div className="play-area">
          <div className="deck-area">
            <div className={deckShake?'deck-shake':''}><CardBack /></div>
            <div className="deck-count">{gameState.deckSize} left</div>
            {isMyTurn && (
              <button className="draw-btn" onClick={onDrawCard}>{drawLabel}</button>
            )}
            {isMyTurn && drawingStreak && gameState.pendingDraw===0 && (
              <button className="pass-btn" onClick={onPassTurn}>Pass Turn</button>
            )}
          </div>
          <div className="discard-area">
            {topCard && <UnoCard card={topCard} disabled />}
          </div>
        </div>

        <div className="last-action">
          {gameState.lastAction && (
            gameState.lastAction.type==='draw'
              ? `${gameState.lastAction.player} drew ${gameState.lastAction.count} card${gameState.lastAction.count!==1?'s':''}`
              : gameState.lastAction.type==='uno-catch'
                ? `🎯 ${gameState.lastAction.player} was caught! +4 cards`
                : `${gameState.lastAction.player} played a card`
          )}
        </div>
      </div>

      {/* ── My hand: flat scrollable row ── */}
      <div className="my-hand-area">
        <div className="hand-label">
          Your hand <span className="hand-count">({myHandSize})</span>
          {iAmVulnerable && <span className="uno-warn">⚠ Call UNO!</span>}
          {drawingStreak && <span className="drawing-hint">Play a card or Pass Turn</span>}
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
        {isMyTurn && iCalledUno && myHandSize === 2 && (
          <div className="uno-called-badge">✓ UNO Called!</div>
        )}
      </div>

      {error && <div className="error-toast">⚠ {error}</div>}
    </div>
  );
}
