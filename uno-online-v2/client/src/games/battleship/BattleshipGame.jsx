import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './BattleshipGame.css';

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac = null;
const getAC = () => { if (!_ac) _ac = new (window.AudioContext||window.webkitAudioContext)(); return _ac; };
const beep = (f,d,t='sine',v=0.12) => {
  try {
    const o=getAC().createOscillator(), g=getAC().createGain();
    o.connect(g); g.connect(getAC().destination);
    o.type=t; o.frequency.value=f;
    g.gain.setValueAtTime(v, getAC().currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, getAC().currentTime+d);
    o.start(); o.stop(getAC().currentTime+d+0.02);
  } catch(e){}
};
const sndHit    = () => { beep(500,0.05,'square',0.2); setTimeout(()=>beep(300,0.2,'sawtooth',0.15),60); };
const sndMiss   = () => { beep(250,0.15,'sine',0.1); setTimeout(()=>beep(180,0.15,'sine',0.07),100); };
const sndSink   = () => [400,350,280,200,150].forEach((f,i)=>setTimeout(()=>beep(f,0.2,'sawtooth',0.18),i*80));
const sndPlace  = () => beep(440,0.08,'square',0.1);
const sndRotate = () => { beep(600,0.05,'square',0.08); setTimeout(()=>beep(800,0.05,'square',0.06),60); };

// ── Constants ─────────────────────────────────────────────────────────────────
const SIZE = 10;
const COLS = ['1','2','3','4','5','6','7','8','9','10'];
const ROWS = ['A','B','C','D','E','F','G','H','I','J'];

const SHIP_DEFS = [
  { name:'Carrier',    size:5, color:'#e63946' },
  { name:'Battleship', size:4, color:'#f4a261' },
  { name:'Cruiser',    size:3, color:'#4cc9f0' },
  { name:'Submarine',  size:3, color:'#06d6a0' },
  { name:'Destroyer',  size:2, color:'#c840ff' },
];

// ── Ship sprite using CSS/SVG ─────────────────────────────────────────────────
function ShipSprite({ name, size, horiz, cellSize, sunk }) {
  const w = horiz ? size * cellSize : cellSize;
  const h = horiz ? cellSize : size * cellSize;
  const color = SHIP_DEFS.find(s=>s.name===name)?.color || '#888';
  const dim = Math.min(w, h);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`ship-svg ${sunk?'sunk':''}`}>
      <defs>
        <linearGradient id={`sg-${name}`} x1="0%" y1="0%" x2={horiz?"100%":"0%"} y2={horiz?"0%":"100%"}>
          <stop offset="0%"   stopColor={color} stopOpacity="0.9"/>
          <stop offset="50%"  stopColor={color} stopOpacity="1"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      {/* Hull */}
      {horiz ? (
        <>
          <path d={`M${dim*0.3},4 L${w-dim*0.3},4 Q${w-2},4 ${w-2},${h/2} Q${w-2},${h-4} ${w-dim*0.3},${h-4} L${dim*0.3},${h-4} Q2,${h-4} 2,${h/2} Q2,4 ${dim*0.3},4 Z`}
            fill={`url(#sg-${name})`} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
          {/* Deck details */}
          {Array.from({length:size-1}).map((_,i)=>(
            <line key={i} x1={(i+1)*cellSize} y1="6" x2={(i+1)*cellSize} y2={h-6}
              stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
          ))}
          {/* Bridge */}
          <rect x={w*0.5-dim*0.15} y={h*0.2} width={dim*0.3} height={h*0.6}
            fill="rgba(0,0,0,0.25)" rx="2"/>
          {/* Turrets */}
          {size>=4 && <circle cx={w*0.25} cy={h/2} r={dim*0.1} fill="rgba(0,0,0,0.3)"/>}
          {size>=4 && <circle cx={w*0.75} cy={h/2} r={dim*0.1} fill="rgba(0,0,0,0.3)"/>}
        </>
      ) : (
        <>
          <path d={`M4,${dim*0.3} L4,${h-dim*0.3} Q4,${h-2} ${w/2},${h-2} Q${w-4},${h-2} ${w-4},${h-dim*0.3} L${w-4},${dim*0.3} Q${w-4},2 ${w/2},2 Q4,2 4,${dim*0.3} Z`}
            fill={`url(#sg-${name})`} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
          {Array.from({length:size-1}).map((_,i)=>(
            <line key={i} x1="6" y1={(i+1)*cellSize} x2={w-6} y2={(i+1)*cellSize}
              stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
          ))}
          <rect x={w*0.2} y={h*0.5-dim*0.15} width={w*0.6} height={dim*0.3}
            fill="rgba(0,0,0,0.25)" rx="2"/>
          {size>=4 && <circle cx={w/2} cy={h*0.25} r={dim*0.1} fill="rgba(0,0,0,0.3)"/>}
          {size>=4 && <circle cx={w/2} cy={h*0.75} r={dim*0.1} fill="rgba(0,0,0,0.3)"/>}
        </>
      )}
      {/* Sunk overlay */}
      {sunk && <rect x="0" y="0" width={w} height={h} fill="rgba(0,0,0,0.5)" rx="4"/>}
    </svg>
  );
}

