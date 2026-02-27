import React, { useState, useEffect } from 'react';
import './Lobby.css';

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected, autoJoinCode }) {
  const [tab,  setTab]  = useState(autoJoinCode ? 'join' : 'create');
  const [name, setName] = useState('');
  const [code, setCode] = useState(autoJoinCode || '');

  // If autoJoinCode arrives after mount (shouldn't happen now, but safe)
  useEffect(() => {
    if (autoJoinCode) { setCode(autoJoinCode); setTab('join'); }
  }, [autoJoinCode]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (name.trim() && connected) onCreateRoom(name.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (name.trim() && code.trim().length === 6 && connected) onJoinRoom(code.trim(), name.trim());
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-logo">
          <div className="uno-badge">UNO</div>
          <span className="lobby-subtitle">Online</span>
        </div>

        <div className="tab-bar">
          <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Create Room</button>
          <button className={`tab ${tab === 'join'   ? 'active' : ''}`} onClick={() => setTab('join')  }>Join Room</button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="lobby-form">
            <label className="form-label">Your Name</label>
            <input className="input-field" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)} maxLength={20} autoFocus />
            <button className="btn-primary" type="submit" disabled={!name.trim() || !connected}>
              Create Room
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="lobby-form">
            <label className="form-label">Your Name</label>
            <input className="input-field" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)} maxLength={20} autoFocus />
            <label className="form-label" style={{ marginTop: 8 }}>Room Code</label>
            <input className="input-field code-input" placeholder="ABC123" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} />
            <button className="btn-primary" type="submit" disabled={!name.trim() || code.trim().length < 6 || !connected}>
              Join Room
            </button>
          </form>
        )}

        {error && <div className="error-msg">⚠ {error}</div>}

        <div style={{ color: connected ? 'var(--green)' : 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
          {connected ? '● Connected' : '● Connecting to server…'}
        </div>
        <p className="lobby-note">2–4 players · Share a room code or invite link to play</p>
      </div>
    </div>
  );
}
