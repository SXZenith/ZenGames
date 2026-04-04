import React, { useState, useEffect } from 'react';
import { GAME_LIST, defaultSettingsFor } from '../games/SharedRoom';
import './Lobby.css';

const TIMER_OPTIONS = [0,10,15,20,30];

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected, autoJoinCode }) {
  const [tab,      setTab]      = useState(autoJoinCode ? 'join' : 'create');
  const [name,     setName]     = useState('');
  const [code,     setCode]     = useState(autoJoinCode || '');
  const [gameId,       setGameId]       = useState('uno');
  const [settings,     setSettings]     = useState(() => defaultSettingsFor('uno'));
  const [gameOpen,     setGameOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (autoJoinCode) { setCode(autoJoinCode); setTab('join'); }
  }, [autoJoinCode]);

  const selectedGame   = GAME_LIST.find(g => g.id === gameId);
  const activeSettings = selectedGame?.settings.filter(opt => settings[opt.key] !== opt.default) ?? [];

  const selectGame = (g) => {
    setGameId(g.id);
    setSettings(defaultSettingsFor(g.id));
    setGameOpen(false);
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

            {/* Game dropdown */}
            <div className="lob-dropdown">
              <button type="button" className="lob-drop-trigger"
                onClick={() => { setGameOpen(o=>!o); setSettingsOpen(false); }}>
                <span className="lob-drop-selected">
                  <span className="lob-drop-emoji">{selectedGame?.emoji}</span>
                  <span className="lob-drop-name">{selectedGame?.name}</span>
                  <span className="lob-drop-players">{selectedGame?.players}p</span>
                </span>
                <span className={`lob-drop-arrow ${gameOpen?'open':''}`}>▾</span>
              </button>
              {gameOpen && (
                <div className="lob-drop-panel">
                  <div className="lob-game-grid">
                    {GAME_LIST.map(g => (
                      <button key={g.id} type="button"
                        className={`lob-game-tile ${gameId===g.id?'selected':''}`}
                        onClick={() => selectGame(g)}>
                        <span className="lob-tile-emoji">{g.emoji}</span>
                        <span className="lob-tile-name">{g.name}</span>
                        <span className="lob-tile-players">{g.players}p</span>
                      </button>
                    ))}
                  </div>
                  <p className="lob-game-desc">{selectedGame?.description}</p>
                </div>
              )}
            </div>

            {/* Settings dropdown */}
            {selectedGame?.settings?.length > 0 && (
              <div className="lob-dropdown">
                <button type="button" className="lob-drop-trigger settings-trigger"
                  onClick={() => { setSettingsOpen(o=>!o); setGameOpen(false); }}>
                  <span className="lob-drop-label">
                    ⚙ Settings
                    {activeSettings.length > 0 && (
                      <span className="lob-settings-badge">{activeSettings.length} changed</span>
                    )}
                  </span>
                  <span className={`lob-drop-arrow ${settingsOpen?'open':''}`}>▾</span>
                </button>
                {settingsOpen && (
                  <div className="lob-drop-panel settings-panel">
                    {selectedGame.settings.map(opt => (
                      <div key={opt.key} className="lob-setting-row">
                        <div className="lob-setting-info">
                          <span className="lob-setting-name">{opt.label}</span>
                          {opt.desc && <span className="lob-setting-desc">{opt.desc}</span>}
                        </div>
                        {opt.type === 'toggle' && (
                          <button type="button"
                            className={`lob-toggle ${settings[opt.key]?'on':'off'}`}
                            onClick={() => updateSetting(opt.key, !settings[opt.key])}>
                            {settings[opt.key]?'ON':'OFF'}
                          </button>
                        )}
                        {(opt.type === 'timer' || opt.type === 'chips') && (
                          <div className="lob-chips">
                            {(opt.type==='timer' ? TIMER_OPTIONS : opt.options).map(v => (
                              <button key={v} type="button"
                                className={`lob-chip ${settings[opt.key]===v?'active':''}`}
                                onClick={() => updateSetting(opt.key, v)}>
                                {opt.type==='timer' ? (v===0?'Off':`${v}s`) : v}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active settings summary */}
            {activeSettings.length > 0 && (
              <div className="lob-active-settings">
                {activeSettings.map(opt => (
                  <span key={opt.key} className="lob-active-pill">
                    {opt.label}: <strong>{
                      opt.type==='toggle' ? (settings[opt.key]?'ON':'OFF')
                      : opt.type==='timer' ? (settings[opt.key]===0?'Off':`${settings[opt.key]}s`)
                      : settings[opt.key]
                    }</strong>
                  </span>
                ))}
              </div>
            )}

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
