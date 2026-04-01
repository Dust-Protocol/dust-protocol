import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { Card } from '../components/Card';
import { ProcessingSteps } from '../components/ProcessingSteps';
import { Cursor } from '../components/Cursor';
import {
  ETHIcon,
  USDCIcon,
  ShieldIcon,
  SettingsIcon,
  ChevronDownIcon,
  CheckIcon,
  TokenIcon,
} from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, fadeOut, slideUp, typeText, cursorBlink, sceneFade } from '../utils/animations';

function getStepStatus(frame: number, activeAt: number, completedAt: number): 'completed' | 'active' | 'pending' {
  if (frame >= completedAt) return 'completed';
  if (frame >= activeAt) return 'active';
  return 'pending';
}

export const SwapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = sceneFade(frame, 0, 270);

  // Frame 0-15: page fade in, sidebars stagger
  const pageOpacity = fadeIn(frame, 0, 15);
  const leftSidebarOpacity = fadeIn(frame, 6, 12);
  const leftSidebarY = slideUp(frame, 6, 15, 12);
  const rightSidebarOpacity = fadeIn(frame, 10, 12);
  const rightSidebarY = slideUp(frame, 10, 15, 12);

  // Frame 15-25: swap card content appears
  const cardContentOpacity = fadeIn(frame, 15, 10);

  // Frame 25-50: cursor types "1.000" in FROM input
  const amountText = typeText('1.000', frame, 25, 0.5);
  const showInputCursor = frame >= 25 && frame < 55 && cursorBlink(frame, fps);

  // Frame 50-65: TO output shows spinner then value, price info slides in
  const showSpinner = frame >= 50 && frame < 53;
  const toAmountOpacity = fadeIn(frame, 53, 8);
  const priceInfoOpacity = fadeIn(frame, 58, 12);
  const priceInfoY = slideUp(frame, 58, 15, 12);

  // Frame 65-85: denom privacy fades in, toggle animates ON
  const denomOpacity = fadeIn(frame, 65, 12);
  const denomY = slideUp(frame, 65, 15, 12);
  const toggleProgress = interpolate(frame, [70, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Frame 85-100: cursor moves to button and clicks
  const isClicking = frame >= 95 && frame <= 98;

  // Frame 100-110: button text changes to "Processing..."
  const showButton = frame < 110;
  const buttonLabel = frame >= 100 && frame < 110 ? 'Processing...' : 'Swap (3 chunks)';

  // Frame 110-220: processing steps
  const showProcessing = frame >= 110 && frame < 220;
  const processingSteps = [
    { label: 'Generating ZK proof', status: getStepStatus(frame, 110, 132) },
    { label: 'Withdrawing from pool', status: getStepStatus(frame, 132, 154) },
    { label: 'Swapping ETH \u2192 USDC', status: getStepStatus(frame, 154, 176) },
    { label: 'Depositing to pool', status: getStepStatus(frame, 176, 198) },
    { label: 'Confirming on chain', status: getStepStatus(frame, 198, 216) },
  ];
  const chunkProgress = interpolate(frame, [110, 216], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentChunk = frame < 145 ? 1 : frame < 180 ? 2 : 3;

  // Frame 220-250: success state
  const showSuccess = frame >= 220 && frame < 250;
  const successOpacity = fadeIn(frame, 220, 10);
  const successScale = spring({
    frame: Math.max(0, frame - 220),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });

  // Frame 250-270: fade out
  const fadeOutOp = frame >= 250 ? fadeOut(frame, 250, 20) : 1;

  // Cursor keyframes
  const cursorPositions = [
    { x: 820, y: 390, frame: 20 },
    { x: 820, y: 390, frame: 25 },
    { x: 820, y: 750, frame: 85 },
    { x: 820, y: 750, frame: 95 },
  ];

  const showSwapUI = !showSuccess;

  return (
    <Background>
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity }}>
        <Navbar activeRoute="/swap" walletConnected />

        <div
          style={{
            opacity: pageOpacity * fadeOutOp,
            padding: '32px 24px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '0.1em', color: COLORS.white, fontFamily: FONTS.mono }}>
              STEALTH_SWAP
            </span>
            <span style={{ fontSize: 14, color: COLORS.white40, fontFamily: FONTS.mono, letterSpacing: '0.025em' }}>
              Private, slippage-free token swaps via ZK proofs
            </span>
          </div>

          {/* Three-column layout */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', justifyContent: 'center', width: '100%', maxWidth: 1100 }}>

            {/* LEFT SIDEBAR — PoolStats */}
            <div
              style={{
                width: 180,
                opacity: leftSidebarOpacity,
                transform: `translateY(${leftSidebarY}px)`,
                padding: 12,
                backgroundColor: COLORS.bgCard,
                border: `1px solid ${COLORS.borderDefault}`,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* TVL */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.white40} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                    TVL
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>$8,541</span>
              </div>

              <div style={{ height: 1, backgroundColor: COLORS.white04 }} />

              {/* Shielded bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldIcon size={14} color={COLORS.white40} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                    Shielded
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: '65%', height: '100%', backgroundColor: COLORS.neonGreen, opacity: 0.6 }} />
                  <div style={{ width: '35%', height: '100%', backgroundColor: COLORS.white20 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ETHIcon size={11} /> 3.00
                  </span>
                  <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <USDCIcon size={11} /> 1200
                  </span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: FONTS.mono }}>12 notes</span>
              </div>

              <div style={{ height: 1, backgroundColor: COLORS.white04 }} />

              {/* Oracle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.white40} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                    Oracle
                  </span>
                  <div
                    style={{
                      padding: '1px 4px',
                      backgroundColor: 'rgba(0,255,65,0.08)',
                      borderRadius: 2,
                    }}
                  >
                    <span style={{ fontSize: 8, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>CHAINLINK</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
                  <span style={{ color: COLORS.white50 }}>1</span>
                  <ETHIcon size={12} />
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>=</span>
                  <span>2,847</span>
                  <USDCIcon size={12} />
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: COLORS.white04 }} />

              {/* Pool Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.white40} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                    Pool Info
                  </span>
                </div>
                {([
                  ['DEX', 'PunchSwap V2'],
                  ['Pair', 'FLOW/USDC'],
                  ['Relayer', '2%'],
                  ['Proof', 'FFLONK'],
                  ['Tree', 'depth 20'],
                ] as const).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: FONTS.mono }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.mono }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CENTER CARD — SwapV2Card */}
            <Card
              borderColor={COLORS.borderDefault}
              padding={0}
              style={{
                flex: 1,
                maxWidth: 620,
                opacity: cardContentOpacity,
              }}
            >
              <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: COLORS.white, fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                    PRIVACY_SWAP
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <SettingsIcon size={12} color={COLORS.white50} />
                      <span style={{ fontSize: 10, color: COLORS.white50, fontFamily: FONTS.mono }}>0.5%</span>
                    </div>
                  </div>
                </div>

                {/* Compliance badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,100,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span style={{ fontSize: 12, color: 'rgba(0,255,100,0.6)', fontFamily: FONTS.mono }}>Compliant</span>
                </div>

                {/* Privacy keys active badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: COLORS.neonGreen }} />
                  <span style={{ fontSize: 10, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>Privacy keys active</span>
                </div>

                {showSwapUI && (
                  <>
                    {/* FROM */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>FROM</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: FONTS.mono }}>
                          Balance: <span style={{ color: 'rgba(255,255,255,0.6)' }}>3.0000</span> FLOW
                        </span>
                      </div>
                      <div
                        style={{
                          borderRadius: 2,
                          padding: 14,
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${frame >= 25 && frame < 55 ? 'rgba(0,255,65,0.3)' : COLORS.borderDefault}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Token selector button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              borderRadius: 2,
                              backgroundColor: COLORS.white04,
                              border: '1px solid rgba(255,255,255,0.08)',
                              flexShrink: 0,
                            }}
                          >
                            <ETHIcon size={24} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>FLOW</span>
                            <ChevronDownIcon size={12} color="rgba(255,255,255,0.35)" />
                          </div>
                          {/* Amount */}
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
                              {amountText || '\u00A0'}
                              {showInputCursor && <span style={{ color: COLORS.neonGreen }}>|</span>}
                            </span>
                          </div>
                        </div>
                        {/* Percentage pills */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          {['25%', '50%', '75%', 'MAX'].map((pct) => (
                            <div
                              key={pct}
                              style={{
                                flex: 1,
                                padding: '5px 8px',
                                backgroundColor: 'rgba(0,255,65,0.06)',
                                border: '1px solid rgba(0,255,65,0.12)',
                                borderRadius: 2,
                                textAlign: 'center',
                              }}
                            >
                              <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>{pct}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Swap direction arrow */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 0 10px' }}>
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 2,
                          backgroundColor: COLORS.bg,
                          border: '1px solid rgba(0,255,65,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.neonGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <polyline points="19 12 12 19 5 12" />
                        </svg>
                      </div>
                    </div>

                    {/* TO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <span style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' }}>
                        TO (STEALTH)
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 14,
                          borderRadius: 2,
                          border: `1px solid ${COLORS.borderDefault}`,
                          backgroundColor: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <USDCIcon size={28} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>USDC</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {showSpinner && (
                              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${COLORS.neonGreen}`, borderTopColor: 'transparent' }} />
                            )}
                            {/* Output amount */}
                            <span
                              style={{
                                fontSize: 24,
                                fontWeight: 700,
                                fontFamily: FONTS.mono,
                                lineHeight: 1,
                                color: frame >= 53 ? COLORS.neonGreen : 'rgba(255,255,255,0.12)',
                                opacity: frame >= 53 ? toAmountOpacity : 1,
                              }}
                            >
                              {frame >= 53 ? '2,847.50' : '\u2014'}
                            </span>
                          </div>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: FONTS.mono, marginTop: 4 }}>
                            {frame >= 53 ? 'Estimated output' : 'Enter amount above'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Denomination Privacy */}
                    {frame >= 65 && (
                      <div
                        style={{
                          opacity: denomOpacity,
                          transform: `translateY(${denomY}px)`,
                          marginTop: 16,
                          padding: 12,
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${COLORS.borderDefault}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShieldIcon size={12} color={toggleProgress > 0.5 ? COLORS.neonGreen : 'rgba(255,255,255,0.35)'} />
                            <span style={{ fontSize: 10, color: COLORS.white50, fontFamily: FONTS.mono, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                              DENOM_PRIVACY
                            </span>
                          </div>
                          {/* Toggle */}
                          <div
                            style={{
                              width: 32,
                              height: 16,
                              borderRadius: 8,
                              position: 'relative',
                              backgroundColor: toggleProgress > 0.5 ? 'rgba(0,255,65,0.25)' : 'rgba(255,255,255,0.08)',
                              border: `1px solid ${toggleProgress > 0.5 ? 'rgba(0,255,65,0.4)' : 'rgba(255,255,255,0.12)'}`,
                            }}
                          >
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: toggleProgress > 0.5 ? COLORS.neonGreen : 'rgba(255,255,255,0.4)',
                                position: 'absolute',
                                top: 1,
                                left: interpolate(toggleProgress, [0, 1], [2, 17], {
                                  extrapolateLeft: 'clamp',
                                  extrapolateRight: 'clamp',
                                }),
                              }}
                            />
                          </div>
                        </div>
                        {/* Chunk pills */}
                        {toggleProgress > 0.5 && (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {['1.0', '1.0', '0.847'].map((chunk, i) => (
                                <div
                                  key={i}
                                  style={{
                                    padding: '2px 8px',
                                    backgroundColor: 'rgba(0,255,65,0.06)',
                                    border: '1px solid rgba(0,255,65,0.12)',
                                    borderRadius: 2,
                                  }}
                                >
                                  <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>{chunk} FLOW</span>
                                </div>
                              ))}
                            </div>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono, lineHeight: 1.5 }}>
                              Splits into 3 common-sized chunks to hide your exact amount.
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Price info */}
                    {frame >= 58 && (
                      <div
                        style={{
                          opacity: priceInfoOpacity,
                          transform: `translateY(${priceInfoY}px)`,
                          marginTop: 16,
                          padding: 12,
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${COLORS.borderDefault}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {([
                          { label: 'RATE', value: '1 FLOW \u2248 2,847.50 USDC', color: COLORS.white70 },
                          { label: 'SLIPPAGE', value: '0.5%', color: COLORS.white70 },
                          { label: 'RELAYER_FEE', value: '2%', color: COLORS.white70 },
                          { label: 'MIN_RECEIVED', value: '2,789.55 USDC', color: COLORS.white70 },
                        ] as const).map(({ label, value, color }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: FONTS.mono }}>{label}</span>
                            <span style={{ fontSize: 11, color, fontFamily: FONTS.mono }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Swap button */}
                    {showButton && frame >= 65 && (
                      <div
                        style={{
                          marginTop: 20,
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'rgba(0,255,65,0.1)',
                          border: '1px solid rgba(0,255,65,0.2)',
                          borderRadius: 2,
                          textAlign: 'center',
                          transform: isClicking ? 'scale(0.97)' : 'scale(1)',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono, letterSpacing: '0.05em' }}>
                          {buttonLabel}
                        </span>
                      </div>
                    )}

                    {/* Processing steps */}
                    {showProcessing && (
                      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.white10, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${chunkProgress * 100}%`,
                                height: '100%',
                                backgroundColor: COLORS.neonGreen,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, minWidth: 24 }}>
                            {currentChunk}/3
                          </span>
                        </div>
                        <ProcessingSteps steps={processingSteps} title="Swap in progress" />
                      </div>
                    )}
                  </>
                )}

                {/* Success state */}
                {showSuccess && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      padding: 16,
                      opacity: successOpacity,
                      transform: `scale(${successScale})`,
                      backgroundColor: 'rgba(34,197,94,0.06)',
                      border: '1px solid rgba(34,197,94,0.15)',
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', fontFamily: FONTS.mono }}>
                        SWAP_COMPLETE
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.white50, fontFamily: FONTS.mono }}>
                      Received 2,847.50 USDC as shielded UTXOs
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                        View transaction: 0x7a3f...8b2e
                      </span>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={COLORS.neonGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* RIGHT SIDEBAR — PoolComposition */}
            <div
              style={{
                width: 180,
                opacity: rightSidebarOpacity,
                transform: `translateY(${rightSidebarY}px)`,
                padding: 12,
                backgroundColor: COLORS.bgCard,
                border: `1px solid ${COLORS.borderDefault}`,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: COLORS.neonGreen }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                  PunchSwap Pool
                </span>
              </div>

              {/* Vertical bar */}
              <div
                style={{
                  width: 28,
                  flex: 1,
                  minHeight: 100,
                  borderRadius: 99,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignSelf: 'center',
                }}
              >
                <div style={{ height: '60%', backgroundColor: COLORS.neonGreen, opacity: 0.6 }} />
                <div style={{ height: 2, backgroundColor: COLORS.bg, flexShrink: 0 }} />
                <div style={{ height: '40%', backgroundColor: COLORS.white20 }} />
              </div>

              {/* Labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 2, backgroundColor: COLORS.neonGreen, opacity: 0.6, flexShrink: 0 }} />
                  <ETHIcon size={14} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>3.00</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 2, backgroundColor: COLORS.white20, flexShrink: 0 }} />
                  <USDCIcon size={14} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>1,200</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Cursor frame={frame} positions={cursorPositions} clicking={isClicking} />
      </div>
    </Background>
  );
};
