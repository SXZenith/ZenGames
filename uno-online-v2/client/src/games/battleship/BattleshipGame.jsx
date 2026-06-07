import React, { useState, useEffect, useRef } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './BattleshipGame.css';

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac=null;
const getAC=()=>{if(!_ac)_ac=new(window.AudioContext||window.webkitAudioContext)();return _ac;};
const beep=(f,d,t='sine',v=0.12)=>{try{const o=getAC().createOscillator(),g=getAC().createGain();o.connect(g);g.connect(getAC().destination);o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,getAC().currentTime);g.gain.exponentialRampToValueAtTime(0.001,getAC().currentTime+d);o.start();o.stop(getAC().currentTime+d+0.02);}catch(e){}};
const sndHit   =()=>{beep(500,0.05,'square',0.2);setTimeout(()=>beep(300,0.2,'sawtooth',0.15),60);};
const sndMiss  =()=>{beep(250,0.15,'sine',0.1);setTimeout(()=>beep(180,0.15,'sine',0.07),100);};
const sndSink  =()=>[400,350,280,200,150].forEach((f,i)=>setTimeout(()=>beep(f,0.2,'sawtooth',0.18),i*80));
const sndPlace =()=>beep(440,0.08,'square',0.1);
const sndRotate=()=>{beep(600,0.05,'square',0.08);setTimeout(()=>beep(800,0.05,'square',0.06),60);};

// ── Ship colors ───────────────────────────────────────────────────────────────
// 12 unique distinct colors, each ship always different
const PALETTE=[
  '#e63946','#f4a261','#ffd93d','#06d6a0','#4cc9f0',
  '#c840ff','#ffb3c6','#ff6b6b','#a8dadc','#118ab2',
  '#06d6a0','#b5838d',
];
// Assign colors by index so every ship always has a unique color
const SHIP_COLOR={};
const getColor=(name,shipDefs)=>{
  if(!shipDefs) return '#4cc9f0';
  const idx=shipDefs.findIndex(d=>d.name===name);
  return PALETTE[idx>=0?idx%PALETTE.length:0];
};

// ── Ship SVG sprite ───────────────────────────────────────────────────────────
function ShipSprite({name,size,horiz,cs,sunk,shipDefs}){
  const w=horiz?size*cs:cs, h=horiz?cs:size*cs;
  const col=getColor(name,shipDefs||[]);
  if(size===1) return (
    <svg width={cs} height={cs} viewBox={`0 0 ${cs} ${cs}`} className={`ship-svg${sunk?' sunk':''}`}>
      <circle cx={cs/2} cy={cs/2} r={cs/2-3} fill={col} stroke="rgba(0,0,0,0.4)" strokeWidth="2"/>
      <circle cx={cs/2} cy={cs/2} r={cs/4} fill="rgba(0,0,0,0.25)"/>
      {sunk&&<rect x={0} y={0} width={cs} height={cs} fill="rgba(0,0,0,0.5)" rx={cs/2}/>}
    </svg>
  );
  const r=4;
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`ship-svg${sunk?' sunk':''}`}>
      <defs>
        <linearGradient id={`g${name}${horiz?'h':'v'}`} x1="0%" y1="0%" x2={horiz?"100%":"0%"} y2={horiz?"0%":"100%"}>
          <stop offset="0%" stopColor={col} stopOpacity="0.8"/>
          <stop offset="50%" stopColor={col} stopOpacity="1"/>
          <stop offset="100%" stopColor={col} stopOpacity="0.65"/>
        </linearGradient>
      </defs>
      {horiz?(
        <>
          <path d={`M${cs*0.35},3 L${w-cs*0.35},3 Q${w-3},3 ${w-3},${h/2} Q${w-3},${h-3} ${w-cs*0.35},${h-3} L${cs*0.35},${h-3} Q3,${h-3} 3,${h/2} Q3,3 ${cs*0.35},3Z`}
            fill={`url(#g${name}h)`} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5"/>
          {Array.from({length:size-1}).map((_,i)=>(
            <line key={i} x1={(i+1)*cs} y1="5" x2={(i+1)*cs} y2={h-5} stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
          ))}
          <rect x={w*0.45} y={h*0.2} width={w*0.1} height={h*0.6} fill="rgba(0,0,0,0.22)" rx="2"/>
          {size>=4&&<circle cx={w*0.22} cy={h/2} r={cs*0.13} fill="rgba(0,0,0,0.28)"/>}
          {size>=4&&<circle cx={w*0.78} cy={h/2} r={cs*0.13} fill="rgba(0,0,0,0.28)"/>}
          <rect x="3" y="3" width={w-6} height="6" rx="3" fill="rgba(255,255,255,0.1)"/>
        </>
      ):(
        <>
          <path d={`M3,${cs*0.35} L3,${h-cs*0.35} Q3,${h-3} ${w/2},${h-3} Q${w-3},${h-3} ${w-3},${h-cs*0.35} L${w-3},${cs*0.35} Q${w-3},3 ${w/2},3 Q3,3 3,${cs*0.35}Z`}
            fill={`url(#g${name}v)`} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5"/>
          {Array.from({length:size-1}).map((_,i)=>(
            <line key={i} x1="5" y1={(i+1)*cs} x2={w-5} y2={(i+1)*cs} stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
          ))}
          <rect x={w*0.2} y={h*0.45} width={w*0.6} height={h*0.1} fill="rgba(0,0,0,0.22)" rx="2"/>
          {size>=4&&<circle cx={w/2} cy={h*0.22} r={cs*0.13} fill="rgba(0,0,0,0.28)"/>}
          {size>=4&&<circle cx={w/2} cy={h*0.78} r={cs*0.13} fill="rgba(0,0,0,0.28)"/>}
          <rect x="3" y="3" width="6" height={h-6} rx="3" fill="rgba(255,255,255,0.1)"/>
        </>
      )}
      {sunk&&<rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.55)" rx={r}/>}
    </svg>
  );
}

