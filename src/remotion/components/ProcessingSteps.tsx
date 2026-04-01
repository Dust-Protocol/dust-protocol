import React from 'react';
import { COLORS } from '../styles/theme';

interface Step {
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProcessingStepsProps {
  steps: Step[];
  title?: string;
}

export const ProcessingSteps: React.FC<ProcessingStepsProps> = ({ steps, title }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        backgroundColor: COLORS.neonGreenBg,
        border: `1px solid ${COLORS.neonGreenBorder}`,
        borderRadius: 2,
      }}
    >
      {title && (
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const }}>
          {title}
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Status icon */}
            {step.status === 'completed' && (
              <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: COLORS.successGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            )}
            {step.status === 'active' && (
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${COLORS.neonGreen}`, borderTopColor: 'transparent' }} />
            )}
            {step.status === 'pending' && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS.white20, marginLeft: 5, marginRight: 5 }} />
            )}
            <span
              style={{
                fontSize: 13,
                fontWeight: step.status === 'active' ? 700 : 400,
                color: step.status === 'completed' ? COLORS.successGreen : step.status === 'active' ? COLORS.white : COLORS.white30 || COLORS.white20,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
