import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { CornerAccents } from '../components/CornerAccents';
import { Cursor } from '../components/Cursor';
import { DustLogo } from '../components/Logo';
import { CopyIcon, CheckIcon, XIcon, ExternalLinkIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, fadeOut } from '../utils/animations';

const QR_PATTERN = [
  [1,1,1,1,1,1,1,0,1,0,1,0,0,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,1,1,0,0,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
  [1,0,1,0,1,1,1,1,0,0,1,1,0,1,1,0,1,0,1,0,1],
  [0,1,0,1,0,0,0,1,1,0,1,0,1,0,0,1,0,1,0,1,0],
  [1,1,0,0,1,1,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1],
  [0,1,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,1,1,0],
  [1,0,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,0,0,0,1],
  [0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0],
  [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,0,1,1,0,1,1],
  [1,0,0,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,1,1,0],
  [1,0,1,1,1,0,1,0,0,1,0,1,1,1,1,0,1,0,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0],
  [1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,1,1,0,1,0,0,0,1,0],
  [1,1,1,1,1,1,1,0,1,0,1,0,0,1,1,0,1,1,1,1,1],
];

const FakeQR: React.FC = () => {
  const cellSize = 10;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 2,
        backgroundColor: '#ffffff',
        display: 'inline-block',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {QR_PATTERN.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 0 }}>
            {row.map((cell, ci) => (
              <div
                key={ci}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell ? '#1A1D2B' : '#ffffff',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const ShareIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const DEMO_URL = 'dustprotocol.app/pay/alice';

export const ReceiveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const modalScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.6 },
    from: 0.95,
    to: 1,
  });
  const modalOpacity = fadeIn(frame, 0, 15);

  const nameOpacity = fadeIn(frame, 10, 10);
  const qrOpacity = fadeIn(frame, 18, 10);
  const qrScale = interpolate(frame, [18, 30], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const linkOpacity = fadeIn(frame, 30, 8);
  const buttonsOpacity = fadeIn(frame, 36, 8);
  const brandingOpacity = fadeIn(frame, 42, 8);

  const isCopied = frame >= 62;
  const copyFlash = isCopied
    ? interpolate(frame, [62, 72], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const sceneOpacity = frame >= 70 ? fadeOut(frame, 70, 20) : 1;

  const cursorPositions = [
    { x: 960, y: 720, frame: 40 },
    { x: 870, y: 680, frame: 58 },
  ];
  const clicking = frame >= 60 && frame <= 65;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <Background>
        {/* Backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          {/* Modal — matches ReceiveModal.tsx */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 400,
              padding: 24,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: '#06080F',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
              opacity: modalOpacity,
              transform: `scale(${modalScale})`,
            }}
          >
            <CornerAccents />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DustLogo size={14} showText={false} />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: COLORS.white70,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.1em',
                  }}
                >
                  RECEIVE
                </span>
              </div>
              <XIcon size={18} color={COLORS.white40} />
            </div>

            {/* Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* .dust name */}
              <div style={{ textAlign: 'center' as const, opacity: nameOpacity }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: COLORS.neonGreen,
                    fontFamily: FONTS.mono,
                  }}
                >
                  alice.dust
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.white40,
                    fontFamily: FONTS.mono,
                    marginTop: 4,
                  }}
                >
                  Share this link to receive private payments
                </div>
              </div>

              {/* QR Code */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: qrOpacity,
                  transform: `scale(${qrScale})`,
                }}
              >
                <FakeQR />
              </div>

              {/* Link row — matches the clickable button in ReceiveModal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: COLORS.white03,
                  border: `1px solid ${
                    copyFlash > 0
                      ? `rgba(0,255,65,${0.3 * copyFlash})`
                      : COLORS.white06
                  }`,
                  borderRadius: 2,
                  opacity: linkOpacity,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: COLORS.white40,
                    fontFamily: FONTS.mono,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {DEMO_URL}
                </span>
                <span style={{ flexShrink: 0 }}>
                  {isCopied ? (
                    <CheckIcon size={14} color={COLORS.neonGreen} />
                  ) : (
                    <CopyIcon size={14} color={COLORS.white40} />
                  )}
                </span>
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  width: '100%',
                  opacity: buttonsOpacity,
                }}
              >
                {/* Copy Link button */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 10,
                    borderRadius: 2,
                    border: `1px solid ${COLORS.white10}`,
                    backgroundColor: COLORS.white03,
                    fontSize: 12,
                    fontFamily: FONTS.mono,
                    color: isCopied ? COLORS.neonGreen : COLORS.white70,
                  }}
                >
                  {isCopied ? (
                    <CheckIcon size={13} color={COLORS.neonGreen} />
                  ) : (
                    <CopyIcon size={13} color="currentColor" />
                  )}
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </div>

                {/* Share button — green primary */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 10,
                    borderRadius: 2,
                    backgroundColor: COLORS.neonGreen,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: FONTS.mono,
                    color: '#000000',
                  }}
                >
                  <ExternalLinkIcon size={13} color="#000000" />
                  Open Link
                </div>
              </div>

              {/* Branding footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingTop: 4,
                  opacity: brandingOpacity,
                }}
              >
                <DustLogo size={12} showText={false} />
                <span
                  style={{
                    fontSize: 10,
                    color: COLORS.white20,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.1em',
                  }}
                >
                  DUST PROTOCOL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cursor */}
        <Cursor frame={frame} positions={cursorPositions} clicking={clicking} />
      </Background>
    </AbsoluteFill>
  );
};
