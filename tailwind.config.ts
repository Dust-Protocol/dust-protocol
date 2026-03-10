import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-page': '#06080F',
        'green-neon': '#00FF41',
        'amber-neon': '#FFB000',
        dust: {
          bg: '#06080F',
          green: '#00FF41',
          amber: '#FFB000',
          text: 'rgba(255,255,255,0.9)',
          muted: 'rgba(255,255,255,0.4)',
          border: 'rgba(255,255,255,0.06)',
          'border-active': 'rgba(0,255,65,0.15)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(0,255,65,0.2)',
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-pattern': '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
