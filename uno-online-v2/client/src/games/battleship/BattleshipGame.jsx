import React, { useState, useEffect, useRef } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './BattleshipGame.css';

let _ctx = null;
function ac() { if (!_ctx) _ctx = new (window.AudioContext||window.webkitAudioContext)(); return _ctx; }
function beep(freq,dur,type='sine',vol=0.15){
  try{const o=ac().createOscillator(),g=ac().createGain();o.connect(g);g.connect(ac().destination);
  o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,ac().currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ac().currentTime+dur);o.start();o.stop(ac().currentTime+dur+0.02);}catch(e){}
}
const soundHit  = () => { beep(400,0.05,'square',0.2); setTimeout(()=>beep(600,0.15,'sine',0.15),50); };
const soundMiss = () => { beep(300,0.1,'sine',0.1); setTimeout(()=>beep(200,0.1,'sine',0.08),80); };
const soundSink = () => [200,180,160,140].forEach((f,i)=>setTimeout(()=>beep(f,0.15,'sawtooth',0.15),i*60));

const SHIP_COLORS = {
  Carrier: '#e63946', Battleship: '#f4a261', Cruiser: '#4cc9f0',
  Submarine: '#06d6a0', Destroyer: '#7209b7',
};

function Grid({ size, shots, myGrid, myShips, isMyBoard, onShoot, isMyTurn, oppSunkShips }) {
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const shot = shots.find(s => s.row === r && s.col === c);
      const shipName = myGrid?.[r]?.[c];
      const sunk = myShips?.find(s => s.name === shipName && s.sunk);
      const oppSunk = oppSunkShips?.find(s => s.cells?.some(([sr,sc])=>sr===r&&sc===c));

      let cls = 'bs-cell';
      if (isMyBoard) {
        if (shipName) cls += sunk ? ' ship sunk' : ' ship';
        if (shot?.hit) cls += ' hit';
        if (shot && !shot.hit) cls += ' miss';
      } else {
        if (shot?.hit) cls += ' hit';
        else if (shot && !shot.hit) cls += ' miss';
        else if (isMyTurn) cls += ' targetable';
        if (oppSunk) cls += ' sunk-reveal';
      }

      cells.push(
        <div key={`${r}-${c}`} className={cls}
          style={isMyBoard && shipName && !sunk ? { background: `${SHIP_COLORS[shipName]}33`, borderColor: `${SHIP_COLORS[shipName]}66` } : {}}
          onClick={() => !isMyBoard && isMyTurn && !shot && onShoot(r, c)}
        >
          {shot?.hit && <span className="bs-hit-marker">💥</span>}
          {shot && !shot.hit && <span className="bs-miss-marker">•</span>}
        </div>
      );
    }
  }
  return (
    <div className="bs-grid-wrap">
      <div className="bs-col-labels">
        {Array.from({ length: size }, (_, i) => <span key={i}>{String.fromCharCode(65+i)}</span>)}
      </div>
      <div className="bs-grid-row">
        <div className="bs-row-labels">
          {Array.from({ length: size }, (_, i) => <span key={i}>{i+1}</span>)}
        </div>
        <div className="bs-grid" style={{ gridTemplateColumns: `repeat(${size},1fr)` }}>
          {cells}
        </div>
      </div>
    </div>
  );
}

export default function BattleshipGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  // ── ALL HOOKS MUST BE BEFORE ANY EARLY RETURNS ──
  const [lastShot, setLastShot] = useState(null);
  const prevShotsRef = useRef([]);

  const { size, publicBoards, currentPlayerIndex, players, settings } = gameState;
  const myData   = publicBoards?.[playerId] || {};
  const myShots  = myData.myShots || [];

  useEffect(() => {
    if (myShots.length > prevShotsRef.current.length) {
      const newest = myShots[myShots.length - 1];
      if (newest) {
        newest.hit ? soundHit() : soundMiss();
        setLastShot(newest);
        setTimeout(() => setLastShot(null), 1500);
      }
    }
    prevShotsRef.current = myShots;
  }, [myShots.length]);

  // ── Early returns AFTER hooks ──
  const augmented = { ...gameState, minPlayers: 2, maxPlayers: 2 };
  if (gameState.state === 'waiting')
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error}/>;
  if (gameState.state === 'finished')
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby}/>;

  const curPlayer = players[currentPlayerIndex];
  const isMyTurn  = curPlayer?.id === playerId;
  const opp       = players.find(p => p.id !== playerId);
  const myShips   = myData.myShips  || [];
  const oppSunk   = myData.oppShips || [];

  function handleShoot(row, col) {
    if (!isMyTurn) return;
    onGameAction('shoot', { row, col });
  }

  return (
    <div className="bs-game">
      <div className="bs-bar">
        <span className="bs-title-pill">⚓ Battleship</span>
        <span className={`bs-turn ${isMyTurn?'mine':''}`}>
          {isMyTurn ? '🎯 Your Turn — Fire!' : `⏳ ${curPlayer?.name} is firing…`}
        </span>
        {lastShot && (
          <span className={`bs-shot-feedback ${lastShot.hit?'hit':'miss'}`}>
            {lastShot.hit ? '💥 HIT!' : '💦 Miss'}
          </span>
        )}
      </div>

      <div className="bs-body">
        <div className="bs-board-section">
          <div className="bs-board-label">Your Fleet</div>
          <Grid size={size} shots={myData.oppShots||[]} myGrid={myData.myGrid}
            myShips={myShips} isMyBoard={true} isMyTurn={false}/>
          <div className="bs-ship-status">
            {myShips.map(s => (
              <div key={s.name} className={`bs-ship-chip ${s.sunk?'sunk':''}`}
                style={{ borderColor: SHIP_COLORS[s.name]+'66' }}>
                <span style={{color:SHIP_COLORS[s.name]}}>{s.name[0]}</span>
                {s.name} ({s.size})
                {s.sunk && ' ✕'}
              </div>
            ))}
          </div>
        </div>

        <div className="bs-divider">VS</div>

        <div className="bs-board-section">
          <div className="bs-board-label">{opp?.name}'s Waters</div>
          <Grid size={size} shots={myData.myShots||[]} myGrid={null}
            myShips={null} isMyBoard={false}
            onShoot={handleShoot} isMyTurn={isMyTurn}
            oppSunkShips={oppSunk}/>
          <div className="bs-ship-status">
            {oppSunk.map(s => (
              <div key={s.name} className="bs-ship-chip sunk"
                style={{ borderColor: SHIP_COLORS[s.name]+'66' }}>
                <span style={{color:SHIP_COLORS[s.name]}}>{s.name[0]}</span>
                {s.name} SUNK! 💀
              </div>
            ))}
            {oppSunk.length === 0 && <span className="bs-no-sunk">No ships sunk yet</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
