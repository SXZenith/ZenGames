import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WaitingRoom, GameOver } from '../SharedRoom';
import './TetrisGame.css';

// ── Web Audio ────────────────────────────────────────────────────────────────
let _ctx = null;
function ac() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}
function tone(freq, dur, type = 'square', vol = 0.08) {
  try {
    const o = ac().createOscillator(), g = ac().createGain();
    o.connect(g); g.connect(ac().destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac().currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac().currentTime + dur);
    o.start(); o.stop(ac().currentTime + dur + 0.02);
  } catch(e) {}
}
const sndMove     = () => tone(220, 0.04, 'square', 0.05);
const sndRotate   = () => { tone(440, 0.06, 'square', 0.07); tone(550, 0.06, 'square', 0.05); };
const sndLock     = () => tone(180, 0.1, 'sawtooth', 0.1);
const sndLine     = (n) => [523, 659, 784, 1047].slice(0, n).forEach((f,i) => setTimeout(() => tone(f, 0.15, 'square', 0.12), i * 60));
const sndTetris   = () => [523,659,784,1047,1319].forEach((f,i) => setTimeout(() => tone(f, 0.2, 'square', 0.15), i * 70));
const sndGameOver = () => [440,392,349,330,294,262].forEach((f,i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.12), i * 100));
const sndHardDrop = () => { tone(300, 0.05, 'square', 0.12); setTimeout(() => tone(150, 0.08, 'sawtooth', 0.1), 40); };

// ── Colors ───────────────────────────────────────────────────────────────────
const COLORS = {
  cyan:   '#00f5ff', yellow: '#ffe600', purple: '#c840ff',
  green:  '#39ff14', red:    '#ff3131', blue:   '#4466ff',
  orange: '#ff8c00', gray:   '#445566',
};

const PIECE_PREVIEWS = {
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[0,0],[1,0],[2,0],[1,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]],
};

const BOARD_W = 10;
const BOARD_H = 20;
const CELL = 28; // px per cell

// Funny messages for actions
const ACTION_LABELS = {
  left:     ['◀ left', '◀ slide', '◀ nope'],
  right:    ['▶ right', '▶ push', '▶ excuse me'],
  rotate:   ['↺ spin', '↺ rotate', '↺ whirl', '↺ YEET'],
  softDrop: ['▼ drop', '▼ down', '▼ fall'],
  hardDrop: ['⬇ SLAM!', '⬇ NUKE!', '⬇ DROPPED IT!'],
};

