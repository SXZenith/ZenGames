import React from 'react';
import './Card.css';

const COLOR_MAPS = {
  default: { red:'#e63b4f', yellow:'#f0c830', green:'#05c490', blue:'#4ab8e0', wild:'#111318' },
  dark:    { red:'#8b1a26', yellow:'#9c7d0a', green:'#026644', blue:'#1a5f7a', wild:'#0a0c10' },
  neon:    { red:'#ff1744', yellow:'#ffea00', green:'#00e676', blue:'#00b0ff', wild:'#1a1a2e' },
};

const LABEL_MAP = {
  skip:    '⊘',
  reverse: '⇄',
  draw2:   '+2',
  wild:    'WILD',
  wild4:   'WILD\n+4',
};

export function UnoCard({ card, onClick, selected, disabled, small, cardTheme }) {
  const map   = COLOR_MAPS[cardTheme] || COLOR_MAPS.default;
  const color = map[card.color] || '#888';
  const label = LABEL_MAP[card.value] ?? card.value?.toUpperCase();
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

// ── Custom image card backs ──────────────────────────────────────────────────
// To add a custom card back:
//   1. Drop your PNG into client/public/card-backs/   e.g. "flames.png"
//   2. Add an entry below:  flames: '/card-backs/flames.png'
//   3. Add 'flames' to the CUSTOM_BACKS array in Game.jsx customize popup
const CUSTOM_BACK_IMAGES = {
  abstract: '/card-backs/abstract.jpg',
  flow:     '/card-backs/flow.jpg',
  galaxy:   '/card-backs/galaxy.jpg',
  marble:   '/card-backs/marble.jpg',
  kuromi:   '/card-backs/kuromi.jpg',
  otter:   '/card-backs/otter.jpg',
  jack:   '/card-backs/jack skellington.jpg',
  boys:   '/card-backs/the boys.jpg',
  venom:   '/card-backs/venom.jpg',
  sage:   '/card-backs/sage.jpg',
  hero:   '/card-backs/hero.jpg',
  potter:   '/card-backs/potter.jpg',
  dobby:   '/card-backs/dobby.jpg',
};

// CSS-based built-in backs
const CSS_BACKS = new Set(['classic', 'stripes', 'dots', 'stars', 'minimal']);

export function CardBack({ small, cardBack = 'classic' }) {
  const isCSS   = CSS_BACKS.has(cardBack);
  const imgSrc  = CUSTOM_BACK_IMAGES[cardBack];

  if (!isCSS && imgSrc) {
    // Custom image back
    return (
      <div className={`uno-card card-back card-back-custom ${small ? 'small' : ''}`}>
        <img src={imgSrc} alt={cardBack} className="card-back-img"
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
    );
  }

  // Built-in CSS back
  return (
    <div className={`uno-card card-back card-back-${cardBack} ${small ? 'small' : ''}`}>
      <div className="card-inner back-inner">
        {cardBack === 'classic' && <div className="back-logo">UNO</div>}
        {cardBack === 'stripes' && <div className="back-stripes" />}
        {cardBack === 'dots'    && <div className="back-dots" />}
        {cardBack === 'stars'   && <div className="back-stars">{['★','★','★','★','★','★','★','★','★'].map((s,i)=><span key={i}>{s}</span>)}</div>}
        {cardBack === 'minimal' && <div className="back-minimal" />}
      </div>
    </div>
  );
}
