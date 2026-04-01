import React from 'react';
import { COLORS } from '../styles/theme';

interface PinEntryProps {
  digits: number;
  label?: string;
  filledColor?: string;
  showUnlock?: boolean;
  unlocking?: boolean;
}

export const PinEntry: React.FC<PinEntryProps> = ({
  digits,
  label = 'Enter 6-digit PIN',
  filledColor = COLORS.amber,
  showUnlock = true,
  unlocking = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        backgroundColor: COLORS.amberDim,
        border: `1px solid ${COLORS.amberBorder}`,
        borderRadius: 2,
      }}
    >
      {/* Lock icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontSize: 13, color: COLORS.amber, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
          {label}
        </span>
      </div>

      {/* PIN dots row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '8px 16px',
            backgroundColor: COLORS.white04,
            border: `1px solid ${COLORS.white10}`,
            borderRadius: 2,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: i < digits ? filledColor : 'transparent',
                border: i < digits ? 'none' : `1px solid ${COLORS.white20}`,
                margin: '0 2px',
              }}
            />
          ))}
        </div>

        {showUnlock && (
          <div
            style={{
              padding: '8px 14px',
              backgroundColor: digits === 6 ? 'rgba(245,158,11,0.12)' : COLORS.white04,
              border: `1px solid ${digits === 6 ? COLORS.amberBorder : COLORS.white10}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {unlocking && (
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: `2px solid ${COLORS.amber}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                }}
              />
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: digits === 6 ? COLORS.amber : COLORS.white40,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              UNLOCK
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
