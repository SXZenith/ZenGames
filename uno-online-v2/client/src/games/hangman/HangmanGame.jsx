import React, { useState, useEffect, useRef } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './HangmanGame.css';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Web Audio ────────────────────────────────────────────────────────────────
let _ctx = null;
function ac() { if (!_ctx) _ctx = new (window.AudioContext||window.webkitAudioContext)(); return _ctx; }
function beep(freq, dur, type='sine', vol=0.15) {
  try {
    const o = ac().createOscillator(), g = ac().createGain();
    o.connect(g); g.connect(ac().destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac().currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac().currentTime + dur);
    o.start(); o.stop(ac().currentTime + dur + 0.02);
  } catch(e) {}
}
const soundHit   = () => { beep(660,'sine',0.12); setTimeout(()=>beep(880,0.1,'sine',0.1),80); };
const soundMiss  = () => { beep(200,0.15,'sawtooth',0.12); };
const soundSolve = () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.2),i*90));
const soundFail  = () => [300,250,200,150].forEach((f,i)=>setTimeout(()=>beep(f,0.15,'sawtooth',0.1),i*80));

// ── Hangman SVG drawing ──────────────────────────────────────────────────────
function HangmanSVG({ wrongCount, maxWrong }) {
  const pct = wrongCount / maxWrong;
  const isGrim = wrongCount >= maxWrong;
  return (
    <svg viewBox="0 0 200 240" className={`hm-svg ${isGrim ? 'dead' : ''}`}>
      {/* gallows */}
      <line x1="20" y1="230" x2="180" y2="230" stroke="#4a6680" strokeWidth="4" strokeLinecap="round"/>
      <line x1="60" y1="230" x2="60" y2="20" stroke="#4a6680" strokeWidth="4" strokeLinecap="round"/>
      <line x1="60" y1="20" x2="130" y2="20" stroke="#4a6680" strokeWidth="4" strokeLinecap="round"/>
      <line x1="130" y1="20" x2="130" y2="45" stroke="#4a6680" strokeWidth="3" strokeLinecap="round"/>
      {/* body parts – appear progressively */}
      {wrongCount >= 1 && <circle cx="130" cy="60" r="15" fill="none" stroke="#e63946" strokeWidth="3"/>}
      {wrongCount >= 2 && <line x1="130" y1="75" x2="130" y2="135" stroke="#e63946" strokeWidth="3" strokeLinecap="round"/>}
      {wrongCount >= 3 && <line x1="130" y1="90" x2="105" y2="115" stroke="#e63946" strokeWidth="3" strokeLinecap="round"/>}
      {wrongCount >= 4 && <line x1="130" y1="90" x2="155" y2="115" stroke="#e63946" strokeWidth="3" strokeLinecap="round"/>}
      {wrongCount >= 5 && <line x1="130" y1="135" x2="108" y2="165" stroke="#e63946" strokeWidth="3" strokeLinecap="round"/>}
      {wrongCount >= 6 && <line x1="130" y1="135" x2="152" y2="165" stroke="#e63946" strokeWidth="3" strokeLinecap="round"/>}
      {/* face when dead */}
      {isGrim && <>
        <line x1="122" y1="54" x2="127" y2="59" stroke="#e63946" strokeWidth="2"/>
        <line x1="127" y1="54" x2="122" y2="59" stroke="#e63946" strokeWidth="2"/>
        <line x1="133" y1="54" x2="138" y2="59" stroke="#e63946" strokeWidth="2"/>
        <line x1="138" y1="54" x2="133" y2="59" stroke="#e63946" strokeWidth="2"/>
        <path d="M 122 68 Q 130 63 138 68" fill="none" stroke="#e63946" strokeWidth="2"/>
      </>}
      {/* progress bar underneath */}
      <rect x="10" y="238" width="180" height="4" rx="2" fill="#1a2a3e"/>
      <rect x="10" y="238" width={180*pct} height="4" rx="2" fill={pct>0.7?'#e63946':'#4cc9f0'} style={{transition:'width 0.4s'}}/>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HangmanGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  // ── ALL HOOKS BEFORE EARLY RETURNS ──
  const [prevWrong, setPrevWrong] = useState(0);
  const [shake, setShake]         = useState(false);

  const wrongCount = gameState.wrongGuesses?.length ?? 0;
  const solved     = gameState.solved ?? false;
  const failed     = gameState.failed ?? false;

  useEffect(() => {
    if (wrongCount > prevWrong) {
      if (failed) soundFail(); else soundMiss();
      setShake(true); setTimeout(() => setShake(false), 500);
    }
    setPrevWrong(wrongCount);
  }, [wrongCount]);

  useEffect(() => {
    if (solved) soundSolve();
  }, [solved]);

  // ── EARLY RETURNS AFTER HOOKS ──
  const augmented = { ...gameState, minPlayers: 2, maxPlayers: 4 };
  if (gameState.state === 'waiting')
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error}/>;
  if (gameState.state === 'finished')
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby}/>;

  const {
    maskedWord, category, wordLength, guessed, wrongGuesses,
    maxWrong, revealedWord, currentGuesserIndex, round,
    wordHistory, players, settings,
  } = gameState;

  const curPlayer = players[currentGuesserIndex];
  const isMyTurn  = curPlayer?.id === playerId;
  const me        = players.find(p => p.id === playerId);

  function handleGuess(letter) {
    if (!isMyTurn || solved || failed || guessed.includes(letter)) return;
    if (guessed.includes(letter)) return;
    onGameAction('guess', { letter });
    if (gameState.maskedWord) {
      // optimistic sound
      const wouldHit = gameState.maskedWord.some((c,i) => gameState.maskedWord[i]==='_' && false);
    }
  }

  return (
    <div className="hm-game">
      {/* header */}
      <div className="hm-bar">
        <span className="hm-round-pill">Round {round}/5</span>
        <span className={`hm-turn ${isMyTurn?'mine':''}`}>
          {isMyTurn ? '🔤 Your Turn' : `⏳ ${curPlayer?.name}'s turn`}
        </span>
        <div className="hm-scores">
          {players.map(p => (
            <span key={p.id} className={`hm-score-chip ${p.id===playerId?'me':''}`}>
              {p.name.split(' ')[0]} {p.score||0}
            </span>
          ))}
        </div>
      </div>

      <div className="hm-body">
        {/* left: gallows */}
        <div className={`hm-left ${shake?'shake':''}`}>
          <HangmanSVG wrongCount={wrongCount} maxWrong={maxWrong}/>
          <div className="hm-wrong-letters">
            {wrongGuesses.map(l => <span key={l} className="hm-wrong-l">{l}</span>)}
          </div>
        </div>

        {/* right: word + keyboard */}
        <div className="hm-right">
          {category && (
            <div className="hm-category">Category: <strong>{category}</strong></div>
          )}

          <div className="hm-word-row">
            {(revealedWord || gameState.word || '').split('').map((letter, i) => {
              const revealed = solved || failed;
              const display  = revealed ? letter : (maskedWord?.[i] || '_');
              const correct  = display !== '_';
              const wrong    = revealed && !guessed.includes(letter);
              return (
                <div key={i} className={`hm-letter-box ${correct?'correct':''} ${wrong?'wrong-reveal':''}`}>
                  {display}
                </div>
              );
            })}
          </div>

          {(solved || failed) && (
            <div className={`hm-result-banner ${solved?'solved':'failed'}`}>
              {solved
                ? `✅ ${curPlayer?.name} solved it!`
                : `💀 The word was: ${revealedWord}`}
              <span className="hm-next-hint">Next round starting…</span>
            </div>
          )}

          {/* keyboard */}
          <div className={`hm-keyboard ${!isMyTurn||solved||failed?'disabled':''}`}>
            {ALPHABET.map(l => {
              const isGuessed = guessed.includes(l);
              const isWrong   = wrongGuesses.includes(l);
              const isCorrect = isGuessed && !isWrong;
              return (
                <button key={l}
                  className={`hm-key ${isWrong?'miss':''} ${isCorrect?'hit':''}`}
                  disabled={isGuessed||!isMyTurn||solved||failed}
                  onClick={()=>handleGuess(l)}
                >
                  {l}
                </button>
              );
            })}
          </div>

          {!isMyTurn && !solved && !failed && (
            <div className="hm-waiting">Waiting for {curPlayer?.name} to guess…</div>
          )}
        </div>
      </div>

      {/* word history */}
      {wordHistory.length > 0 && (
        <div className="hm-history">
          {wordHistory.slice(-3).map((h,i) => (
            <span key={i} className={`hm-hist-item ${h.result}`}>
              {h.word} {h.result==='solved'?`✅ ${h.winner}`:'💀'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
