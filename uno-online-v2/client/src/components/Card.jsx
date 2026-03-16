import React from 'react';
import './Card.css';

const COLOR_MAP = {
  red:    '#e63b4f',
  yellow: '#f0c830',
  green:  '#05c490',
  blue:   '#4ab8e0',
  wild:   '#111318',
};

const LABEL_MAP = {
  skip:    '⊘',
  reverse: '⇄',
  draw2:   '+2',
  wild:    'WILD',
  wild4:   'WILD\n+4',
};

export function UnoCard({ card, onClick, selected, disabled, small }) {
  const color   = COLOR_MAP[card.color] || '#888';
  const label   = LABEL_MAP[card.value] ?? card.value?.toUpperCase();
  const isAction = isNaN(parseInt(card.value));
  const isWild   = card.color === 'wild';

  return (
    <div
      className={`uno-card
        ${selected  ? 'selected'  : ''}
        ${disabled  ? 'disabled'  : ''}
        ${small     ? 'small'     : ''}
        ${isAction  ? 'action'    : ''}
        ${isWild    ? 'wild-card' : ''}`}
      style={{ '--card-color': color }}
      onClick={!disabled ? onClick : undefined}
    >
      {isWild ? (
        <>
          <div className="wild-inner">
            <div className="wild-quadrant q1" />
            <div className="wild-quadrant q2" />
            <div className="wild-quadrant q3" />
            <div className="wild-quadrant q4" />
          </div>
          <div className="wild-oval">
            <div className="wild-oval-shape">
              <div className="wild-center-label">{label}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card-corner top-left">{label}</div>
          <div className="card-inner">
            <div className="card-center">{label}</div>
          </div>
          <div className="card-corner bottom-right">{label}</div>
        </>
      )}
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
