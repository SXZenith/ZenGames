import React from 'react';
import './LobbySettings.css';

const TIMER_OPTIONS = [0, 10, 15, 20, 30];

export default function LobbySettings({ settings, onChange, isHost }) {
  if (!settings) return null;
  const update = (key, val) => onChange({ ...settings, [key]: val });

  return (
    <div className="lobby-settings">
      <div className="ls-title">Game Rules</div>

      {/* Turn Timer */}
      <div className="ls-row">
        <div className="ls-label">
          <span className="ls-name">Turn Timer</span>
          <span className="ls-desc">Seconds to play before auto-draw</span>
        </div>
        <div className="ls-timer-options">
          {TIMER_OPTIONS.map(t => (
            <button key={t} className={`ls-chip ${settings.pickTimer===t?'active':''}`}
              onClick={() => isHost && update('pickTimer', t)} disabled={!isHost}>
              {t===0?'Off':`${t}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Stack +2 */}
      <div className="ls-row">
        <div className="ls-label">
          <span className="ls-name">Stack +2 cards</span>
          <span className="ls-desc">Play +2 on +2 to pass the penalty on</span>
        </div>
        <button className={`ls-toggle ${settings.stackDraw2?'on':'off'}`}
          onClick={() => isHost && update('stackDraw2', !settings.stackDraw2)} disabled={!isHost}>
          {settings.stackDraw2?'ON':'OFF'}
        </button>
      </div>

      {/* Stack +4 */}
      <div className="ls-row">
        <div className="ls-label">
          <span className="ls-name">Stack +4 cards</span>
          <span className="ls-desc">Play +4 on +4 to pass the penalty on</span>
        </div>
        <button className={`ls-toggle ${settings.stackDraw4?'on':'off'}`}
          onClick={() => isHost && update('stackDraw4', !settings.stackDraw4)} disabled={!isHost}>
          {settings.stackDraw4?'ON':'OFF'}
        </button>
      </div>

      {/* Draw Until Playable */}
      <div className="ls-row">
        <div className="ls-label">
          <span className="ls-name">Draw until playable</span>
          <span className="ls-desc">Keep drawing one card at a time until you can play</span>
        </div>
        <button className={`ls-toggle ${settings.drawUntilPlayable?'on':'off'}`}
          onClick={() => isHost && update('drawUntilPlayable', !settings.drawUntilPlayable)} disabled={!isHost}>
          {settings.drawUntilPlayable?'ON':'OFF'}
        </button>
      </div>

      {/* Free Wild Draw 4 */}
      <div className="ls-row">
        <div className="ls-label">
          <span className="ls-name">Free Wild +4</span>
          <span className="ls-desc">Play Wild Draw 4 any time, even with matching cards</span>
        </div>
        <button className={`ls-toggle ${settings.freeWild4?'on':'off'}`}
          onClick={() => isHost && update('freeWild4', !settings.freeWild4)} disabled={!isHost}>
          {settings.freeWild4?'ON':'OFF'}
        </button>
      </div>

      {!isHost && <p className="ls-note">Only the host can change settings</p>}
    </div>
  );
}