// ── Explosion ─────────────────────────────────────────────────────────────────
function Explosion({x,y,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,1000);return()=>clearTimeout(t);},[]);
  return(
    <div className="bs-explosion" style={{left:x,top:y}}>
      {Array.from({length:16}).map((_,i)=>(
        <div key={i} className="exp-p" style={{
          '--a':`${i*22.5}deg`,
          '--d':`${18+Math.random()*28}px`,
          '--c':['#ff4500','#ff8c00','#ffd700','#ff3131','#ffb347'][i%5],
          '--dur':`${0.5+Math.random()*0.4}s`,
        }}/>
      ))}
      <div className="exp-core"/>
      <div className="exp-ring"/>
    </div>
  );
}

// ── Auto-place (client) ───────────────────────────────────────────────────────
function clientAutoPlace(shipDefs,size){
  const grid=Array.from({length:size},()=>Array(size).fill(null));
  const ships=[];
  for(const def of shipDefs){
    let ok=false,attempts=0;
    while(!ok&&attempts++<1000){
      const horiz=def.size===1?true:Math.random()<0.5;
      const row=Math.floor(Math.random()*(horiz?size:size-def.size+1));
      const col=Math.floor(Math.random()*(horiz?size-def.size+1:size));
      const cells=[];let valid=true;
      for(let i=0;i<def.size;i++){
        const r=horiz?row:row+i,c=horiz?col+i:col;
        if(r<0||r>=size||c<0||c>=size||grid[r][c]!==null){valid=false;break;}
        cells.push([r,c]);
      }
      if(valid){cells.forEach(([r,c])=>{grid[r][c]=def.name;});ships.push({name:def.name,size:def.size,cells,horiz,sunk:false});ok=true;}
    }
  }
  return ships;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BattleshipGame({
  gameState,playerId,roomCode,roomLink,
  onStartGame,onRematch,onReturnToLobby,onChangeGame,onGameAction,error,
}){
  // ALL HOOKS FIRST
  const [placed,      setPlaced]      = useState([]);
  const [selShip,     setSelShip]     = useState(null);
  const [horiz,       setHoriz]       = useState(true);
  const [hover,       setHover]       = useState(null);
  const [explosions,  setExplosions]  = useState([]);
  const prevMyRef   = useRef([]);
  const prevOppRef  = useRef([]);

  const SIZE     = gameState.size || 10;
  const shipDefs = gameState.shipDefs || [{name:'Carrier',size:5},{name:'Battleship',size:4},{name:'Cruiser',size:3},{name:'Submarine',size:3},{name:'Destroyer',size:2}];

  // Cell size: bigger boards get smaller cells
  const CS = SIZE<=10 ? 50 : SIZE<=12 ? 42 : 34;

  const COLS = Array.from({length:SIZE},(_,i)=>`${i+1}`);
  const ROWS = 'ABCDEFGHIJKLMNO'.slice(0,SIZE).split('');

  // Detect shots for sounds/explosions
  useEffect(()=>{
    const d=gameState.publicBoards?.[playerId];
    if(!d) return;
    const newMy=d.myShots.filter(s=>!prevMyRef.current.find(p=>p.row===s.row&&p.col===s.col));
    newMy.forEach(s=>{
      if(s.hit){sndHit();addExp(s.row,s.col,'my');}else sndMiss();
    });
    const newOpp=d.oppShots.filter(s=>!prevOppRef.current.find(p=>p.row===s.row&&p.col===s.col));
    newOpp.forEach(s=>{
      if(s.hit){
        sndHit();addExp(s.row,s.col,'opp');
        const sk=d.oppSunkShips.find(sh=>sh.cells?.some(([r,c])=>r===s.row&&c===s.col));
        if(sk)sndSink();
      }else sndMiss();
    });
    prevMyRef.current=d.myShots;
    prevOppRef.current=d.oppShots;
  },[gameState.publicBoards]);

  const addExp=(r,c,board)=>setExplosions(e=>[...e,{id:Date.now()+Math.random(),row:r,col:c,board}]);
  const rmExp=(id)=>setExplosions(e=>e.filter(x=>x.id!==id));

  const getHoverCells=(r,c,idx,hz)=>{
    if(idx===null) return [];
    const size=shipDefs[idx].size;
    const cells=[];
    for(let i=0;i<size;i++) cells.push(hz?[r,c+i]:[r+i,c]);
    return cells;
  };

  const isValid=(cells)=>{
    for(const [r,c] of cells){
      if(r<0||r>=SIZE||c<0||c>=SIZE) return false;
      if(placed.some(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c))) return false;
    }
    return cells.length>0;
  };

  const placeShip=(r,c)=>{
    if(selShip===null) return;
    const def=shipDefs[selShip];
    if(placed.find(s=>s.name===def.name)) return;
    const cells=getHoverCells(r,c,selShip,horiz);
    if(!isValid(cells)) return;
    sndPlace();
    const next=[...placed,{name:def.name,size:def.size,cells,horiz,sunk:false}];
    setPlaced(next);
    const nextIdx=shipDefs.findIndex((d,i)=>i>selShip&&!next.find(s=>s.name===d.name));
    setSelShip(nextIdx===-1?null:nextIdx);
  };

  const removeShip=(name)=>setPlaced(p=>p.filter(s=>s.name!==name));
  const shuffle=()=>{setPlaced(clientAutoPlace(shipDefs,SIZE));setSelShip(null);};

  const handleReady=()=>{
    if(placed.length!==shipDefs.length) return;
    onGameAction('placeShips',{ships:placed});
    setTimeout(()=>onGameAction('ready',{}),150);
  };

  const shoot=(r,c)=>{
    const d=gameState.publicBoards?.[playerId];
    if(!d||d.oppShots.find(s=>s.row===r&&s.col===c)) return;
    onGameAction('shoot',{row:r,col:c});
  };

  const isMyTurn=gameState.players?.[gameState.currentPlayerIndex]?.id===playerId;
  const myData=gameState.publicBoards?.[playerId]||{myShips:[],myShots:[],oppShots:[],oppSunkShips:[]};

  // EARLY RETURNS
  if(gameState.state==='waiting')
    return <WaitingRoom gameState={gameState} playerId={playerId} roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error}/>;

  if(gameState.state==='finished')
    return <GameOver gameState={gameState} playerId={playerId} onRematch={onRematch} onReturnToLobby={onReturnToLobby}/>;

  // ── PLACEMENT ────────────────────────────────────────────────────────────────
  if(gameState.state==='placing'){
    const myPlayer=gameState.players?.find(p=>p.id===playerId);
    const isReady=myPlayer?.ready;
    const hCells=hover&&selShip!==null?getHoverCells(hover[0],hover[1],selShip,horiz):[];
    const hValid=isValid(hCells);

    return(
      <div className="bs-game">
        <div className="bs-place-header">
          <h2>⚓ Place Your Fleet</h2>
          <p>Select a ship · Click grid to place · Click placed ship to remove</p>
        </div>
        <div className="bs-place-layout">
          {/* Grid */}
          <div className="bs-grid-outer" style={{'--cs':`${CS}px`,'--sz':SIZE}}>
            {/* Column headers */}
            <div className="bs-headers-row">
              <div className="bs-corner"/>
              {COLS.map(c=><div key={c} className="bs-col-hdr">{c}</div>)}
            </div>
            <div className="bs-body-row">
              {/* Row headers */}
              <div className="bs-row-hdrs">
                {ROWS.map(r=><div key={r} className="bs-row-hdr">{r}</div>)}
              </div>
              {/* Cells */}
              <div className="bs-grid-cells" style={{position:'relative'}}>
                {Array.from({length:SIZE}).map((_,r)=>(
                  <div key={r} className="bs-row">
                    {Array.from({length:SIZE}).map((_,c)=>{
                      const ship=placed.find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c));
                      const isH=hCells.some(([hr,hc])=>hr===r&&hc===c);
                      return(
                        <div key={c}
                          className={`bs-cell${ship?' has-ship':''}${isH?(hValid?' hv':' hi'):''}`}
                          onClick={()=>ship?removeShip(ship.name):placeShip(r,c)}
                          onMouseEnter={()=>setHover([r,c])}
                          onMouseLeave={()=>setHover(null)}/>
                      );
                    })}
                  </div>
                ))}
                {/* Ship sprites */}
                {placed.map(ship=>{
                  const [r0,c0]=ship.cells[0];
                  return(
                    <div key={ship.name} className="bs-sprite-overlay" style={{
                      top:r0*CS, left:c0*CS,
                      width:ship.horiz?ship.size*CS:CS,
                      height:ship.horiz?CS:ship.size*CS,
                    }}>
                      <ShipSprite name={ship.name} size={ship.size} horiz={ship.horiz} cs={CS}/>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panel */}
          <div className="bs-panel" style={{maxHeight: Math.min(shipDefs.length*52+140, 600)+'px'}}>
            <div className="bs-panel-title">Your Fleet</div>
            {shipDefs.map((def,idx)=>{
              const p=placed.find(s=>s.name===def.name);
              return(
                <div key={def.name}
                  className={`bs-sel${selShip===idx?' selected':''}${p?' placed':''}`}
                  onClick={()=>{if(!p)setSelShip(idx);}}>
                  <div className="bs-sel-sprite">
                    <ShipSprite name={def.name} size={Math.min(def.size,4)} horiz={true} cs={18} shipDefs={shipDefs}/>
                  </div>
                  <div className="bs-sel-info">
                    <span className="bs-sel-name">{def.name}</span>
                    <span className="bs-sel-sz">{def.size==='1'?'1×1':`${def.size} cells`}</span>
                  </div>
                  {p?<span className="bs-check">✓</span>:selShip===idx&&<span className="bs-sel-tag">Active</span>}
                </div>
              );
            })}
            <div className="bs-panel-btns">
              <button className="bs-btn-rotate" onClick={()=>{sndRotate();setHoriz(h=>!h);}}>
                ↻ {horiz?'Horizontal':'Vertical'}
              </button>
              <button className="bs-btn-shuffle" onClick={shuffle}>🔀 Random</button>
            </div>
            <button
              className={`bs-ready-btn${placed.length===shipDefs.length?' can-ready':''}${isReady?' confirmed':''}`}
              disabled={placed.length!==shipDefs.length||isReady}
              onClick={handleReady}>
              {isReady?'✓ Waiting for opponent…':placed.length===shipDefs.length?'✅ Ready!':
                `Place ${shipDefs.length-placed.length} more…`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING ──────────────────────────────────────────────────────────────────
  const curPlayer=gameState.players?.[gameState.currentPlayerIndex];

  const renderGrid=(isMine)=>{
    const shots  =isMine?myData.myShots:myData.oppShots;
    const ships  =isMine?myData.myShips:myData.oppSunkShips;
    const exps   =explosions.filter(e=>e.board===(isMine?'my':'opp'));

    return(
      <div className="bs-board-wrap">
        <div className={`bs-board-title${isMine?' mine-title':' opp-title'}`}>
          {isMine?'Your Board':"Opponent's Board"}
        </div>
        <div className="bs-grid-outer" style={{'--cs':`${CS}px`,'--sz':SIZE}}>
          <div className="bs-headers-row">
            <div className="bs-corner"/>
            {COLS.map(c=><div key={c} className="bs-col-hdr">{c}</div>)}
          </div>
          <div className="bs-body-row">
            <div className="bs-row-hdrs">
              {ROWS.map(r=><div key={r} className="bs-row-hdr">{r}</div>)}
            </div>
            <div className="bs-grid-cells" style={{position:'relative'}}>
              {Array.from({length:SIZE}).map((_,r)=>(
                <div key={r} className="bs-row">
                  {Array.from({length:SIZE}).map((_,c)=>{
                    const shot=shots.find(s=>s.row===r&&s.col===c);
                    const canFire=!isMine&&isMyTurn&&!shot;
                    return(
                      <div key={c}
                        className={`bs-cell${shot?.hit?' hit':''}${shot&&!shot.hit?' miss':''}${canFire?' fire':''}`}
                        onClick={()=>canFire&&shoot(r,c)}
                        onMouseEnter={()=>canFire&&setHover([r,c])}
                        onMouseLeave={()=>setHover(null)}>
                        {shot?.hit&&<div className="bs-hit">✦</div>}
                        {shot&&!shot.hit&&<div className="bs-miss">○</div>}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Ship sprites */}
              {ships.map(ship=>{
                if(!ship.cells?.length) return null;
                const [r0,c0]=ship.cells[0];
                return(
                  <div key={ship.name} className={`bs-sprite-overlay${ship.sunk?' sunk':''}`} style={{
                    top:r0*CS, left:c0*CS,
                    width:ship.horiz?ship.size*CS:CS,
                    height:ship.horiz?CS:ship.size*CS,
                  }}>
                    <ShipSprite name={ship.name} size={ship.size} horiz={ship.horiz} cs={CS} sunk={ship.sunk}/>
                  </div>
                );
              })}

              {/* Explosions */}
              {exps.map(e=>(
                <Explosion key={e.id}
                  x={e.col*CS+CS/2} y={e.row*CS+CS/2}
                  onDone={()=>rmExp(e.id)}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return(
    <div className="bs-game">
      <div className={`bs-turn-bar${isMyTurn?' my':''}`}>
        {isMyTurn?'🎯 Your Turn':'⏳ '+curPlayer?.name+"'s turn"}
      </div>

      <div className="bs-play-row">
        {renderGrid(true)}
        <div className="bs-divider"/>
        {renderGrid(false)}
      </div>

      <div className="bs-status">
        <div className="bs-fleet">
          <span className="bs-st-lbl">Your Fleet</span>
          {myData.myShips.map(s=>(
            <div key={s.name} className={`bs-pip${s.sunk?' sunk':''}`}
              style={{'--sc':getColor(s.name,shipDefs)}} title={s.name}/>
          ))}
        </div>
        <div className="bs-fleet">
          <span className="bs-st-lbl">Sunk</span>
          <span className="bs-sunk">{myData.oppSunkShips.filter(s=>s.sunk).length} / {shipDefs.length}</span>
        </div>
      </div>
    </div>
  );
}
