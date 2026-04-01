import React from 'react';
import { COLORS } from '../styles/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: COLORS.successGreen },
  warning: { bg: COLORS.amberDim, border: COLORS.amberBorder, text: COLORS.amber },
  error: { bg: COLORS.redDim, border: 'rgba(239,68,68,0.3)', text: COLORS.red },
  info: { bg: COLORS.neonGreenBg, border: COLORS.neonGreenBorder, text: COLORS.neonGreen },
  neutral: { bg: COLORS.white04, border: COLORS.white10, text: COLORS.white50 },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  showDot = false,
}) => {
  const styles = VARIANT_STYLES[variant];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 2,
      }}
    >
      {showDot && (
        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: styles.text }} />
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: styles.text, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  );
};
