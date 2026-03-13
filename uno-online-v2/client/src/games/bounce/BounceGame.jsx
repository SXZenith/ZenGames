import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './BounceGame.css';

const COLORS     = ['#e63946', '#4cc9f0', '#06d6a0', '#ffd60a'];
const COLOR_NAMES = ['red', 'blue', 'green', 'yellow'];
const BALL_RADIUS = 12;
const CANVAS_W    = 320;
const CANVAS_H    = 520;
const OBSTACLE_H  = 22;
const OBSTACLE_GAP_Y = 80; // px between rows
const SCROLL_SPEED = 1.4;  // px per frame the world scrolls up

// ── Audio ────────────────────────────────────────────────────────────────────
let _ac = null;
function getAC() { if (!_ac) _ac = new (window.AudioContext||window.webkitAudioContext)(); return _ac; }
function tone(f,d,t='sine',v=0.12) {
  try{const o=getAC().createOscillator(),g=getAC().createGain();o.connect(g);g.connect(getAC().destination);
  o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,getAC().currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,getAC().currentTime+d);o.start();o.stop(getAC().currentTime+d+0.02);}catch(e){}
}
const sndSwitch = () => tone(600,0.06,'square',0.1);
const sndHit    = () => { tone(150,0.1,'sawtooth',0.15); setTimeout(()=>tone(100,0.08,'sawtooth',0.1),60); };
const sndBounce = () => tone(440,0.04,'sine',0.08);
const sndWin    = () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.15),i*80));

// Build obstacle draw list from server course data
function buildObstacles(course, scrollY, canvasH) {
  // Each course row has a y (0..courseLength) and sections
  // We map course y -> canvas y: bottom of canvas = y=0, top = finish
  return course.map(obs => {
    const canvasY = canvasH - (obs.y * OBSTACLE_GAP_Y - scrollY);
    return { ...obs, canvasY };
  }).filter(o => o.canvasY > -OBSTACLE_H && o.canvasY < canvasH + OBSTACLE_H);
}

function checkCollision(ballX, ballY, colorIndex, obstacles) {
  for (const obs of obstacles) {
    const top = obs.canvasY - OBSTACLE_H / 2;
    const bot = obs.canvasY + OBSTACLE_H / 2;
    if (ballY + BALL_RADIUS < top || ballY - BALL_RADIUS > bot) continue;
    // ball overlaps this row vertically — check sections
    const ballColor = COLOR_NAMES[colorIndex];
    for (const sec of obs.sections) {
      const secLeft  = (sec.x / 100) * CANVAS_W;
      const secRight = secLeft + (sec.width / 100) * CANVAS_W;
      if (ballX + BALL_RADIUS > secLeft && ballX - BALL_RADIUS < secRight) {
        if (!sec.isGap && sec.color !== ballColor) {
          return true; // collision with wrong-color wall
        }
      }
    }
  }
  return false;
}

