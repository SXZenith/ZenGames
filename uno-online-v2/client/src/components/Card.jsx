import React from 'react';
import './Card.css';

const COLOR_MAP = {
  red: '#ff3b52',
  yellow: '#ffd93d',
  green: '#06d6a0',
  blue: '#4cc9f0',
  wild: '#1a1d27',
};

const LABEL_MAP = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: 'W',
  wild4: 'W+4',
};

export function UnoCard({ card, onClick, selected, disabled, small }) {
  const color = COLOR_MAP[card.color] || '#888';
  const label = LABEL_MAP[card.value] || card.value;
  const isAction = isNaN(parseInt(card.value));
  const isWild = card.color === 'wild';

  return (
    <div
      className={`uno-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${small ? 'small' : ''} ${isAction ? 'action' : ''} ${isWild ? 'wild-card' : ''}`}
      style={{ '--card-color': color }}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="card-inner">
        {isWild ? (
          <div className="wild-inner">
            <div className="wild-quadrant q1" />
            <div className="wild-quadrant q2" />
            <div className="wild-quadrant q3" />
            <div className="wild-quadrant q4" />
            <div className="wild-center-label">{label}</div>
          </div>
        ) : (
          <>
            <div className="card-corner top-left">{label}</div>
            <div className="card-center">{label}</div>
            <div className="card-corner bottom-right">{label}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function CardBack({ small }) {
  return (
    <div className={`uno-card card-back ${small ? 'small' : ''}`}>
      <div className="card-inner back-inner">
        <div className="back-logo">UNO</div>
      </div>
    </div>
  );
}
