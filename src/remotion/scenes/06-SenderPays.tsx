import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { CornerAccents } from '../components/CornerAccents';
import { Cursor } from '../components/Cursor';
import { DustLogo } from '../components/Logo';
import { ETHIcon, LockIcon, SendIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, slideUp, typeText, sceneFade } from '../utils/animations';

export const SenderPaysScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = sceneFade(frame, 0, 180);

  // Browser chrome fade in
  const browserOpacity = fadeIn(frame, 0, 20);
  const browserSlide = slideUp(frame, 0, 20, 20);

  // Pay page content
  const contentOpacity = fadeIn(frame, 20, 15);
  const contentSlide = slideUp(frame, 20, 15, 15);

  // Amount typing (frame 40-60)
  const amountText = typeText('0.5', frame, 40, 0.15);
  const amountCursorVisible = frame >= 40 && frame < 65;

  // Preview click (frame 60-63)
  const isClickingPreview = frame >= 60 && frame <= 63;

  // Confirm view (frame 64-84)
  const confirmOpacity = fadeIn(frame, 64, 12);
  const confirmSlide = slideUp(frame, 64, 20, 12);

  // Send click (frame 80-83)
  const isClickingSend = frame >= 80 && frame <= 83;

  // Processing state (frame 84-100)
  const showProcessing = frame >= 84 && frame < 100;
  const spinnerRotation = (frame - 84) * 15;

  // Success state (frame 100+)
  const showSuccess = frame >= 100;
  const successCheckScale = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 8, stiffness: 120, mass: 0.5 },
  });
  const successTextOpacity = fadeIn(frame, 108, 10);
  const successTextSlide = slideUp(frame, 108, 12, 10);

  // Final fade out
  const fadeOutOpacity = frame >= 160
    ? interpolate(frame, [160, 180], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  // Cursor positions
  const cursorPositions = [
    { x: 960, y: 480, frame: 0 },
    { x: 960, y: 510, frame: 38 },
    { x: 960, y: 600, frame: 55 },
    { x: 960, y: 680, frame: 75 },
  ];

  const showForm = frame < 64;
  const showConfirm = frame >= 64 && frame < 84;

  return (
    <Background>
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity * fadeOutOpacity }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Browser chrome mockup */}
          <div
            style={{
              width: 520,
              opacity: browserOpacity,
              transform: `translateY(${browserSlide}px)`,
            }}
          >
            {/* Title bar */}
            <div
              style={{
                height: 40,
                backgroundColor: 'rgba(30,30,38,1)',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                paddingRight: 14,
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#28C840' }} />
              </div>
              <div
                style={{
                  flex: 1,
                  marginLeft: 12,
                  padding: '5px 12px',
                  backgroundColor: 'rgba(15,15,20,0.8)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: COLORS.white50, fontFamily: FONTS.mono }}>
                  dustprotocol.app/pay/alice
                </span>
              </div>
            </div>

            {/* Browser body — matches PayPageClient bg #06080F */}
            <div
              style={{
                backgroundColor: COLORS.bg,
                border: `1px solid ${COLORS.white10}`,
                borderTop: 'none',
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                minHeight: 500,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* ── Header — matches PayPageClient header ── */}
              <div
                style={{
                  borderBottom: `1px solid ${COLORS.white04}`,
                  padding: '14px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <DustLogo size={20} showText={false} />
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: COLORS.white,
                      fontFamily: FONTS.mono,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Dust
                  </span>
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    backgroundColor: COLORS.neonGreenBg,
                    border: `1px solid ${COLORS.neonGreenBorder}`,
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: COLORS.neonGreen,
                      fontFamily: FONTS.mono,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Payment
                  </span>
                </div>
              </div>

              {/* ── Main card area ── */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '24px 32px',
                  opacity: contentOpacity,
                  transform: `translateY(${contentSlide}px)`,
                }}
              >
                <div style={{ width: '100%', maxWidth: 440 }}>
                  {/* Card with corner accents */}
                  <div style={{ position: 'relative' }}>
                    <CornerAccents />

                    <div
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        border: `1px solid ${showSuccess ? 'rgba(34,197,94,0.3)' : COLORS.white10}`,
                        backgroundColor: COLORS.bg,
                        overflow: 'hidden',
                        boxShadow: showSuccess
                          ? '0 0 30px rgba(34,197,94,0.08)'
                          : '0 4px 24px rgba(0,0,0,0.3)',
                      }}
                    >
                      {/* ── Recipient Header ── */}
                      <div
                        style={{
                          padding: '28px 24px 20px',
                          textAlign: 'center' as const,
                          borderBottom: `1px solid ${showSuccess ? 'rgba(34,197,94,0.15)' : COLORS.white06}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 2,
                            backgroundColor: showSuccess
                              ? 'rgba(34,197,94,0.08)'
                              : 'rgba(0,255,65,0.04)',
                          }}
                        >
                          <DustLogo
                            size={28}
                            color={showSuccess ? '#22c55e' : COLORS.neonGreen}
                            showText={false}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              fontFamily: FONTS.mono,
                              letterSpacing: '-0.01em',
                              color: showSuccess ? '#4ade80' : COLORS.neonGreen,
                            }}
                          >
                            alice.dust
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'rgba(255,255,255,0.35)',
                              fontFamily: FONTS.mono,
                            }}
                          >
                            {showSuccess ? 'Private payment completed' : 'Send a private payment'}
                          </span>
                        </div>
                      </div>

                      {/* ── Tab Switcher — only when not success ── */}
                      {!showSuccess && (
                        <div
                          style={{
                            display: 'flex',
                            borderBottom: `1px solid ${COLORS.white06}`,
                          }}
                        >
                          {/* WALLET tab (active) */}
                          <div
                            style={{
                              flex: 1,
                              padding: '12px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              borderBottom: `2px solid ${COLORS.neonGreen}`,
                            }}
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={COLORS.neonGreen} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                              <circle cx="18" cy="12" r="2" />
                            </svg>
                            <span
                              style={{
                                fontSize: 10,
                                color: COLORS.neonGreen,
                                fontFamily: FONTS.mono,
                                letterSpacing: '0.05em',
                              }}
                            >
                              WALLET
                            </span>
                          </div>
                          {/* QR / ADDRESS tab (inactive) */}
                          <div
                            style={{
                              flex: 1,
                              padding: '12px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              borderBottom: '2px solid transparent',
                            }}
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span
                              style={{
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.35)',
                                fontFamily: FONTS.mono,
                                letterSpacing: '0.05em',
                              }}
                            >
                              QR / ADDRESS
                            </span>
                          </div>
                        </div>
                      )}

                      {/* ── Tab Content ── */}
                      <div style={{ padding: 24 }}>

                        {/* ── Input form view ── */}
                        {showForm && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Network selector */}
                            <div>
                              <span
                                style={{
                                  fontSize: 9,
                                  color: 'rgba(255,255,255,0.5)',
                                  fontFamily: FONTS.mono,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '0.05em',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              >
                                Network
                              </span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '10px 12px',
                                  borderRadius: 2,
                                  border: `1px solid ${COLORS.white10}`,
                                  backgroundColor: COLORS.white03,
                                }}
                              >
                                <ETHIcon size={18} />
                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: COLORS.white,
                                    fontFamily: FONTS.mono,
                                  }}
                                >
                                  Ethereum Sepolia
                                </span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono }}>
                                  ETH
                                </span>
                                <svg width={10} height={10} viewBox="0 0 10 10">
                                  <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                                </svg>
                              </div>
                            </div>

                            {/* Amount + Token row */}
                            <div>
                              <span
                                style={{
                                  fontSize: 9,
                                  color: 'rgba(255,255,255,0.5)',
                                  fontFamily: FONTS.mono,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '0.05em',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              >
                                Amount
                              </span>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Amount input */}
                                <div
                                  style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 2,
                                    backgroundColor: COLORS.white03,
                                    border: `1px solid ${frame >= 40 ? COLORS.neonGreen : COLORS.white10}`,
                                    ...(frame >= 40 ? { backgroundColor: 'rgba(0,255,65,0.02)' } : {}),
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 600,
                                      color: amountText ? COLORS.white : 'rgba(255,255,255,0.2)',
                                      fontFamily: FONTS.mono,
                                    }}
                                  >
                                    {amountText || '0.0'}
                                    {amountCursorVisible && (
                                      <span style={{ color: COLORS.neonGreen }}>|</span>
                                    )}
                                  </span>
                                </div>
                                {/* Token selector button */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '10px 10px',
                                    borderRadius: 2,
                                    border: `1px solid ${COLORS.white10}`,
                                    backgroundColor: COLORS.white03,
                                  }}
                                >
                                  <ETHIcon size={14} />
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: COLORS.white,
                                      fontFamily: FONTS.mono,
                                    }}
                                  >
                                    ETH
                                  </span>
                                  <svg width={8} height={8} viewBox="0 0 10 10" style={{ marginLeft: 2 }}>
                                    <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Preview button — matches PayPageClient styling */}
                            <div
                              style={{
                                padding: '12px 0',
                                borderRadius: 2,
                                textAlign: 'center' as const,
                                border: `1px solid ${amountText ? 'rgba(0,255,65,0.2)' : COLORS.white06}`,
                                backgroundColor: amountText ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.02)',
                                transform: isClickingPreview ? 'scale(0.97)' : 'scale(1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: amountText ? COLORS.neonGreen : 'rgba(255,255,255,0.3)',
                                  fontFamily: FONTS.mono,
                                  letterSpacing: '0.05em',
                                }}
                              >
                                PREVIEW PAYMENT
                              </span>
                            </div>
                          </div>
                        )}

                        {/* ── Confirm view — matches PayPageClient ConfirmView ── */}
                        {showConfirm && (
                          <div
                            style={{
                              opacity: confirmOpacity,
                              transform: `translateY(${confirmSlide}px)`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 16,
                            }}
                          >
                            {/* Summary card */}
                            <div
                              style={{
                                padding: 16,
                                borderRadius: 2,
                                backgroundColor: COLORS.white03,
                                border: `1px solid ${COLORS.white06}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              {/* Amount row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                  Amount
                                </span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
                                  0.5 ETH
                                </span>
                              </div>
                              <div style={{ height: 1, backgroundColor: COLORS.white06 }} />

                              {/* To row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                  To
                                </span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                                  alice.dust
                                </span>
                              </div>
                              <div style={{ height: 1, backgroundColor: COLORS.white06 }} />

                              {/* Network row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                  Network
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ETHIcon size={12} />
                                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.mono }}>
                                    Ethereum Sepolia
                                  </span>
                                </div>
                              </div>
                              <div style={{ height: 1, backgroundColor: COLORS.white06 }} />

                              {/* Fee row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                  Fee
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', fontFamily: FONTS.mono }}>
                                  FREE (SPONSORED)
                                </span>
                              </div>
                            </div>

                            {/* Privacy note — matches PayPageClient */}
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                                padding: 12,
                                borderRadius: 2,
                                backgroundColor: 'rgba(0,255,65,0.03)',
                                border: '1px solid rgba(0,255,65,0.08)',
                              }}
                            >
                              <LockIcon size={12} color={COLORS.neonGreen} />
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,0.35)',
                                  fontFamily: FONTS.mono,
                                }}
                              >
                                Stealth address — cannot be linked to alice.dust
                              </span>
                            </div>

                            {/* Buttons — BACK + SEND PAYMENT */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '12px 0',
                                  borderRadius: 2,
                                  textAlign: 'center' as const,
                                  border: `1px solid rgba(255,255,255,0.08)`,
                                  backgroundColor: 'transparent',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'rgba(255,255,255,0.5)',
                                    fontFamily: FONTS.mono,
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  BACK
                                </span>
                              </div>
                              <div
                                style={{
                                  flex: 2,
                                  padding: '12px 0',
                                  borderRadius: 2,
                                  textAlign: 'center' as const,
                                  border: '1px solid rgba(0,255,65,0.2)',
                                  backgroundColor: 'rgba(0,255,65,0.1)',
                                  transform: isClickingSend ? 'scale(0.97)' : 'scale(1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                }}
                              >
                                <SendIcon size={13} color={COLORS.neonGreen} />
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: COLORS.neonGreen,
                                    fontFamily: FONTS.mono,
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  SEND PAYMENT
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Processing state ── */}
                        {showProcessing && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 12,
                              paddingTop: 20,
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: `2px solid ${COLORS.neonGreen}`,
                                borderTopColor: 'transparent',
                                transform: `rotate(${spinnerRotation}deg)`,
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: FONTS.mono }}>
                              Sending...
                            </span>
                          </div>
                        )}

                        {/* ── Success view — matches PayPageClient SuccessView ── */}
                        {showSuccess && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 20,
                              paddingTop: 16,
                            }}
                          >
                            {/* Check icon — square with rounded corners like real UI */}
                            <div
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 2,
                                backgroundColor: 'rgba(34,197,94,0.08)',
                                border: '1px solid rgba(34,197,94,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: `scale(${successCheckScale})`,
                              }}
                            >
                              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" />
                              </svg>
                            </div>

                            {/* Success text */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 8,
                                opacity: successTextOpacity,
                                transform: `translateY(${successTextSlide}px)`,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: COLORS.white,
                                  fontFamily: FONTS.mono,
                                  letterSpacing: '0.05em',
                                }}
                              >
                                PAYMENT SENT
                              </span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: COLORS.white,
                                    fontFamily: FONTS.mono,
                                  }}
                                >
                                  0.5
                                </span>
                                <span
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 500,
                                    color: COLORS.white40,
                                  }}
                                >
                                  ETH
                                </span>
                              </div>
                              <span style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono }}>
                                sent to{' '}
                                <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>alice.dust</span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <ETHIcon size={11} />
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono }}>
                                  Ethereum Sepolia
                                </span>
                              </div>

                              {/* Explorer link mock */}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 6,
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  borderRadius: 2,
                                  border: `1px solid rgba(255,255,255,0.08)`,
                                  backgroundColor: 'rgba(255,255,255,0.02)',
                                  marginTop: 4,
                                }}
                              >
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={COLORS.neonGreen} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="7" y1="17" x2="17" y2="7" />
                                  <polyline points="7 7 17 7 17 17" />
                                </svg>
                                <span style={{ fontSize: 11, color: COLORS.neonGreen, fontFamily: FONTS.mono, fontWeight: 500 }}>
                                  View on Explorer
                                </span>
                              </div>

                              {/* Send another */}
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,0.25)',
                                  fontFamily: FONTS.mono,
                                  marginTop: 4,
                                }}
                              >
                                Send another payment
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer — "Pay someone else" link */}
                  {!showSuccess && (
                    <div style={{ textAlign: 'center' as const, paddingTop: 12 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: FONTS.mono }}>
                        Pay someone else
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Cursor
          frame={frame}
          positions={cursorPositions}
          clicking={isClickingPreview || isClickingSend}
        />
      </div>
    </Background>
  );
};
