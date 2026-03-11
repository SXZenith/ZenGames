import React, { useState, useEffect } from 'react';
import { GAME_LIST, defaultSettingsFor } from '../games/SharedRoom';
import './Lobby.css';

const TIMER_OPTIONS = [0,10,15,20,30];

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected, autoJoinCode }) {
  const [tab,      setTab]      = useState(autoJoinCode ? 'join' : 'create');
  const [name,     setName]     = useState('');
  const [code,     setCode]     = useState(autoJoinCode || '');
  const [gameId,   setGameId]   = useState('uno');
  const [settings, setSettings] = useState(() => defaultSettingsFor('uno'));

  useEffect(() => {
    if (autoJoinCode) { setCode(autoJoinCode); setTab('join'); }
  }, [autoJoinCode]);

  const selectedGame = GAME_LIST.find(g => g.id === gameId);

  const selectGame = (g) => {
    setGameId(g.id);
    setSettings(defaultSettingsFor(g.id));
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
        <div className="lobby-logo">
          <div className="zen-badge">ZG</div>
          <div>
            <div className="zen-title">ZenGames</div>
            <div className="zen-sub">Online Multiplayer</div>
          </div>
        </div>

        <div className="tab-bar">
          <button className={`tab ${tab==='create'?'active':''}`} onClick={() => setTab('create')}>Create Room</button>
          <button className={`tab ${tab==='join'  ?'active':''}`} onClick={() => setTab('join')  }>Join Room</button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="lobby-form">
            <label className="form-label">Your Name</label>
            <input className="input-field" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)} maxLength={20} autoFocus />

            <label className="form-label" style={{marginTop:4}}>Game</label>
            <div className="game-picker">
              {GAME_LIST.map(g => (
                <button key={g.id} type="button"
                  className={`game-tile ${gameId===g.id?'selected':''}`}
                  onClick={() => selectGame(g)}>
                  <span className="game-tile-emoji">{g.emoji}</span>
                  <span className="game-tile-name">{g.name}</span>
                  <span className="game-tile-players">{g.players}p</span>
                </button>
              ))}
            </div>

            <div className="game-desc">{selectedGame?.description}</div>

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
