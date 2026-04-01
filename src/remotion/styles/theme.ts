export const COLORS = {
  bg: '#06080F',
  bgCard: 'rgba(255,255,255,0.02)',
  bgCardHover: 'rgba(255,255,255,0.04)',
  neonGreen: '#00FF41',
  neonGreenDim: 'rgba(0,255,65,0.12)',
  neonGreenGlow: 'rgba(0,255,65,0.2)',
  neonGreenBorder: 'rgba(0,255,65,0.15)',
  neonGreenBg: 'rgba(0,255,65,0.06)',
  neonGreenBgMed: 'rgba(0,255,65,0.08)',
  amber: '#FFB000',
  amberDim: 'rgba(245,158,11,0.06)',
  amberBorder: 'rgba(245,158,11,0.15)',
  purple: '#7c7fff',
  purpleDim: 'rgba(124,127,255,0.06)',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.1)',
  successGreen: '#22C55E',
  white: '#ffffff',
  white90: 'rgba(255,255,255,0.9)',
  white70: 'rgba(255,255,255,0.7)',
  white50: 'rgba(255,255,255,0.5)',
  white40: 'rgba(255,255,255,0.4)',
  white20: 'rgba(255,255,255,0.2)',
  white10: 'rgba(255,255,255,0.1)',
  white06: 'rgba(255,255,255,0.06)',
  white04: 'rgba(255,255,255,0.04)',
  white03: 'rgba(255,255,255,0.03)',
  borderDefault: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,255,65,0.3)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  baseBluePrimary: '#0052FF',
  baseBlueLight: '#3B7AFF',
} as const;

export const FONTS = {
  mono: 'JetBrains Mono, Menlo, Monaco, monospace',
  serif: 'Instrument Serif, Georgia, serif',
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInSeconds: 60,
  get durationInFrames() {
    return this.fps * this.durationInSeconds;
  },
} as const;

export const SCENES = {
  intro:          { start: 0,    duration: 90  },  // 0–3s
  landing:        { start: 90,   duration: 180 },  // 3–9s   (Landing + Privy Connect)
  onboarding:     { start: 270,  duration: 210 },  // 9–16s  (Username + PIN wizard)
  dashboard:      { start: 480,  duration: 150 },  // 16–21s
  receive:        { start: 630,  duration: 90  },  // 21–24s
  senderPays:     { start: 720,  duration: 180 },  // 24–30s (Sender visits /pay/alice)
  paymentArrives: { start: 900,  duration: 180 },  // 30–36s (Dashboard + system design)
  send:           { start: 1080, duration: 210 },  // 36–43s (Send with chunk division)
  customLink:     { start: 1290, duration: 150 },  // 43–48s (Custom payment link)
  swap:           { start: 1440, duration: 270 },  // 48–57s
  activity:       { start: 1710, duration: 90  },  // 57–60s
} as const;

export type SceneName = keyof typeof SCENES;
