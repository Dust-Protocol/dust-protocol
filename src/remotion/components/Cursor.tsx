import React from 'react';
import { interpolate, Easing } from 'remotion';

interface CursorProps {
  frame: number;
  positions: Array<{ x: number; y: number; frame: number }>;
  clicking?: boolean;
}

export const Cursor: React.FC<CursorProps> = ({ frame, positions, clicking = false }) => {
  if (positions.length === 0) return null;

  let x = positions[0].x;
  let y = positions[0].y;

  for (let i = 0; i < positions.length - 1; i++) {
    const curr = positions[i];
    const next = positions[i + 1];
    if (frame >= curr.frame && frame <= next.frame) {
      const duration = next.frame - curr.frame;
      x = interpolate(frame, [curr.frame, next.frame], [curr.x, next.x], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      });
      y = interpolate(frame, [curr.frame, next.frame], [curr.y, next.y], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      });
      break;
    }
    if (frame > next.frame) {
      x = next.x;
      y = next.y;
    }
  }

  if (frame < positions[0].frame) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 100,
        pointerEvents: 'none',
        transform: clicking ? 'scale(0.85)' : 'scale(1)',
        transition: 'transform 0.05s',
      }}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <path
          d="M5.5 3.5L5.5 18.5L9.5 14.5L13.5 20.5L16 19L12 13L17 13L5.5 3.5Z"
          fill="white"
          stroke="#000"
          strokeWidth="1.5"
        />
      </svg>
      {clicking && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.4)',
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
};
