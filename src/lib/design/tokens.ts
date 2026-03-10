// Design tokens — Premium dark theme with Dust Protocol identity
// Typography: Space Grotesk (headings) + Plus Jakarta Sans (body) + JetBrains Mono (code)

// ─── Color System ────────────────────────────────────────────────────────────

export interface ColorTokens {
  bg: {
    page: string;
    card: string;
    cardSolid: string;
    input: string;
    elevated: string;
    hover: string;
    overlay: string;
  };
  border: {
    default: string;
    light: string;
    accent: string;
    accentGreen: string;
    focus: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    muted: string;
    inverse: string;
  };
  accent: {
    indigo: string;
    indigoBright: string;
    indigoDark: string;
    violet: string;
    violetBright: string;
    green: string;
    greenBright: string;
    greenDark: string;
    red: string;
    redDark: string;
    amber: string;
    cyan: string;
  };
  glow: {
    indigo: string;
    green: string;
    violet: string;
    red: string;
  };
}

export interface RadiusTokens {
  xl: string;
  lg: string;
  md: string;
  sm: string;
  xs: string;
  full: string;
}

export const colors: ColorTokens = {
  bg: {
    page: "#06080F",
    card: "rgba(255,255,255,0.03)",
    cardSolid: "#0D0F17",
    input: "rgba(255,255,255,0.04)",
    elevated: "rgba(255,255,255,0.06)",
    hover: "rgba(255,255,255,0.08)",
    overlay: "rgba(6,8,15,0.85)",
  },
  border: {
    default: "rgba(255,255,255,0.08)",
    light: "rgba(255,255,255,0.05)",
    accent: "rgba(0,255,65,0.35)",
    accentGreen: "rgba(34,197,94,0.35)",
    focus: "rgba(0,255,65,0.5)",
  },
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.65)",
    tertiary: "rgba(255,255,255,0.45)",
    muted: "rgba(255,255,255,0.30)",
    inverse: "#06080F",
  },
  accent: {
    indigo: "#00FF41",
    indigoBright: "#6B8EFF",
    indigoDark: "#00FF41",
    violet: "#633CFF",
    violetBright: "#8B6FFF",
    green: "#22C55E",
    greenBright: "#34D66F",
    greenDark: "#16A34A",
    red: "#EF4444",
    redDark: "#DC2626",
    amber: "#F59E0B",
    cyan: "#22D3EE",
  },
  glow: {
    indigo: "0 0 20px rgba(0,255,65,0.15), 0 0 40px rgba(0,255,65,0.05)",
    green: "0 0 20px rgba(34,197,94,0.15), 0 0 40px rgba(34,197,94,0.05)",
    violet: "0 0 20px rgba(99,60,255,0.15), 0 0 40px rgba(99,60,255,0.05)",
    red: "0 0 20px rgba(239,68,68,0.15), 0 0 40px rgba(239,68,68,0.05)",
  },
};

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius: RadiusTokens = {
  xl: "24px",
  lg: "20px",
  md: "16px",
  sm: "12px",
  xs: "8px",
  full: "9999px",
};

// ─── Elevation / Shadows ─────────────────────────────────────────────────────

export const shadows = {
  // Subtle depth
  card: "0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
  cardHover:
    "0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)",
  // Modals / overlays
  modal:
    "0 24px 64px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
  // Buttons
  button: "0 1px 3px rgba(0,0,0,0.25)",
  buttonPrimary:
    "0 2px 8px rgba(0,255,65,0.3), 0 0 20px rgba(0,255,65,0.1)",
  buttonPrimaryHover:
    "0 4px 16px rgba(0,255,65,0.4), 0 0 40px rgba(0,255,65,0.15)",
  // Focus ring
  focusRing:
    "0 0 0 3px rgba(0,255,65,0.15), 0 0 20px rgba(0,255,65,0.08)",
  // Inner glow for inputs
  inputFocus:
    "inset 0 0 0 1px rgba(0,255,65,0.3), 0 0 0 3px rgba(0,255,65,0.1)",
};

// ─── Glass Morphism Presets ──────────────────────────────────────────────────

