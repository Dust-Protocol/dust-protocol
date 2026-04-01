import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../styles/theme';

export const Background: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        color: COLORS.white,
        overflow: 'hidden',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.white03} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.white03} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.5,
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '30%',
          width: '40%',
          height: '60%',
          background: `radial-gradient(ellipse, ${COLORS.neonGreenGlow} 0%, transparent 70%)`,
          opacity: 0.15,
          filter: 'blur(60px)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
