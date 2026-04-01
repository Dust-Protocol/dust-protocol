import React from 'react';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, slideUp } from '../utils/animations';
import { CheckIcon } from './Icons';

interface SystemDesignPanelProps {
  frame: number;
  side: 'left' | 'right';
  startFrame?: number;
}

const STEP_STAGGER = 15;
const STEP_ANIM_DURATION = 12;
const CHECK_DELAY = 10;

const LEFT_STEPS = [
  'Sender fetches recipient\u2019s public key',
  'ECDH derives shared secret',
  'Stealth address generated',
  'Funds sent to hidden address',
] as const;

const RIGHT_STEPS = [
  'Scanner detects incoming payment',
  'Spending key derived from PIN',
  'Claim transaction submitted',
  'Funds arrive in wallet',
] as const;

const PANEL_TITLES = {
  left: 'ECDH Key Exchange',
  right: 'Auto-Claim Pipeline',
} as const;

const DownArrow: React.FC = () => (
  <svg width={12} height={18} viewBox="0 0 12 18" fill="none">
    <path
      d="M6 1v14M6 15l-4-4M6 15l4-4"
      stroke={COLORS.white20}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SystemDesignPanel: React.FC<SystemDesignPanelProps> = ({
  frame,
  side,
  startFrame = 0,
}) => {
  const steps = side === 'left' ? LEFT_STEPS : RIGHT_STEPS;
  const title = PANEL_TITLES[side];

  const panelOpacity = fadeIn(frame, startFrame, 10);
  const panelSlide = slideUp(frame, startFrame, 20, 15);

  return (
    <div
      style={{
        width: 300,
        opacity: panelOpacity,
        transform: `translateY(${panelSlide}px)`,
        backgroundColor: 'rgba(6,8,15,0.95)',
        border: `1px solid ${COLORS.borderDefault}`,
        borderRadius: 4,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          fontWeight: 700,
          color: COLORS.neonGreen,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        }}
      >
        {title}
      </span>

      {steps.map((label, i) => {
        const stepStart = startFrame + 8 + i * STEP_STAGGER;
        const stepOpacity = fadeIn(frame, stepStart, STEP_ANIM_DURATION);
        const stepSlide = slideUp(frame, stepStart, 16, STEP_ANIM_DURATION);

        const checkStart = stepStart + CHECK_DELAY;
        const showCheck = frame >= checkStart;

        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={i}>
            <div
              style={{
                opacity: stepOpacity,
                transform: `translateY(${stepSlide}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: COLORS.bgCard,
                borderLeft: `3px solid ${COLORS.neonGreen}`,
                borderRadius: 2,
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showCheck ? (
                  <CheckIcon size={14} color={COLORS.successGreen} />
                ) : (
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 600,
                      color: COLORS.white40,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  fontWeight: 500,
                  color: showCheck ? COLORS.white90 : COLORS.white50,
                  lineHeight: 1.4,
                }}
              >
                {label}
              </span>
            </div>

            {!isLast && (
              <div
                style={{
                  opacity: stepOpacity,
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '2px 0',
                }}
              >
                <DownArrow />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
