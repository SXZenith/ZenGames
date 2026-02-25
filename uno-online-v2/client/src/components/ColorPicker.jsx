import React from 'react';
import './ColorPicker.css';

const COLORS = [
  { key: 'red', label: 'Red', color: '#ff3b52' },
  { key: 'yellow', label: 'Yellow', color: '#ffd93d' },
  { key: 'green', label: 'Green', color: '#06d6a0' },
  { key: 'blue', label: 'Blue', color: '#4cc9f0' },
];

export default function ColorPicker({ onChoose }) {
  return (
    <div className="color-picker-overlay">
      <div className="color-picker-modal">
        <h3>Choose a color</h3>
        <div className="color-options">
          {COLORS.map(c => (
            <button
              key={c.key}
              className="color-btn"
              style={{ '--c': c.color }}
              onClick={() => onChoose(c.key)}
            >
              <div className="color-swatch" />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
