import React, { useState, useEffect } from 'react';
import './Lobby.css';

const GAMES = [
  {
    id: 'uno', name: 'UNO', emoji: '🃏',
    description: 'Match colors & numbers. First to empty their hand wins!',
    players: '2–4',
    settings: [
      { key:'stackDraw2',      label:'Stack +2',         type:'toggle', default:true,  desc:'Play +2 on +2 to pass the penalty' },
      { key:'stackDraw4',      label:'Stack +4',         type:'toggle', default:true,  desc:'Play +4 on +4 to pass the penalty' },
      { key:'drawUntilPlayable',label:'Draw Until Play', type:'toggle', default:false, desc:'Keep drawing until you get a playable card' },
      { key:'freeWild4',       label:'Free Wild +4',     type:'toggle', default:false, desc:'Play Wild Draw 4 any time' },
      { key:'pickTimer',       label:'Turn Timer',       type:'timer',  default:0 },
    ],
  },
  {
    id: 'connect4', name: 'Connect 4', emoji: '🔴',
    description: 'Drop discs to connect 4 in a row — horizontally, vertically, or diagonally!',
    players: '2',
    settings: [
      { key:'allowUndo', label:'Allow Undo', type:'toggle', default:false, desc:'Players can undo their last move' },
      { key:'winStreak', label:'Win Streak', type:'chips',  default:4, options:[3,4,5], desc:'How many in a row to win' },
    ],
  },
  {
    id: 'checkers', name: 'Checkers', emoji: '⚫',
    description: "Classic draughts — capture all your opponent's pieces to win!",
    players: '2',
    settings: [
      { key:'mandatoryCapture', label:'Must Capture', type:'toggle', default:true,  desc:'You must capture if a capture is available' },
      { key:'flyingKings',      label:'Flying Kings', type:'toggle', default:false, desc:'Kings can move multiple squares at once' },
    ],
  },
  {
    id: 'ludo', name: 'Ludo', emoji: '🎲',
    description: 'Roll dice and race your 4 tokens home. Land on opponents to send them back!',
    players: '2–4',
    settings: [
      { key:'safeSquares', label:'Safe Squares', type:'toggle', default:true,  desc:'Marked squares where pieces cannot be captured' },
      { key:'extraTurn6',  label:'6 = Extra Turn',type:'toggle', default:true,  desc:'Rolling 6 grants an extra roll' },
      { key:'mustUse6',    label:'Need 6 to Enter',type:'toggle',default:true,  desc:'Must roll a 6 to enter the board' },
    ],
  },
];

const TIMER_OPTIONS = [0,10,15,20,30];

function defaultSettings(game) {
  const s = {};
  game.settings.forEach(opt => { s[opt.key] = opt.default; });
  return s;
}

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected, autoJoinCode }) {
  const [tab,        setTab]        = useState(autoJoinCode ? 'join' : 'create');
  const [name,       setName]       = useState('');
  const [code,       setCode]       = useState(autoJoinCode || '');
  const [gameId,     setGameId]     = useState('uno');
  const [settings,   setSettings]   = useState(() => defaultSettings(GAMES[0]));
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (autoJoinCode) { setCode(autoJoinCode); setTab('join'); }
  }, [autoJoinCode]);

  const selectedGame = GAMES.find(g => g.id === gameId);

  const selectGame = (g) => {
    setGameId(g.id);
    setSettings(defaultSettings(g));
    setShowPicker(false);
  };

  const updateSetting = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleCreate = (e) => {
    e.preventDefault();
    if (name.trim() && connected) onCreateRoom(name.trim(), gameId, settings);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (name.trim() && code.trim().length === 6 && connected) onJoinRoom(code.trim(), name.trim());
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        {/* Logo */}
        <div className="lobby-logo">
          <div className="zen-badge">ZG</div>
          <div>
            <div className="zen-title">ZenGames</div>
            <div className="zen-sub">Online Multiplayer</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab ${tab==='create'?'active':''}`} onClick={() => setTab('create')}>Create Room</button>
          <button className={`tab ${tab==='join'  ?'active':''}`} onClick={() => setTab('join')  }>Join Room</button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="lobby-form">
            {/* Name */}
            <label className="form-label">Your Name</label>
            <input className="input-field" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)} maxLength={20} autoFocus />

            {/* Game Picker */}
            <label className="form-label" style={{marginTop:4}}>Game</label>
            <div className="game-picker">
              {GAMES.map(g => (
                <button key={g.id} type="button"
                  className={`game-tile ${gameId===g.id?'selected':''}`}
                  onClick={() => selectGame(g)}>
                  <span className="game-tile-emoji">{g.emoji}</span>
                  <span className="game-tile-name">{g.name}</span>
                  <span className="game-tile-players">{g.players}p</span>
                </button>
              ))}
            </div>

            {/* Game description */}
            <div className="game-desc">{selectedGame?.description}</div>

            {/* Game-specific settings */}
            <div className="game-settings">
              {selectedGame?.settings.map(opt => (
                <div key={opt.key} className="gs-row">
                  <div className="gs-label">
                    <span className="gs-name">{opt.label}</span>
                    {opt.desc && <span className="gs-desc">{opt.desc}</span>}
                  </div>
                  {opt.type === 'toggle' && (
                    <button type="button"
                      className={`gs-toggle ${settings[opt.key]?'on':'off'}`}
                      onClick={() => updateSetting(opt.key, !settings[opt.key])}>
                      {settings[opt.key]?'ON':'OFF'}
                    </button>
                  )}
                  {opt.type === 'timer' && (
                    <div className="gs-chips">
                      {TIMER_OPTIONS.map(t => (
                        <button key={t} type="button"
                          className={`gs-chip ${settings[opt.key]===t?'active':''}`}
                          onClick={() => updateSetting(opt.key, t)}>
                          {t===0?'Off':`${t}s`}
                        </button>
                      ))}
                    </div>
                  )}
                  {opt.type === 'chips' && (
                    <div className="gs-chips">
                      {opt.options.map(v => (
                        <button key={v} type="button"
                          className={`gs-chip ${settings[opt.key]===v?'active':''}`}
                          onClick={() => updateSetting(opt.key, v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button className="btn-primary" type="submit" disabled={!name.trim() || !connected}>
              Create Room
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="lobby-form">
            <label className="form-label">Your Name</label>
            <input className="input-field" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)} maxLength={20} autoFocus />
            <label className="form-label" style={{marginTop:8}}>Room Code</label>
            <input className="input-field code-input" placeholder="ABC123" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} />
            <button className="btn-primary" type="submit" disabled={!name.trim() || code.trim().length<6 || !connected}>
              Join Room
            </button>
          </form>
        )}

        {error && <div className="error-msg">⚠ {error}</div>}

        <div className="conn-row">
          <span style={{color: connected?'var(--green)':'var(--text-muted)'}}>
            {connected ? '● Connected' : '● Connecting…'}
          </span>
        </div>
        <p className="lobby-note">Share a room code or invite link to play</p>
      </div>
    </div>
  );
}