// ── Canvas Renderer ───────────────────────────────────────────────────────────
function drawFrame(ctx, state, playerStates, players, playerId, course, canvasW, canvasH) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
  bg.addColorStop(0, '#071020');
  bg.addColorStop(1, '#0f1923');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const myState = state;

  // Draw obstacles
  const visible = buildObstacles(course, myState.scrollY || 0, canvasH);
  for (const obs of visible) {
    for (const sec of obs.sections) {
      const x = (sec.x / 100) * canvasW;
      const w = (sec.width / 100) * canvasW;
      const y = obs.canvasY - OBSTACLE_H / 2;
      const colorMap = { red:'#e63946', blue:'#4cc9f0', green:'#06d6a0', yellow:'#ffd60a' };
      const col = colorMap[sec.color] || '#888';
      if (sec.isGap) {
        // draw gap outline
        ctx.strokeStyle = col + '44';
        ctx.lineWidth = 1;
        ctx.strokeRect(x+1, y+1, w-2, OBSTACLE_H-2);
      } else {
        ctx.fillStyle = col + 'cc';
        ctx.beginPath();
        ctx.roundRect(x+1, y+1, w-2, OBSTACLE_H-2, 4);
        ctx.fill();
        // shine
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x+2, y+2, w-4, 4);
      }
    }
  }

  // Draw finish line
  const finishCanvasY = canvasH - (state.finishY * OBSTACLE_GAP_Y - (state.scrollY||0));
  if (finishCanvasY > 0 && finishCanvasY < canvasH) {
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.moveTo(0, finishCanvasY); ctx.lineTo(canvasW, finishCanvasY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 12px Inter,sans-serif';
    ctx.fillText('FINISH', 8, finishCanvasY - 6);
  }

  // Draw other players (server positions)
  for (const [pid, ps] of Object.entries(playerStates)) {
    if (pid === playerId) continue;
    const p = players.find(pl => pl.id === pid);
    const ballCanvasY = canvasH - (ps.y * OBSTACLE_GAP_Y - (state.scrollY||0));
    const col = COLORS[ps.colorIndex % COLORS.length];
    // shadow
    ctx.beginPath();
    ctx.ellipse(state.ballX || canvasW/2, ballCanvasY + BALL_RADIUS + 4, BALL_RADIUS*0.8, 4, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    // ball
    ctx.beginPath();
    ctx.arc(state.ballX || canvasW/2, ballCanvasY, BALL_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = col + '99';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    // name
    if (p) {
      ctx.fillStyle = col;
      ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, state.ballX || canvasW/2, ballCanvasY - BALL_RADIUS - 4);
    }
  }

  // Draw MY ball
  const myBallX = state.ballX || canvasW / 2;
  const myBallY = state.ballY || canvasH * 0.7;
  const myColor = COLORS[state.colorIndex % COLORS.length];
  // glow
  const glow = ctx.createRadialGradient(myBallX, myBallY, 0, myBallX, myBallY, BALL_RADIUS * 2.5);
  glow.addColorStop(0, myColor + '55');
  glow.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(myBallX, myBallY, BALL_RADIUS*2.5, 0, Math.PI*2);
  ctx.fillStyle = glow; ctx.fill();
  // shadow
  ctx.beginPath();
  ctx.ellipse(myBallX, myBallY + BALL_RADIUS + 4, BALL_RADIUS*0.8, 4, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  // main ball
  const ballGrad = ctx.createRadialGradient(myBallX - 4, myBallY - 4, 1, myBallX, myBallY, BALL_RADIUS);
  ballGrad.addColorStop(0, '#fff');
  ballGrad.addColorStop(0.3, myColor);
  ballGrad.addColorStop(1, myColor + 'aa');
  ctx.beginPath(); ctx.arc(myBallX, myBallY, BALL_RADIUS, 0, Math.PI*2);
  ctx.fillStyle = ballGrad; ctx.fill();

  // Color indicator ring
  ctx.beginPath(); ctx.arc(myBallX, myBallY, BALL_RADIUS + 3, 0, Math.PI*2);
  ctx.strokeStyle = myColor;
  ctx.lineWidth = state.flash ? 4 : 2;
  ctx.stroke();

  ctx.textAlign = 'left'; // reset
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BounceGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  const canvasRef    = useRef(null);
  const stateRef     = useRef(null); // local physics state
  const rafRef       = useRef(null);
  const lastTimeRef  = useRef(null);
  const augmented = { ...gameState, minPlayers: 2, maxPlayers: 4 };

  const [finished, setFinished] = useState(false);

  // init local physics state when game starts
  useEffect(() => {
    if (gameState.state !== 'playing') return;
    stateRef.current = {
      ballX: CANVAS_W / 2,
      ballY: CANVAS_H * 0.75,
      vy: 0,
      colorIndex: 0,
      scrollY: 0,
      worldY: 0, // how far up the course we've gone
      finishY: gameState.finishY,
      flash: false,
      flashTimer: 0,
      hitCooldown: 0,
    };
    lastTimeRef.current = null;
  }, [gameState.state]);

  // Physics loop
  useEffect(() => {
    if (gameState.state !== 'playing' || !gameState.course) return;
    const course = gameState.course;
    const speed  = (gameState.settings?.speed || 2) * SCROLL_SPEED;
    const playerStates = gameState.playerStates || {};

    function loop(ts) {
      rafRef.current = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas || !stateRef.current) return;
      const ctx = canvas.getContext('2d');
      const s   = stateRef.current;

      const dt = lastTimeRef.current ? Math.min((ts - lastTimeRef.current) / 16.67, 3) : 1;
      lastTimeRef.current = ts;

      // Gravity + bounce
      s.vy += 0.55 * dt;
      s.ballY += s.vy * dt;

      // Floor bounce
      if (s.ballY >= CANVAS_H * 0.75) {
        s.ballY = CANVAS_H * 0.75;
        if (s.vy > 1) sndBounce();
        s.vy = -Math.max(8, Math.min(s.vy * -0.85, 16));
      }

      // Scroll world up
      if (s.ballY < CANVAS_H * 0.6) {
        const pushUp = (CANVAS_H * 0.6 - s.ballY) * 0.04 * dt;
        s.scrollY  += pushUp;
        s.worldY   += pushUp / OBSTACLE_GAP_Y;
        s.ballY    += pushUp;
      }
      s.scrollY += speed * dt * 0.3;

      // Collision check
      if (s.hitCooldown > 0) {
        s.hitCooldown -= dt;
      } else {
        const obstacles = buildObstacles(course, s.scrollY, CANVAS_H);
        if (checkCollision(s.ballX, s.ballY, s.colorIndex, obstacles)) {
          sndHit();
          s.scrollY = Math.max(0, s.scrollY - OBSTACLE_GAP_Y * 1.5);
          s.worldY  = Math.max(0, s.worldY - 1.5);
          s.hitCooldown = 45;
          s.flash = true;
          setTimeout(() => { if (stateRef.current) stateRef.current.flash = false; }, 300);
        }
      }

      // Win check
      const curWorldY = s.scrollY / OBSTACLE_GAP_Y;
      if (curWorldY >= s.finishY && !finished) {
        setFinished(true);
        sndWin();
        onGameAction('progress', { y: s.finishY, colorIndex: s.colorIndex });
      }

      // Report position to server every ~20 frames
      if (Math.floor(ts / 333) !== Math.floor((ts - 16) / 333)) {
        onGameAction('progress', { y: curWorldY, colorIndex: s.colorIndex });
      }

      drawFrame(ctx, {
        ...s,
        finishY: gameState.finishY,
        scrollY: s.scrollY,
      }, playerStates, gameState.players, playerId, course, CANVAS_W, CANVAS_H);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState.state, gameState.course, gameState.playerStates]);

  const handleTap = useCallback(() => {
    if (!stateRef.current || gameState.state !== 'playing') return;
    const s = stateRef.current;
    // Tap → boost up + switch color
    s.vy = -14;
    s.colorIndex = (s.colorIndex + 1) % COLORS.length;
    sndSwitch();
    onGameAction('colorSwitch');
  }, [gameState.state]);

  if (gameState.state === 'waiting')
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error}/>;
  if (gameState.state === 'finished')
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby}/>;

  const myPState   = gameState.playerStates?.[playerId];
  const colorIndex = stateRef.current?.colorIndex ?? 0;
  const myColor    = COLORS[colorIndex];
  const progress   = Math.min(100, ((stateRef.current?.scrollY || 0) / OBSTACLE_GAP_Y / gameState.finishY) * 100);

  // leaderboard
  const ranked = [...(gameState.players||[])].sort((a,b) => {
    const ay = gameState.playerStates?.[a.id]?.y || 0;
    const by = gameState.playerStates?.[b.id]?.y || 0;
    return by - ay;
  });

  return (
    <div className="bnc-game" onPointerDown={handleTap}>
      <div className="bnc-bar">
        <span className="bnc-title">🔵 Bounce</span>
        <div className="bnc-progress-wrap">
          <div className="bnc-progress-bar">
            <div className="bnc-progress-fill" style={{width:`${progress}%`,background:myColor}}/>
          </div>
          <span className="bnc-pct">{Math.round(progress)}%</span>
        </div>
        <div className="bnc-mini-rank">
          {ranked.map((p,i) => (
            <span key={p.id} className={`bnc-rank-chip ${p.id===playerId?'me':''}`}>
              #{i+1} {p.name.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>

      <div className="bnc-layout">
        {/* canvas */}
        <div className="bnc-canvas-wrap">
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="bnc-canvas"/>
          {/* color wheel indicator */}
          <div className="bnc-color-indicator">
            {COLORS.map((c,i) => (
              <div key={i} className={`bnc-color-dot ${i===colorIndex?'active':''}`}
                style={{ background: c, boxShadow: i===colorIndex?`0 0 10px ${c}`:'' }}/>
            ))}
          </div>
          <div className="bnc-tap-hint">TAP anywhere to JUMP + switch color</div>
        </div>

        {/* side panel */}
        <div className="bnc-side">
          <div className="bnc-side-title">Leaderboard</div>
          {ranked.map((p,i) => {
            const ps = gameState.playerStates?.[p.id];
            const pct = Math.min(100, ((ps?.y||0) / gameState.finishY) * 100);
            return (
              <div key={p.id} className={`bnc-leader-row ${p.id===playerId?'me':''}`}>
                <span className="bnc-leader-rank">#{i+1}</span>
                <span className="bnc-leader-name">{p.name}</span>
                <div className="bnc-leader-prog">
                  <div style={{width:`${pct}%`, background: COLORS[ps?.colorIndex||0]}}/>
                </div>
                <span className="bnc-leader-pct">{Math.round(pct)}%</span>
              </div>
            );
          })}

          <div className="bnc-rules">
            <div className="bnc-rules-title">How to play</div>
            <div>🎯 <strong>Tap</strong> to jump up</div>
            <div>🎨 Each tap <strong>switches</strong> your color</div>
            <div>✅ Match the <strong>colored wall</strong> to pass</div>
            <div>❌ Wrong color = <strong>knocked back!</strong></div>
            <div>🏆 First to the <strong>FINISH</strong> wins!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
