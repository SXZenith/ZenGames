import React, { useState, useRef, useEffect } from 'react';
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
const CAT_MAX = {
  ones:5, twos:10, threes:15, fours:20, fives:25, sixes:30,
  threeOfAKind:30, fourOfAKind:30, fullHouse:25,
  smallStraight:30, largeStraight:40, yahtzee:50, chance:30,
};

// ─── Audio engine ─────────────────────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone(freq, type, duration, gainVal = 0.18, delay = 0) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch(e) {}
}

function playNoise(duration, gainVal = 0.08, delay = 0) {
  try {
    const ctx = getAudioCtx();
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
    src.buffer = buf;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.05);
  } catch(e) {}
}

function soundDiceRoll() {
  // Rattling dice: bursts of noise + random high tones
  for (let i = 0; i < 6; i++) {
    playNoise(0.06, 0.12, i * 0.07);
    playTone(300 + Math.random()*400, 'square', 0.04, 0.06, i * 0.07 + 0.01);
  }
  playNoise(0.15, 0.08, 0.5);
}

function soundHold(held) {
  // Click sound - higher if holding, lower if releasing
  playTone(held ? 880 : 440, 'sine', 0.08, 0.15);
  playTone(held ? 1100 : 330, 'sine', 0.06, 0.08, 0.04);
}

function soundScore(pts) {
  if (pts === 0) {
    playTone(200, 'sawtooth', 0.1, 0.1);
    playTone(150, 'sawtooth', 0.15, 0.1, 0.08);
    return;
  }
  if (pts === 50) {
    // Yahtzee! fanfare
    [523,659,784,1047].forEach((f,i) => playTone(f,'sine',0.18,0.2,i*0.1));
    return;
  }
  // Score chime - higher for bigger scores
  const base = 440 + pts * 4;
  playTone(base, 'sine', 0.12, 0.15);
  playTone(base * 1.25, 'sine', 0.1, 0.1, 0.08);
}

function soundYourTurn() {
  playTone(523, 'sine', 0.12, 0.2);
  playTone(659, 'sine', 0.12, 0.2, 0.14);
}

// ─── Score preview ────────────────────────────────────────────────────────────
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
    case 'smallStraight': { const u=[...new Set(dice)].sort().join(''); return(u.includes('1234')||u.includes('2345')||u.includes('3456'))?30:0; }
    case 'largeStraight': { const u=[...new Set(dice)].sort().join(''); return(u==='12345'||u==='23456')?40:0; }
    case 'yahtzee': return counts.some(c=>c===5)?50:0;
    case 'chance':  return sum;
    default: return 0;
  }
}

// ─── Dot positions ────────────────────────────────────────────────────────────
const DOTS = {
  1:[[50,50]],
  2:[[30,30],[70,70]],
  3:[[28,28],[50,50],[72,72]],
  4:[[28,28],[72,28],[28,72],[72,72]],
  5:[[28,28],[72,28],[50,50],[28,72],[72,72]],
  6:[[28,23],[72,23],[28,50],[72,50],[28,77],[72,77]],
};

// ─── Die ─────────────────────────────────────────────────────────────────────
function Die({ value, held, rolling, canHold, onClick }) {
  return (
    <div className={`yz-die-wrap ${held?'held':''} ${rolling?'rolling':''} ${value===0?'blank':''}`}>
      <button className={`yz-die-btn ${canHold?'interactive':''} ${held?'held':''}`}
        onClick={canHold?onClick:undefined} disabled={!canHold}
        title={canHold?(held?'Click to release':'Click to hold'):''}>
        <svg viewBox="0 0 100 100">
          <rect x="6" y="8" width="90" height="90" rx="16" fill="rgba(0,0,0,0.35)"/>
          <rect x="4" y="4" width="90" height="90" rx="16" className="die-face"/>
          <rect x="12" y="8" width="30" height="10" rx="5" className="die-shine"/>
          {value>0
            ?(DOTS[value]||[]).map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="9" className="die-dot"/>)
            :<text x="50" y="67" textAnchor="middle" fontSize="48" className="die-q">?</text>
          }
        </svg>
      </button>
      <div className="die-label">
        {canHold && (held
          ?<span className="die-held-tag">🔒 HELD</span>
          :<span className="die-free-tag">hold</span>)}
      </div>
    </div>
  );
}

