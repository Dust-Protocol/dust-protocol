import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { CornerAccents } from '../components/CornerAccents';
import { Cursor } from '../components/Cursor';
import { ShieldCheckIcon, ETHIcon, USDCIcon, BaseIcon, XIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { typeText, cursorBlink, sceneFade } from '../utils/animations';

const RECIPIENT_ADDR = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68';
const RECIPIENT_DISPLAY = '0x742d35Cc...f2bD68';

export const SendFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = sceneFade(frame, 0, 210);

  const modalScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.6 },
    from: 0.95,
    to: 1,
  });
  const modalOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const amountText = typeText('0.80', frame, 15, 0.2);
  const amountCursorBlink = frame >= 15 && frame < 40 && cursorBlink(frame, fps);

  const notePreviewOpacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const notePreviewSlide = interpolate(frame, [30, 40], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chunkOpacity = interpolate(frame, [35, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const chunkSlide = interpolate(frame, [35, 45], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const recipientTyped = typeText(RECIPIENT_ADDR, frame, 40, 1.5);
  const recipientDone = frame >= 68;
  const recipientDisplay = recipientDone ? RECIPIENT_DISPLAY : recipientTyped;
  const recipientCursorBlink = frame >= 40 && frame < 75 && !recipientDone && cursorBlink(frame, fps);

  const isClicking = frame >= 80 && frame <= 83;

  const showForm = frame < 85;
  const showProcessing = frame >= 85 && frame < 165;
  const showSuccess = frame >= 165 && frame < 190;

  const getPipelineColor = (stepStart: number, stepEnd: number): string => {
    if (frame >= stepEnd) return COLORS.white50;
    if (frame >= stepStart) return COLORS.neonGreen;
    return 'rgba(255,255,255,0.3)';
  };

  const getStatusText = (): string => {
    if (frame < 100) return 'Generating privacy-optimized send proof...';
    if (frame < 120) return 'Verifying proof...';
    if (frame < 145) return 'Submitting to relayer...';
    return 'Confirming on-chain...';
  };

  const spinnerRotation = ((frame - 85) * 12) % 360;

  const successOpacity = interpolate(frame, [165, 175], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const successScale = spring({
    frame: frame - 165,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });

  const fadeOutOpacity = frame >= 190
    ? interpolate(frame, [190, 210], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const cursorPositions = [
    { x: 960, y: 400, frame: 15 },
    { x: 960, y: 560, frame: 40 },
    { x: 960, y: 700, frame: 65 },
    { x: 960, y: 830, frame: 75 },
  ];

  return (
    <Background>
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity }}>
        <Navbar activeRoute="/pools" />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            top: 64,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: modalOpacity * fadeOutOpacity,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 520,
              maxHeight: 900,
              backgroundColor: COLORS.bg,
              border: `1px solid ${COLORS.white10}`,
              borderRadius: 6,
              padding: 24,
              transform: `scale(${modalScale})`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CornerAccents />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: COLORS.white,
                    fontFamily: FONTS.mono,
                  }}
                >
                  [ SEND ]
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px',
                    borderRadius: 2,
                    backgroundColor: COLORS.white04,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <BaseIcon size={14} />
                  <span style={{ fontSize: 9, color: COLORS.white50, fontFamily: FONTS.mono }}>
                    Base Sepolia
                  </span>
                </div>
              </div>
              <XIcon size={20} color={COLORS.white40} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Form content */}
              {showForm && (
                <>
                  {/* Asset selector */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* ETH — selected */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        border: `1px solid ${COLORS.neonGreen}`,
                        backgroundColor: 'rgba(0,255,65,0.08)',
                        borderRadius: 2,
                      }}
                    >
                      <ETHIcon size={16} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                        ETH
                      </span>
                      <span style={{ fontSize: 10, color: COLORS.neonGreen, fontFamily: FONTS.mono, marginLeft: 'auto', opacity: 0.6 }}>
                        3.0000
                      </span>
                    </div>
                    {/* USDC — unselected */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        border: `1px solid ${COLORS.white10}`,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 2,
                      }}
                    >
                      <USDCIcon size={16} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.white50, fontFamily: FONTS.mono }}>
                        USDC
                      </span>
                    </div>
                  </div>

                  {/* Balance card */}
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: COLORS.white03,
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: COLORS.white50,
                        fontFamily: FONTS.mono,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        marginBottom: 4,
                      }}
                    >
                      Available to Send
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.white, fontFamily: FONTS.mono }}>
                        3.0000
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 16,
                          fontWeight: 600,
                          color: COLORS.white50,
                          fontFamily: FONTS.mono,
                        }}
                      >
                        <ETHIcon size={16} />
                        ETH
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono, marginTop: 4 }}>
                      From 4 shielded balance entries
                    </div>
                  </div>

                  {/* Amount input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 9,
                          color: COLORS.white50,
                          fontFamily: FONTS.mono,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.05em',
                        }}
                      >
                        Send Amount (ETH)
                      </span>
                      <span style={{ fontSize: 10, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                        MAX
                      </span>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        border: `1px solid ${COLORS.white10}`,
                        backgroundColor: COLORS.white03,
                        borderRadius: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          color: amountText ? COLORS.white : COLORS.white20,
                          fontFamily: FONTS.mono,
                        }}
                      >
                        {amountText || '0.0'}
                        {amountCursorBlink && <span style={{ color: COLORS.neonGreen }}>|</span>}
                      </span>
                    </div>
                  </div>

                  {/* Note preview */}
                  {frame >= 30 && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: COLORS.bgCard,
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        opacity: notePreviewOpacity,
                        transform: `translateY(${notePreviewSlide}px)`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: COLORS.white50,
                          fontFamily: FONTS.mono,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.05em',
                        }}
                      >
                        Balance Selection
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono }}>
                          Source balance
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.white, fontFamily: FONTS.mono }}>
                          1.000000 ETH
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono }}>
                          Change returned
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                          0.200000 ETH
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Denomination chunk preview */}
                  {frame >= 35 && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: 'rgba(0,255,65,0.03)',
                        border: '1px solid rgba(0,255,65,0.1)',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        opacity: chunkOpacity,
                        transform: `translateY(${chunkSlide}px)`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: COLORS.white50,
                          fontFamily: FONTS.mono,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.05em',
                        }}
                      >
                        Privacy-optimized — 2 chunks
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            backgroundColor: 'rgba(0,255,65,0.08)',
                            border: '1px solid rgba(0,255,65,0.15)',
                            borderRadius: 2,
                            fontSize: 10,
                            color: COLORS.neonGreen,
                            fontFamily: FONTS.mono,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ETHIcon size={10} />
                          0.5 ETH
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            backgroundColor: 'rgba(0,255,65,0.08)',
                            border: '1px solid rgba(0,255,65,0.15)',
                            borderRadius: 2,
                            fontSize: 10,
                            color: COLORS.neonGreen,
                            fontFamily: FONTS.mono,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ETHIcon size={10} />
                          0.3 ETH
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: FONTS.mono }}>
                        Each chunk blends into its privacy pool for stronger protection.
                      </span>
                    </div>
                  )}

                  {/* Recipient */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: COLORS.white50,
                        fontFamily: FONTS.mono,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                      }}
                    >
                      Recipient Address
                    </span>
                    <div
                      style={{
                        padding: 12,
                        border: `1px solid ${COLORS.white10}`,
                        backgroundColor: COLORS.white03,
                        borderRadius: 2,
                        minHeight: 20,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          color: COLORS.white,
                          fontFamily: FONTS.mono,
                          wordBreak: 'break-all' as const,
                        }}
                      >
                        {recipientDisplay}
                        {recipientCursorBlink && <span style={{ color: COLORS.neonGreen }}>|</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono }}>
                      Any EVM address. Sender identity is protected by ZK proof.
                    </span>
                  </div>

                  {/* Relayer fee notice */}
                  <div
                    style={{
                      padding: 10,
                      backgroundColor: COLORS.bgCard,
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 2,
                    }}
                  >
                    <span style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono }}>
                      Payment is processed via relayer. A small fee may apply to cover gas.
                    </span>
                  </div>

                  {/* Privacy info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: 12,
                      backgroundColor: 'rgba(124,127,255,0.04)',
                      border: '1px solid rgba(124,127,255,0.1)',
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <ShieldCheckIcon size={14} color={COLORS.purple} />
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.white50, fontFamily: FONTS.mono, lineHeight: '1.5' }}>
                      Your identity is hidden by a zero-knowledge proof. Amount will be split into 2 privacy-optimized chunks with random timing delays.
                    </span>
                  </div>

                  {/* Send button */}
                  <div
                    style={{
                      padding: '12px 0',
                      backgroundColor: 'rgba(0,255,65,0.1)',
                      border: '1px solid rgba(0,255,65,0.2)',
                      borderRadius: 2,
                      textAlign: 'center' as const,
                      transform: isClicking ? 'scale(0.97)' : 'scale(1)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLORS.neonGreen,
                        fontFamily: FONTS.mono,
                        letterSpacing: '0.05em',
                      }}
                    >
                      Send 0.80 ETH
                    </span>
                  </div>
                </>
              )}

              {/* Processing */}
              {showProcessing && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    paddingTop: 24,
                    paddingBottom: 24,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: `2px solid ${COLORS.neonGreen}`,
                      borderTopColor: 'transparent',
                      transform: `rotate(${spinnerRotation}deg)`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.white,
                      fontFamily: FONTS.mono,
                    }}
                  >
                    {getStatusText()}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 10,
                      fontFamily: FONTS.mono,
                    }}
                  >
                    <span style={{ color: getPipelineColor(85, 100) }}>proof</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'\u2192'}</span>
                    <span style={{ color: getPipelineColor(100, 120) }}>verify</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'\u2192'}</span>
                    <span style={{ color: getPipelineColor(120, 145) }}>submit</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'\u2192'}</span>
                    <span style={{ color: getPipelineColor(145, 165) }}>confirm</span>
                  </div>
                </div>
              )}

              {/* Success */}
              {showSuccess && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    opacity: successOpacity,
                    transform: `scale(${successScale})`,
                  }}
                >
                  <div style={{ textAlign: 'center' as const, paddingTop: 8 }}>
                    <div style={{ display: 'inline-flex', marginBottom: 12 }}>
                      <ShieldCheckIcon size={40} color={COLORS.neonGreen} />
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: COLORS.white,
                        fontFamily: FONTS.mono,
                        marginBottom: 4,
                      }}
                    >
                      Payment Sent
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.white50, fontFamily: FONTS.mono }}>
                      0.80 ETH sent privately
                    </div>
                  </div>

                  {/* Split chunks completed */}
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: 'rgba(0,255,65,0.04)',
                      border: `1px solid ${COLORS.neonGreenBorder}`,
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: COLORS.white50,
                        fontFamily: FONTS.mono,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        marginBottom: 8,
                      }}
                    >
                      2 privacy-optimized transfers completed
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: 'rgba(0,255,65,0.08)',
                          border: '1px solid rgba(0,255,65,0.15)',
                          borderRadius: 2,
                          fontSize: 10,
                          color: COLORS.neonGreen,
                          fontFamily: FONTS.mono,
                        }}
                      >
                        0.5 ETH
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: 'rgba(0,255,65,0.08)',
                          border: '1px solid rgba(0,255,65,0.15)',
                          borderRadius: 2,
                          fontSize: 10,
                          color: COLORS.neonGreen,
                          fontFamily: FONTS.mono,
                        }}
                      >
                        0.3 ETH
                      </span>
                    </div>
                  </div>

                  {/* Tx hash */}
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: 'rgba(0,255,65,0.04)',
                      border: `1px solid ${COLORS.neonGreenBorder}`,
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono, marginBottom: 4 }}>
                      Transaction
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                      0x3e7f...9a1c
                    </div>
                  </div>

                  {/* Recipient */}
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: COLORS.bgCard,
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono, marginBottom: 4 }}>
                      Recipient
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.white, fontFamily: FONTS.mono }}>
                      {RECIPIENT_DISPLAY}
                    </div>
                  </div>

                  {/* Change returned */}
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: COLORS.amberDim,
                      border: `1px solid ${COLORS.amberBorder}`,
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: COLORS.amber,
                        fontWeight: 600,
                        fontFamily: FONTS.mono,
                        marginBottom: 4,
                      }}
                    >
                      Remaining balance saved
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.white40, fontFamily: FONTS.mono, lineHeight: '1.5' }}>
                      0.200000 ETH returned to your shielded balance.
                    </div>
                  </div>

                  {/* Done button */}
                  <div
                    style={{
                      padding: '12px 0',
                      backgroundColor: 'rgba(0,255,65,0.1)',
                      border: '1px solid rgba(0,255,65,0.2)',
                      borderRadius: 2,
                      textAlign: 'center' as const,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLORS.neonGreen,
                        fontFamily: FONTS.mono,
                        letterSpacing: '0.05em',
                      }}
                    >
                      Done
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Cursor frame={frame} positions={cursorPositions} clicking={isClicking} />
      </div>
    </Background>
  );
};