export const glass = {
  card: {
    bg: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(16px)",
  },
  cardHover: {
    bg: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  input: {
    bg: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
  },
  modal: {
    bg: "rgba(13,15,23,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(24px)",
  },
};

// ─── Button Variants ─────────────────────────────────────────────────────────

export const buttonVariants = {
  primary: {
    bg: "linear-gradient(135deg, #00FF41 0%, #00FF41 50%, #00FF41 100%)",
    color: "#06080F",
    border: "none",
    boxShadow: shadows.buttonPrimary,
    hover: {
      boxShadow: shadows.buttonPrimaryHover,
      transform: "translateY(-1px)",
    },
    active: {
      transform: "translateY(0)",
      filter: "brightness(0.95)",
    },
  },
  secondary: {
    bg: "rgba(255,255,255,0.05)",
    color: colors.text.primary,
    border: `1px solid rgba(255,255,255,0.1)`,
    hover: {
      bg: "rgba(255,255,255,0.08)",
      borderColor: "rgba(255,255,255,0.15)",
    },
    active: {
      bg: "rgba(255,255,255,0.06)",
    },
  },
  ghost: {
    bg: "transparent",
    color: colors.text.secondary,
    border: "none",
    hover: {
      bg: "rgba(255,255,255,0.06)",
      color: colors.text.primary,
    },
    active: {
      bg: "rgba(255,255,255,0.04)",
    },
  },
  danger: {
    bg: "rgba(239,68,68,0.1)",
    color: colors.accent.red,
    border: `1px solid rgba(239,68,68,0.2)`,
    hover: {
      bg: "rgba(239,68,68,0.15)",
      borderColor: "rgba(239,68,68,0.3)",
    },
    active: {
      bg: "rgba(239,68,68,0.12)",
    },
  },
  success: {
    bg: "rgba(34,197,94,0.1)",
    color: colors.accent.green,
    border: `1px solid rgba(34,197,94,0.2)`,
    hover: {
      bg: "rgba(34,197,94,0.15)",
      borderColor: "rgba(34,197,94,0.3)",
    },
    active: {
      bg: "rgba(34,197,94,0.12)",
    },
  },
};

// ─── Input States ────────────────────────────────────────────────────────────

export const inputStates = {
  default: {
    bg: colors.bg.input,
    border: `1px solid ${colors.border.default}`,
    color: colors.text.primary,
    placeholder: colors.text.muted,
  },
  focus: {
    borderColor: colors.border.focus,
    boxShadow: shadows.inputFocus,
    bg: "rgba(255,255,255,0.05)",
  },
  error: {
    borderColor: "rgba(239,68,68,0.5)",
    boxShadow: "0 0 0 3px rgba(239,68,68,0.1)",
  },
  disabled: {
    bg: "rgba(255,255,255,0.02)",
    color: colors.text.muted,
    cursor: "not-allowed",
    opacity: 0.6,
  },
};

// ─── Typography Scale ────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    heading: "var(--font-instrument-serif), 'Instrument Serif', serif",
    body: "'Plus Jakarta Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  heading: {
    h1: { fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: "1.15" },
    h2: { fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "1.2" },
    h3: { fontSize: "20px", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: "1.3" },
    h4: { fontSize: "16px", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: "1.4" },
  },
  body: {
    lg: { fontSize: "16px", fontWeight: 400, lineHeight: "1.6" },
    md: { fontSize: "14px", fontWeight: 400, lineHeight: "1.5" },
    sm: { fontSize: "13px", fontWeight: 400, lineHeight: "1.5" },
    xs: { fontSize: "12px", fontWeight: 400, lineHeight: "1.4" },
  },
  label: {
    lg: { fontSize: "14px", fontWeight: 600, letterSpacing: "0.01em" },
    md: { fontSize: "13px", fontWeight: 600, letterSpacing: "0.01em" },
    sm: { fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const },
  },
};

// ─── Transitions ─────────────────────────────────────────────────────────────

export const transitions = {
  fast: "all 0.15s ease",
  base: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
  smooth: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  spring: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// ─── Card Accents (for link/payment cards) ───────────────────────────────────

export const cardAccents = [
  "#00FF41", // indigo
  "#7C3AED", // violet
  "#059669", // emerald
  "#E53E3E", // red
  "#D97706", // amber
  "#0891B2", // cyan
  "#DB2777", // pink
  "#00FF41", // deep indigo
];

// ─── Chain-aware utilities (from config) ─────────────────────────────────────

import { getChainConfig, DEFAULT_CHAIN_ID, getMinClaimableBalance } from '@/config/chains';

export { getMinClaimableBalance };

/** Chain-aware explorer URL */
export function getExplorerBase(chainId?: number): string {
  return getChainConfig(chainId ?? DEFAULT_CHAIN_ID).blockExplorerUrl;
}