// ─── Scorecard for ONE player ─────────────────────────────────────────────────
function Scorecard({ player, scoreData, isMe, isActive, dice, canScore, onScore, hoverCat, setHoverCat, scoreFlash }) {
  const sheet   = scoreData?.sheet    || {};
  const ubSub   = scoreData?.upperSubtotal ?? 0;
  const ubBonus = scoreData?.upperBonus    ?? 0;
  const total   = scoreData?.total         ?? 0;

  function Row({ cat }) {
    const scored    = sheet[cat] != null;
    const preview   = (!scored && isMe && canScore) ? previewScore(cat, dice) : null;
    const isHov     = hoverCat === cat;
    const isZero    = preview === 0;
    const clickable = !scored && isMe && canScore;
    const isFlash   = scoreFlash?.cat === cat;
    const pct       = scored ? Math.min(100, (sheet[cat] / (CAT_MAX[cat]||1)) * 100) : 0;

    return (
      <div className={['yz-row', scored?'scored':'', clickable?'clickable':'',
          isHov&&clickable?'hovered':'', isZero&&isHov?'zero-warn':'', isFlash?'flash':''].join(' ')}
        onClick={()=>clickable&&onScore(cat)}
        onMouseEnter={()=>setHoverCat(cat)}
        onMouseLeave={()=>setHoverCat(null)}
        title={clickable?(preview>0?`Score ${preview} pts`:'0 pts — bad roll'):''}
      >
        {scored && <div className="yz-row-fill" style={{width:`${pct}%`}}/>}
        <span className="yz-cat-name">{CAT_LABEL[cat]}</span>
        <span className="yz-cat-val">
          {scored
            ? <strong>{sheet[cat]}</strong>
            : preview!==null
              ? <span className={`yz-preview ${isZero?'zero':''}`}>{preview}</span>
              : <span className="yz-dash">—</span>}
        </span>
      </div>
    );
  }

  return (
    <div className={`yz-scorecard ${isActive?'active-player':''} ${isMe?'mine':''}`}>
      <div className="yz-sc-player-header">
        <span className="yz-sc-player-name">{player.name}{isMe?' (you)':''}</span>
        {isActive && <span className="yz-active-badge">🎲 Playing</span>}
        <span className="yz-sc-total-mini">{total}</span>
      </div>

      <div className="yz-section-head">
        <span>Upper</span>
        <span className="yz-ub-progress">
          {ubSub}/63{ubBonus>0?' ✅':ubSub>=55?' 🔥':''}
        </span>
      </div>
      <div className="yz-prog-bar">
        <div className="yz-prog-fill" style={{width:`${Math.min(100,(ubSub/63)*100)}%`}}/>
      </div>
      {UPPER_CATS.map(cat=><Row key={cat} cat={cat}/>)}
      <div className="yz-sub-row">
        <span>Upper Bonus</span>
        <span className={ubBonus>0?'earned':'pending'}>{ubBonus>0?'+35':'—'}</span>
      </div>

      <div className="yz-section-head top-gap">Lower</div>
      {CATEGORIES.filter(c=>!UPPER_CATS.includes(c)).map(cat=><Row key={cat} cat={cat}/>)}

      <div className="yz-grand-total">
        <span>TOTAL</span>
        <span className="yz-grand-val">{total}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function YahtzeeGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  const [rollingIdx,  setRollingIdx]  = useState([]);
  const [scoreFlash,  setScoreFlash]  = useState(null);
  const [hoverCat,    setHoverCat]    = useState(null);
  const [yourTurnAnim,setYourTurnAnim]= useState(false);
  const timerRef    = useRef(null);
  const prevTurnRef = useRef(null);
  const augmented = { ...gameState, minPlayers: gameState.minPlayers??1, maxPlayers: gameState.maxPlayers??4 };

  // detect turn change → play sound + flash
  useEffect(() => {
    if (gameState.state !== 'playing') return;
    const curId = gameState.players[gameState.currentPlayerIndex]?.id;
    if (curId !== prevTurnRef.current) {
      prevTurnRef.current = curId;
      if (curId === playerId) {
        soundYourTurn();
        setYourTurnAnim(true);
        setTimeout(() => setYourTurnAnim(false), 1800);
      }
    }
  }, [gameState.currentPlayerIndex, gameState.state]);

  if (gameState.state === 'waiting')
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error}/>;
  if (gameState.state === 'finished')
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby}/>;

  const { dice, held, rollsLeft, currentPlayerIndex, scores, players, settings, round } = gameState;
  const curPlayer  = players[currentPlayerIndex];
  const isMyTurn   = curPlayer?.id === playerId;
  const hasRolled  = dice.some(d => d > 0);
  const canRoll    = isMyTurn && rollsLeft > 0;
  const canHoldDie = isMyTurn && hasRolled && rollsLeft > 0;
  const canScore   = isMyTurn && hasRolled;

  function handleRoll() {
    if (!canRoll) return;
    soundDiceRoll();
    const animIdx = held.map((h,i)=>!h?i:-1).filter(i=>i>=0);
    setRollingIdx(animIdx);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(()=>setRollingIdx([]), 650);
    onGameAction('roll');
  }

  function handleHold(i) {
    if (!canHoldDie) return;
    soundHold(!held[i]);
    onGameAction('hold', { index: i });
  }

  function handleScore(cat) {
    if (!canScore) return;
    const pts = previewScore(cat, dice);
    soundScore(pts);
    setScoreFlash({ cat, pts });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(()=>setScoreFlash(null), 2000);
    onGameAction('score', { category: cat });
  }

  const rollBtnText = () => {
    if (!isMyTurn)    return `⏳ ${curPlayer?.name||'?'}'s turn…`;
    if (!hasRolled)   return '🎲 Roll Dice!';
    if (rollsLeft>0)  return `🎲 Roll Again (${rollsLeft} left)`;
    return '— Pick a category to score —';
  };

  return (
    <div className="yz-game">
      {yourTurnAnim && <div className="yz-your-turn-flash">🎲 YOUR TURN!</div>}

      {/* Status bar */}
      <div className="yz-bar">
        <span className="yz-round-pill">Round {round}/13</span>
        <span className={`yz-turn-txt ${isMyTurn?'mine':''}`}>
          {isMyTurn?'🎲 Your Turn':`⏳ ${curPlayer?.name}'s turn`}
        </span>
        <div className="yz-bar-right">
          {[0,1,2].map(i=><span key={i} className={`yz-pip ${i<rollsLeft?'on':''}`}/>)}
        </div>
      </div>

      {/* Dice */}
      <div className="yz-dice-section">
        <div className="yz-dice-row">
          {dice.map((val,i)=>(
            <Die key={i} value={val} held={held[i]}
              rolling={rollingIdx.includes(i)}
              canHold={canHoldDie} onClick={()=>handleHold(i)}/>
          ))}
        </div>
        <div className="yz-controls">
          <button className={`yz-roll-btn ${!canRoll?'disabled':''} ${!isMyTurn?'not-my-turn':''}`}
            onClick={handleRoll} disabled={!canRoll}>
            {rollBtnText()}
          </button>
          <div className="yz-hint-row">
            {isMyTurn&&canHoldDie&&<span className="yz-hint">🔒 Click dice to hold, then roll again — or score below</span>}
            {isMyTurn&&hasRolled&&rollsLeft===0&&<span className="yz-hint urgent">⚠️ No rolls left — pick a category!</span>}
            {!isMyTurn&&<span className="yz-hint muted">Waiting for {curPlayer?.name}…</span>}
          </div>
        </div>
      </div>

      {/* Side-by-side scorecards */}
      <div className="yz-scorecards-row">
        {players.map((p, i) => (
          <Scorecard key={p.id}
            player={p}
            scoreData={scores[p.id]}
            isMe={p.id === playerId}
            isActive={i === currentPlayerIndex}
            dice={dice}
            canScore={canScore && p.id === playerId}
            onScore={handleScore}
            hoverCat={hoverCat}
            setHoverCat={setHoverCat}
            scoreFlash={scoreFlash}
          />
        ))}
      </div>

      {scoreFlash && (
        <div className={`yz-toast ${scoreFlash.pts>0?'good':'bad'}`}>
          {scoreFlash.pts>0?`+${scoreFlash.pts}`:'0 pts'} · {CAT_LABEL[scoreFlash.cat]}
        </div>
      )}
    </div>
  );
}
