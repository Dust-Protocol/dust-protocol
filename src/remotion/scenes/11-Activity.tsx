import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowDownLeftIcon, SendIcon, TokenIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, fadeOut, slideUp, staggerDelay, sceneFade } from '../utils/animations';

interface ActivityRow {
  direction: 'in' | 'out';
  label: string;
  subDetail: string;
  amount: string;
  symbol: string;
}

const ACTIVITIES: ActivityRow[] = [
  { direction: 'in', label: 'Received from 0x8d56...3496', subDetail: 'ETH \u00B7 Block #12,847,293', amount: '+0.5000', symbol: 'ETH' },
  { direction: 'out', label: 'Sent to alice.dust', subDetail: 'ETH \u00B7 2:34 PM', amount: '-0.5000', symbol: 'ETH' },
  { direction: 'in', label: 'Received from 0xabcd...ef01', subDetail: 'ETH \u00B7 Block #12,847,104', amount: '+0.0100', symbol: 'ETH' },
  { direction: 'out', label: 'Sent to 0x742d...2bD6', subDetail: 'ETH \u00B7 1:12 PM', amount: '-1.0000', symbol: 'ETH' },
  { direction: 'in', label: 'Received from 0x1f3a...7c02', subDetail: 'ETH \u00B7 Block #12,846,991', amount: '+1.0000', symbol: 'ETH' },
];

const FILTER_TABS = ['all', 'incoming', 'outgoing'] as const;

export const ActivityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = sceneFade(frame, 0, 90, 12);

  const headerOpacity = fadeIn(frame, 0, 10);
  const headerY = slideUp(frame, 0, 20, 10);

  const controlsOpacity = fadeIn(frame, 4, 10);
  const controlsY = slideUp(frame, 4, 15, 10);

  const bannerOpacity = fadeIn(frame, 8, 10);
  const bannerY = slideUp(frame, 8, 15, 10);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <Background>
        <Navbar activeRoute="/activities" walletConnected />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 32px 32px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 780, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page title — matches ActivityList h1 */}
            <h1
              style={{
                opacity: headerOpacity,
                transform: `translateY(${headerY}px)`,
                fontSize: 28,
                fontWeight: 700,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.92)',
                fontFamily: FONTS.mono,
                margin: 0,
              }}
            >
              Activities
            </h1>

            {/* Controls row — filter tabs left, export+scan right */}
            <div
              style={{
                opacity: controlsOpacity,
                transform: `translateY(${controlsY}px)`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {/* Filter tabs — rounded-sm, active=solid green */}
              <div style={{ display: 'flex', gap: 8 }}>
                {FILTER_TABS.map((tab) => {
                  const isActive = tab === 'all';
                  return (
                    <div
                      key={tab}
                      style={{
                        padding: '8px 16px',
                        fontSize: 11,
                        fontWeight: isActive ? 700 : 400,
                        fontFamily: FONTS.mono,
                        borderRadius: 2,
                        letterSpacing: '0.08em',
                        textTransform: 'capitalize',
                        backgroundColor: isActive ? COLORS.neonGreen : 'transparent',
                        border: isActive ? 'none' : `1px solid rgba(255,255,255,0.08)`,
                        color: isActive ? '#000000' : 'rgba(255,255,255,0.30)',
                      }}
                    >
                      {tab}
                    </div>
                  );
                })}
              </div>

              {/* Export CSV + Scan buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11,
                    fontFamily: FONTS.mono,
                    color: 'rgba(255,255,255,0.50)',
                  }}
                >
                  <FileTextIcon size={14} color="rgba(255,255,255,0.30)" />
                  Export CSV
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <RefreshIcon size={16} color="rgba(255,255,255,0.30)" />
                </div>
              </div>
            </div>

            {/* Sponsored gas banner */}
            <div
              style={{
                opacity: bannerOpacity,
                transform: `translateY(${bannerY}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                backgroundColor: 'rgba(0,255,65,0.04)',
                borderRadius: 2,
                border: '1px solid rgba(0,255,65,0.1)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  backgroundColor: 'rgba(0,255,65,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ZapIcon size={16} color={COLORS.neonGreen} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                  Auto-Claim Enabled
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', fontFamily: FONTS.mono }}>
                  Payments are automatically claimed to your wallet. Gas is sponsored by Dust.
                </span>
              </div>
            </div>

            {/* Activity rows — separate bordered cards with gap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIVITIES.map((activity, i) => {
                const rowStart = staggerDelay(i, 10, 4);
                const rowOpacity = fadeIn(frame, rowStart, 10);
                const rowY = slideUp(frame, rowStart, 15, 10);
                const isIn = activity.direction === 'in';

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 2,
                      opacity: rowOpacity,
                      transform: `translateY(${rowY}px)`,
                    }}
                  >
                    {/* Left: icon + labels */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* 42x42 square icon container */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          backgroundColor: isIn ? 'rgba(0,255,65,0.08)' : 'rgba(229,62,62,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isIn ? (
                          <ArrowDownLeftIcon size={20} color={COLORS.neonGreen} />
                        ) : (
                          <SendIcon size={20} color={COLORS.red} />
                        )}
                      </div>

                      {/* Label + sub-detail */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.92)',
                          }}
                        >
                          {activity.label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.30)',
                            fontFamily: FONTS.mono,
                          }}
                        >
                          {activity.subDetail}
                        </span>
                      </div>
                    </div>

                    {/* Right: amount */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: isIn ? COLORS.neonGreen : COLORS.red,
                          fontFamily: FONTS.mono,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {activity.amount} <TokenIcon symbol={activity.symbol} size={14} /> {activity.symbol}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};

const ZapIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const FileTextIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RefreshIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