function randomLabel(action) {
  const pool = ACTION_LABELS[action] || [action];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Ghost piece calculation ──────────────────────────────────────────────────
function calcGhost(board, piece) {
  if (!piece) return null;
  let gy = piece.y;
  while (true) {
    if (!isValid(board, piece.cells, piece.x, gy + 1)) break;
    gy++;
  }
  return { ...piece, y: gy };
}

function isValid(board, cells, px, py) {
  for (const [cx, cy] of cells) {
    const nx = px + cx, ny = py + cy;
    if (nx < 0 || nx >= BOARD_W || ny >= BOARD_H) return false;
    if (ny >= 0 && board[ny] && board[ny][nx] !== null) return false;
  }
  return true;
}

// ── Mini preview for next piece ──────────────────────────────────────────────
function PiecePreview({ type, color }) {
  if (!type) return null;
  const cells = PIECE_PREVIEWS[type] || [];
  const size = 16;
  const w = type === 'I' ? 4 : type === 'O' ? 2 : 3;
  const h = type === 'I' ? 2 : 2;
  return (
    <div className="tt-preview-grid" style={{ width: w * size, height: h * size, position: 'relative' }}>
      {cells.map(([cx, cy], i) => (
        <div key={i} className="tt-preview-cell"
          style={{ left: cx * size, top: cy * size, width: size - 2, height: size - 2,
            background: COLORS[color] || '#888',
            boxShadow: `0 0 6px ${COLORS[color]}88` }} />
      ))}
    </div>
  );
}

// ── Main board renderer ──────────────────────────────────────────────────────
function TetrisBoard({ board, currentPiece, ghostPiece, flashRows, shakeBoard }) {
  const cells = [];

  for (let row = 0; row < BOARD_H; row++) {
    for (let col = 0; col < BOARD_W; col++) {
      let color = board[row]?.[col] || null;
      let isGhost = false;
      let isActive = false;

      // Check active piece
      if (currentPiece) {
        for (const [cx, cy] of currentPiece.cells) {
          if (currentPiece.x + cx === col && currentPiece.y + cy === row) {
            color = currentPiece.color;
            isActive = true;
          }
        }
      }
      // Check ghost
      if (!isActive && ghostPiece) {
        for (const [cx, cy] of ghostPiece.cells) {
          if (ghostPiece.x + cx === col && ghostPiece.y + cy === row && !color) {
            isGhost = true;
            color = ghostPiece.color;
          }
        }
      }

      const isFlash = flashRows?.includes(row);
      cells.push(
        <div
          key={`${row}-${col}`}
          className={`tt-cell ${color ? 'filled' : 'empty'} ${isGhost ? 'ghost' : ''} ${isActive ? 'active' : ''} ${isFlash ? 'flash' : ''}`}
          style={color ? {
            background: isGhost
              ? `${COLORS[color]}22`
              : isActive
              ? `linear-gradient(135deg, ${COLORS[color]}ee, ${COLORS[color]}99)`
              : `linear-gradient(135deg, ${COLORS[color]}cc, ${COLORS[color]}77)`,
            borderColor: isGhost ? `${COLORS[color]}33` : `${COLORS[color]}88`,
            boxShadow: isActive ? `inset 0 0 8px ${COLORS[color]}44, 0 0 4px ${COLORS[color]}44` : undefined,
          } : {}}
        />
      );
    }
  }

  return (
    <div className={`tt-board ${shakeBoard ? 'shake' : ''}`}
      style={{ width: BOARD_W * CELL, height: BOARD_H * CELL, gridTemplateColumns: `repeat(${BOARD_W}, ${CELL}px)` }}>
      {cells}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TetrisGame({
  gameState, playerId, roomCode, roomLink,
  onStartGame, onRematch, onReturnToLobby, onChangeGame, onGameAction, error,
}) {
  // ── ALL HOOKS FIRST ──────────────────────────────────────────────────────
  const [flashRows,   setFlashRows]   = useState([]);
  const [shakeBoard,  setShakeBoard]  = useState(false);
  const [localEvents, setLocalEvents] = useState([]);
  const [showCombo,   setShowCombo]   = useState(false);
  const [lastScore,   setLastScore]   = useState(0);
  const [scorePop,    setScorePop]    = useState(null);

  const dropTimerRef  = useRef(null);
  const prevLinesRef  = useRef(0);
  const prevScoreRef  = useRef(0);
  const prevComboRef  = useRef(0);
  const prevEventsRef = useRef([]);
  const keysHeld      = useRef({});

  const isPlaying = gameState.state === 'playing';

  // Gravity — server-side drop tick sent from client
  useEffect(() => {
    if (!isPlaying || gameState.gameOver) {
      clearInterval(dropTimerRef.current);
      return;
    }
    const interval = gameState.dropInterval || 800;
    clearInterval(dropTimerRef.current);
    dropTimerRef.current = setInterval(() => {
      onGameAction('gravityTick', {});
    }, interval);
    return () => clearInterval(dropTimerRef.current);
  }, [isPlaying, gameState.dropInterval, gameState.gameOver]);

  // Keyboard input
  useEffect(() => {
    if (!isPlaying) return;
    const handleKey = (e) => {
      if (keysHeld.current[e.code]) return; // prevent key repeat spam
      keysHeld.current[e.code] = true;
      switch (e.code) {
        case 'ArrowLeft':  case 'KeyA': e.preventDefault(); onGameAction('left',     {}); sndMove();     break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); onGameAction('right',    {}); sndMove();     break;
        case 'ArrowUp':    case 'KeyW': e.preventDefault(); onGameAction('rotate',   {}); sndRotate();   break;
        case 'ArrowDown':  case 'KeyS': e.preventDefault(); onGameAction('softDrop', {}); break;
        case 'Space':                   e.preventDefault(); onGameAction('hardDrop', {}); sndHardDrop(); break;
      }
    };
    const handleKeyUp = (e) => { delete keysHeld.current[e.code]; };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKeyUp); };
  }, [isPlaying, onGameAction]);

  // Line clear effects
  useEffect(() => {
    const lines = gameState.lines || 0;
    if (lines > prevLinesRef.current) {
      const cleared = lines - prevLinesRef.current;
      if (cleared >= 4) { sndTetris(); setShakeBoard(true); setTimeout(() => setShakeBoard(false), 600); }
      else sndLine(cleared);
      setFlashRows([...Array(cleared)].map((_, i) => BOARD_H - 1 - i));
      setTimeout(() => setFlashRows([]), 300);
    }
    prevLinesRef.current = lines;
  }, [gameState.lines]);

  // Score pop
  useEffect(() => {
    const score = gameState.score || 0;
    if (score > prevScoreRef.current) {
      const diff = score - prevScoreRef.current;
      setScorePop(`+${diff}`);
      setTimeout(() => setScorePop(null), 1000);
    }
    prevScoreRef.current = score;
  }, [gameState.score]);

  // Combo display
  useEffect(() => {
    const combo = gameState.comboCount || 0;
    if (combo > 1 && combo > prevComboRef.current) {
      setShowCombo(true);
      setTimeout(() => setShowCombo(false), 1500);
    }
    prevComboRef.current = combo;
  }, [gameState.comboCount]);

  // Game over sound
  useEffect(() => {
    if (gameState.gameOver) sndGameOver();
  }, [gameState.gameOver]);

  // New funny events
  useEffect(() => {
    const events = gameState.funnyEvents || [];
    if (events.length > 0 && events[0]?.id !== prevEventsRef.current[0]?.id) {
      setLocalEvents(prev => [events[0], ...prev].slice(0, 4));
      setTimeout(() => setLocalEvents(prev => prev.filter(e => e.id !== events[0].id)), 3000);
    }
    prevEventsRef.current = events;
  }, [gameState.funnyEvents]);

  // ── Early returns AFTER hooks ─────────────────────────────────────────────
  const augmented = { ...gameState, minPlayers: 2, maxPlayers: 4 };
  if (gameState.state === 'waiting')
    return <WaitingRoom gameState={augmented} playerId={playerId}
      roomCode={roomCode} roomLink={roomLink}
      onStartGame={onStartGame} onChangeGame={onChangeGame} error={error} />;
  if (gameState.state === 'finished')
    return <GameOver gameState={gameState} playerId={playerId}
      onRematch={onRematch} onReturnToLobby={onReturnToLobby} />;

  // ── Render game ───────────────────────────────────────────────────────────
  const board   = gameState.board || [];
  const piece   = gameState.currentPiece;
  const ghost   = calcGhost(board, piece);
  const level   = gameState.level || 1;
  const score   = gameState.score || 0;
  const lines   = gameState.lines || 0;
  const combo   = gameState.comboCount || 0;
  const me      = gameState.players?.find(p => p.id === playerId);
  const others  = gameState.players?.filter(p => p.id !== playerId) || [];

  // Last 5 actions with who did them
  const recentActions = (gameState.lastActions || []).slice(0, 5);

  return (
    <div className="tt-game">
      {/* Funny floating events */}
      <div className="tt-events">
        {localEvents.map(e => (
          <div key={e.id} className="tt-event-pop">{e.msg}</div>
        ))}
      </div>

      {/* Combo burst */}
      {showCombo && combo > 1 && (
        <div className="tt-combo-burst">
          {combo}x COMBO! 🔥
        </div>
      )}

      {/* Score pop */}
      {scorePop && <div className="tt-score-pop">{scorePop}</div>}

      <div className="tt-layout">

        {/* ── Left panel ── */}
        <div className="tt-panel left">
          <div className="tt-stat-box">
            <div className="tt-stat-label">SCORE</div>
            <div className="tt-stat-value score-val">{score.toLocaleString()}</div>
          </div>
          <div className="tt-stat-box">
            <div className="tt-stat-label">LEVEL</div>
            <div className="tt-stat-value">{level}</div>
            <div className="tt-level-bar">
              <div className="tt-level-fill" style={{ width: `${((lines % 10) / 10) * 100}%` }} />
            </div>
          </div>
          <div className="tt-stat-box">
            <div className="tt-stat-label">LINES</div>
            <div className="tt-stat-value">{lines}</div>
          </div>

          {/* Players list */}
          <div className="tt-stat-box players-box">
            <div className="tt-stat-label">CHAOS SQUAD</div>
            {gameState.players?.map(p => (
              <div key={p.id} className={`tt-player-row ${p.id === playerId ? 'me' : ''}`}>
                <span className="tt-player-dot" />
                <span className="tt-player-name">{p.name}</span>
              </div>
            ))}
          </div>

          {/* Controls reminder */}
          <div className="tt-controls-hint">
            <div className="tt-hint-title">CONTROLS</div>
            <div className="tt-hint-row"><kbd>← →</kbd> Move</div>
            <div className="tt-hint-row"><kbd>↑</kbd> Rotate</div>
            <div className="tt-hint-row"><kbd>↓</kbd> Soft drop</div>
            <div className="tt-hint-row"><kbd>SPACE</kbd> SLAM</div>
          </div>
        </div>

        {/* ── Center: board ── */}
        <div className="tt-center">
          <div className="tt-board-wrapper">
            <TetrisBoard
              board={board}
              currentPiece={piece}
              ghostPiece={ghost}
              flashRows={flashRows}
              shakeBoard={shakeBoard}
            />

            {/* Game over overlay */}
            {gameState.gameOver && (
              <div className="tt-gameover-overlay">
                <div className="tt-gameover-text">GAME OVER</div>
                <div className="tt-gameover-score">{score.toLocaleString()} pts</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="tt-panel right">
          {/* Next piece */}
          <div className="tt-stat-box next-box">
            <div className="tt-stat-label">NEXT</div>
            <div className="tt-next-piece">
              {gameState.nextPiece && (
                <PiecePreview type={gameState.nextPiece.type} color={gameState.nextPiece.color} />
              )}
            </div>
          </div>

          {/* Live action feed */}
          <div className="tt-stat-box feed-box">
            <div className="tt-stat-label">LIVE FEED 🎮</div>
            <div className="tt-action-feed">
              {recentActions.map((a, i) => {
                const isMe = a.playerId === playerId;
                return (
                  <div key={i} className={`tt-action-item ${isMe ? 'mine' : 'theirs'}`}
                    style={{ opacity: 1 - i * 0.18 }}>
                    <span className="tt-action-player">{a.playerName}</span>
                    <span className="tt-action-label">{randomLabel(a.action)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Combo indicator */}
          {combo > 1 && (
            <div className="tt-stat-box combo-box">
              <div className="tt-combo-count">{combo}x</div>
              <div className="tt-combo-label">COMBO</div>
            </div>
          )}

          {/* High scores */}
          <div className="tt-stat-box scores-box">
            <div className="tt-stat-label">SCORES</div>
            {[...(gameState.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
              <div key={p.id} className={`tt-score-row ${p.id === playerId ? 'me' : ''}`}>
                <span className="tt-score-rank">#{i + 1}</span>
                <span className="tt-score-name">{p.name}</span>
                <span className="tt-score-pts">{(p.score || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
