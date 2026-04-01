import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { DustLogo } from '../components/Logo';
import { BaseIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { typeText, pulseGlow, sceneFade } from '../utils/animations';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = sceneFade(frame, 0, 90);

  // Frame 0-40: Logo scales in from 0 to 1
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });

  // Frame 40-80: Subtitle types in character by character
  const subtitle = typeText('Privacy Infrastructure for Base', frame, 40, 0.5);

  // Frame 60-90: Base chain logo fades in
  const baseLogoOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Frame 80-120: Neon green glow pulse on logo
  const glowIntensity = frame >= 80 ? pulseGlow(frame, fps, 1) : 0;

  return (
    <Background>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: sceneOpacity,
        }}
      >
        {/* Logo with glow */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            filter: `drop-shadow(0 0 ${glowIntensity * 40}px ${COLORS.neonGreen})`,
          }}
        >
          <DustLogo size={64} showText textSize={32} />
        </div>

        {/* Subtitle: types in */}
        <div
          style={{
            marginTop: 32,
            fontSize: 24,
            fontFamily: FONTS.mono,
            color: COLORS.white70,
            letterSpacing: '0.15em',
            height: 32,
          }}
        >
          {subtitle}
        </div>

        {/* Base chain logo */}
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: baseLogoOpacity,
          }}
        >
          <BaseIcon size={48} />
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.baseBluePrimary,
              fontFamily: FONTS.mono,
              letterSpacing: '0.1em',
            }}
          >
            BASE
          </span>
        </div>
      </div>
    </Background>
  );
};