// ── Explosion animation ────────────────────────────────────────────────────────
function Explosion({ x, y, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="explosion" style={{ left: x, top: y }}>
      {Array.from({length:12}).map((_,i) => (
        <div key={i} className="exp-particle" style={{
          '--angle': `${i*30}deg`,
          '--dist': `${20+Math.random()*30}px`,
          '--color': ['#ff4500','#ff8c00','#ffd700','#ff3131'][i%4],
        }}/>
      ))}
      <div className="exp-core"/>
    </div>
  );
}

// ── Auto-place helper (client side) ──────────────────────────────────────────
function clientAutoPlace() {
  const grid = Array.from({length:SIZE}, ()=>Array(SIZE).fill(null));
  const ships = [];
  for (const def of SHIP_DEFS) {
    let ok=false, attempts=0;
    while (!ok && attempts++<500) {
      const horiz = Math.random()<0.5;
      const row = Math.floor(Math.random()*(horiz?SIZE:SIZE-def.size+1));
      const col = Math.floor(Math.random()*(horiz?SIZE-def.size+1:SIZE));
      const cells=[];
      let valid=true;
      for (let i=0;i<def.size;i++) {
        const r=horiz?row:row+i, c=horiz?col+i:col;
        if (r<0||r>=SIZE||c<0||c>=SIZE||grid[r][c]!==null){valid=false;break;}
        cells.push([r,c]);
      }
      if (valid) {
        cells.forEach(([r,c])=>{grid[r][c]=def.name;});
        ships.push({name:def.name,size:def.size,cells,horiz,sunk:false});
        ok=true;
      }
    }
  }
  return ships;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BattleshipGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  // ── ALL HOOKS FIRST ──────────────────────────────────────────────────────────
  const [placedShips,   setPlacedShips]   = useState([]);
  const [selectedShip,  setSelectedShip]  = useState(null); // def index
  const [shipHoriz,     setShipHoriz]     = useState(true);
  const [hoverCell,     setHoverCell]     = useState(null);
  const [explosions,    setExplosions]    = useState([]); // [{id,row,col}]
  const [lastShot,      setLastShot]      = useState(null);
  const prevShotsRef    = useRef([]);
  const cellSize = 44;

  // Detect new shots for explosion/sound
  useEffect(() => {
    const myData = gameState.publicBoards?.[playerId];
    if (!myData) return;

    // Shots on MY board (opponent fired at me)
    const myShots = myData.myShots || [];
    const prevMy  = prevShotsRef.current;
    const newShots = myShots.filter(s => !prevMy.find(p=>p.row===s.row&&p.col===s.col));
    newShots.forEach(s => {
      if (s.hit) { sndHit(); addExplosion(s.row, s.col, 'my'); }
      else sndMiss();
    });

    // Shots on OPP board (I fired)
    const oppShots = myData.oppShots || [];
    const prevOpp  = prevShotsRef.current.opp || [];
    const newOpp   = oppShots.filter(s => !prevOpp.find(p=>p.row===s.row&&p.col===s.col));
    newOpp.forEach(s => {
      if (s.hit) {
        sndHit();
        addExplosion(s.row, s.col, 'opp');
        const sunkShip = gameState.publicBoards[playerId]?.oppSunkShips?.find(sh =>
          sh.cells?.some(([r,c])=>r===s.row&&c===s.col)
        );
        if (sunkShip) sndSink();
      } else sndMiss();
    });

    prevShotsRef.current = myShots;
    prevShotsRef.current.opp = oppShots;
  }, [gameState.publicBoards]);

  const addExplosion = (row, col, board) => {
    const id = Date.now() + Math.random();
    setExplosions(e => [...e, { id, row, col, board }]);
  };

  const removeExplosion = (id) => setExplosions(e => e.filter(x=>x.id!==id));

  // Ship placement helpers
  const getPlacementCells = (row, col, shipIdx, horiz) => {
    if (shipIdx === null) return [];
    const size = SHIP_DEFS[shipIdx].size;
    const cells = [];
    for (let i=0;i<size;i++) {
      cells.push(horiz ? [row, col+i] : [row+i, col]);
    }
    return cells;
  };

  const isPlacementValid = (cells) => {
    if (!cells.length) return false;
    for (const [r,c] of cells) {
      if (r<0||r>=SIZE||c<0||c>=SIZE) return false;
      if (placedShips.some(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c))) return false;
    }
    return true;
  };

  const handlePlaceClick = (row, col) => {
    if (selectedShip === null) return;
    const def = SHIP_DEFS[selectedShip];
    if (placedShips.find(s=>s.name===def.name)) return; // already placed
    const cells = getPlacementCells(row, col, selectedShip, shipHoriz);
    if (!isPlacementValid(cells)) return;
    sndPlace();
    setPlacedShips(prev => [...prev, { name:def.name, size:def.size, cells, horiz:shipHoriz, sunk:false }]);
    // Auto-select next unplaced ship
    const nextIdx = SHIP_DEFS.findIndex((d,i) =>
      i > selectedShip && !placedShips.some(s=>s.name===d.name) && d.name!==def.name
    );
    setSelectedShip(nextIdx === -1 ? null : nextIdx);
  };

  const handleRemoveShip = (name) => {
    setPlacedShips(prev => prev.filter(s=>s.name!==name));
  };

  const handleShuffle = () => {
    setPlacedShips(clientAutoPlace());
    setSelectedShip(null);
  };

  const handleReady = () => {
    if (placedShips.length !== SHIP_DEFS.length) return;
    onGameAction('placeShips', { ships: placedShips });
    setTimeout(() => onGameAction('ready', {}), 100);
  };

  const handleShoot = (row, col) => {
    const myData = gameState.publicBoards?.[playerId];
    if (!myData) return;
    if (myData.oppShots.find(s=>s.row===row&&s.col===col)) return;
    onGameAction('shoot', { row, col });
  };

  const isMyTurn = gameState.players?.[gameState.currentPlayerIndex]?.id === playerId;
  const myData   = gameState.publicBoards?.[playerId] || { myShips:[], myShots:[], oppShots:[], oppSunkShips:[] };

  // ── Early returns AFTER hooks ────────────────────────────────────────────────
  if (gameState.state === 'waiting') {
    return <WaitingRoom gameState={gameState} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error} />;
  }

  if (gameState.state === 'finished') {
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;
  }

  // ── Placement phase ──────────────────────────────────────────────────────────
  if (gameState.state === 'placing') {
    const myPlayer = gameState.players?.find(p=>p.id===playerId);
    const isReady  = myPlayer?.ready;
    const hoverCells = hoverCell && selectedShip !== null
      ? getPlacementCells(hoverCell[0], hoverCell[1], selectedShip, shipHoriz)
      : [];
    const hoverValid = isPlacementValid(hoverCells);

    return (
      <div className="bs-game">
        <div className="bs-place-header">
          <h2>Place Your Fleet</h2>
          <p className="bs-place-sub">Click a ship, then click the grid to place it. Click placed ships to remove them.</p>
        </div>

        <div className="bs-place-layout">
          {/* Grid */}
          <div className="bs-grid-wrap">
            <div className="bs-grid" style={{ '--cs': `${cellSize}px`, '--size': SIZE }}>
              {/* Corner */}
              <div className="bs-corner"/>
              {/* Col headers */}
              {COLS.map(c => <div key={c} className="bs-col-header">{c}</div>)}
              {/* Rows */}
              {Array.from({length:SIZE}).map((_,r) => (
                <React.Fragment key={r}>
                  <div className="bs-row-header">{ROWS[r]}</div>
                  {Array.from({length:SIZE}).map((_,c) => {
                    const ship = placedShips.find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c));
                    const isHover = hoverCells.some(([hr,hc])=>hr===r&&hc===c);
                    return (
                      <div key={c}
                        className={`bs-cell placement-cell ${ship?'has-ship':''} ${isHover?(hoverValid?'hover-valid':'hover-invalid'):''}`}
                        onClick={() => ship ? handleRemoveShip(ship.name) : handlePlaceClick(r,c)}
                        onMouseEnter={() => setHoverCell([r,c])}
                        onMouseLeave={() => setHoverCell(null)}
                      >
                        {ship && (
                          <div className="bs-ship-cell-fill" style={{background: SHIP_DEFS.find(d=>d.name===ship.name)?.color||'#888'}}/>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            {/* Ship overlays */}
            {placedShips.map(ship => {
              const [r0,c0] = ship.cells[0];
              return (
                <div key={ship.name} className="bs-ship-overlay"
                  style={{
                    position:'absolute',
                    top: (r0+1)*cellSize + 2,
                    left: (c0+1)*cellSize + 2,
                    width: ship.horiz ? ship.size*cellSize-4 : cellSize-4,
                    height: ship.horiz ? cellSize-4 : ship.size*cellSize-4,
                    pointerEvents:'none',
                  }}>
                  <ShipSprite name={ship.name} size={ship.size} horiz={ship.horiz} cellSize={cellSize-4}/>
                </div>
              );
            })}
          </div>

          {/* Ship selector panel */}
          <div className="bs-ship-panel">
            <div className="bs-panel-title">Your Fleet</div>
            {SHIP_DEFS.map((def, idx) => {
              const placed = placedShips.find(s=>s.name===def.name);
              return (
                <div key={def.name}
                  className={`bs-ship-selector ${selectedShip===idx?'selected':''} ${placed?'placed':''}`}
                  onClick={() => { if (!placed) { setSelectedShip(idx); } }}>
                  <div className="bs-sel-ship">
                    <ShipSprite name={def.name} size={def.size} horiz={true} cellSize={28}/>
                  </div>
                  <div className="bs-sel-info">
                    <span className="bs-sel-name">{def.name}</span>
                    <span className="bs-sel-size">{def.size} cells</span>
                  </div>
                  {placed
                    ? <span className="bs-placed-badge">✓</span>
                    : selectedShip===idx && <span className="bs-sel-badge">Selected</span>}
                </div>
              );
            })}

            <div className="bs-panel-actions">
              <button className="bs-rotate-btn" onClick={() => { sndRotate(); setShipHoriz(h=>!h); }}>
                ↻ {shipHoriz ? 'Horizontal' : 'Vertical'}
              </button>
              <button className="bs-shuffle-btn" onClick={handleShuffle}>🔀 Random</button>
            </div>

            <button
              className={`bs-ready-btn ${placedShips.length===SHIP_DEFS.length?'ready':''} ${isReady?'confirmed':''}`}
              disabled={placedShips.length!==SHIP_DEFS.length||isReady}
              onClick={handleReady}>
              {isReady ? '✓ Ready! Waiting...' : placedShips.length===SHIP_DEFS.length ? 'Ready!' : `Place ${SHIP_DEFS.length-placedShips.length} more ship${SHIP_DEFS.length-placedShips.length!==1?'s':''}…`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing phase ────────────────────────────────────────────────────────────
  const curPlayer = gameState.players?.[gameState.currentPlayerIndex];

  const renderGrid = (isMyBoard) => {
    const shots    = isMyBoard ? myData.myShots   : myData.oppShots;
    const ships    = isMyBoard ? myData.myShips   : myData.oppSunkShips;
    const myBoardExplosions = explosions.filter(e=>e.board===(isMyBoard?'my':'opp'));

    return (
      <div className="bs-grid-container">
        <div className="bs-grid-title">{isMyBoard ? 'Your Board' : "Opponent's Board"}</div>
        <div className="bs-grid-wrap" style={{position:'relative'}}>
          <div className="bs-grid" style={{'--cs':`${cellSize}px`,'--size':SIZE}}>
            <div className="bs-corner"/>
            {COLS.map(c=><div key={c} className="bs-col-header">{c}</div>)}
            {Array.from({length:SIZE}).map((_,r)=>(
              <React.Fragment key={r}>
                <div className="bs-row-header">{ROWS[r]}</div>
                {Array.from({length:SIZE}).map((_,c)=>{
                  const shot = shots.find(s=>s.row===r&&s.col===c);
                  const ship = ships.find(s=>s.cells?.some(([sr,sc])=>sr===r&&sc===c));
                  const canShoot = !isMyBoard && isMyTurn && !shot;
                  return (
                    <div key={c}
                      className={`bs-cell ${shot?.hit?'hit':''} ${shot&&!shot.hit?'miss':''} ${canShoot?'targetable':''} ${ship?'sunk-reveal':''}`}
                      onClick={()=>canShoot&&handleShoot(r,c)}
                      onMouseEnter={()=>canShoot&&setHoverCell([r,c])}
                      onMouseLeave={()=>setHoverCell(null)}>
                      {shot?.hit && <div className="bs-hit-marker">✦</div>}
                      {shot&&!shot.hit && <div className="bs-miss-marker">○</div>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Ship overlays on my board */}
          {isMyBoard && myData.myShips.map(ship => {
            if (!ship.cells?.length) return null;
            const [r0,c0] = ship.cells[0];
            return (
              <div key={ship.name} className={`bs-ship-overlay ${ship.sunk?'sunk':''}`}
                style={{
                  position:'absolute',
                  top:(r0+1)*cellSize+2, left:(c0+1)*cellSize+2,
                  width:ship.horiz?ship.size*cellSize-4:cellSize-4,
                  height:ship.horiz?cellSize-4:ship.size*cellSize-4,
                  pointerEvents:'none',
                }}>
                <ShipSprite name={ship.name} size={ship.size} horiz={ship.horiz} cellSize={cellSize-4} sunk={ship.sunk}/>
              </div>
            );
          })}

          {/* Sunk opp ships revealed */}
          {!isMyBoard && myData.oppSunkShips.map(ship => {
            if (!ship.cells?.length) return null;
            const [r0,c0] = ship.cells[0];
            return (
              <div key={ship.name} className="bs-ship-overlay sunk"
                style={{
                  position:'absolute',
                  top:(r0+1)*cellSize+2, left:(c0+1)*cellSize+2,
                  width:ship.horiz?ship.size*cellSize-4:cellSize-4,
                  height:ship.horiz?cellSize-4:ship.size*cellSize-4,
                  pointerEvents:'none',
                }}>
                <ShipSprite name={ship.name} size={ship.size} horiz={ship.horiz} cellSize={cellSize-4} sunk={true}/>
              </div>
            );
          })}

          {/* Explosions */}
          {myBoardExplosions.map(exp => (
            <Explosion key={exp.id}
              x={exp.col*cellSize + cellSize/2 + cellSize}
              y={exp.row*cellSize + cellSize/2 + cellSize}
              onDone={()=>removeExplosion(exp.id)}/>
          ))}
        </div>
      </div>
    );
  };

  // Ship status
  const myShipStatus = myData.myShips.map(s => ({
    name: s.name,
    sunk: s.sunk,
    color: SHIP_DEFS.find(d=>d.name===s.name)?.color||'#888',
  }));
  const oppSunkCount = myData.oppSunkShips.filter(s=>s.sunk).length;

  return (
    <div className="bs-game">
      <div className={`bs-turn-banner ${isMyTurn?'my-turn':'opp-turn'}`}>
        {isMyTurn ? '🎯 Your Turn — Click a cell on the right board' : `⏳ ${curPlayer?.name}'s turn`}
      </div>

      <div className="bs-play-layout">
        {renderGrid(true)}
        {renderGrid(false)}
      </div>

      <div className="bs-status-row">
        <div className="bs-fleet-status">
          <span className="bs-status-label">Your Fleet:</span>
          {myShipStatus.map(s=>(
            <span key={s.name} className={`bs-ship-pip ${s.sunk?'sunk':''}`}
              style={{'--sc':s.color}} title={s.name}/>
          ))}
        </div>
        <div className="bs-fleet-status">
          <span className="bs-status-label">Sunk:</span>
          <span className="bs-sunk-count">{oppSunkCount} / {SHIP_DEFS.length}</span>
        </div>
      </div>
    </div>
  );
}
