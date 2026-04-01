import React from 'react';
import { useCurrentFrame, useVideoConfig, Video, staticFile, AbsoluteFill, interpolate } from 'remotion';
import { DustLogo } from '../components/Logo';
import { ArrowUpRightIcon } from '../components/Icons';
import { PrivyPopup } from '../components/PrivyPopup';
import { Navbar } from '../components/Navbar';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, fadeOut, sceneFade } from '../utils/animations';

export const LandingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneOpacity = sceneFade(frame, 0, 180);

  const headerOpacity = fadeIn(frame, 0, 12);
  const leftOpacity = fadeIn(frame, 5, 15);
  const rightOpacity = fadeIn(frame, 15, 15);
  const subtitleLeftOpacity = fadeIn(frame, 20, 12);
  const subtitleRightOpacity = fadeIn(frame, 25, 12);
  const inputOpacity = fadeIn(frame, 25, 15);
  const footerOpacity = fadeIn(frame, 30, 15);

  const privyVisible = frame >= 60;
  const privyOpacity = frame >= 100
    ? fadeOut(frame, 100, 10)
    : fadeIn(frame, 60, 10);
  const privySelectedLogin = frame >= 80 ? 'google' as const : null;
  const privyLoading = frame >= 85;

  const showConnectedNavbar = frame >= 100;

  const walletGlowIntensity = frame >= 100
    ? interpolate(frame, [100, 108, 115], [0, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: 'hidden' }}>
      {/* Background video */}
      <AbsoluteFill style={{ opacity: 0.6 }}>
        <Video
          src={staticFile('bg.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </AbsoluteFill>

      {/* Dark overlay for contrast */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(6,8,15,0.7) 0%, rgba(6,8,15,0.3) 40%, rgba(6,8,15,0.7) 100%)',
        }}
      />

      <AbsoluteFill style={{ opacity: sceneOpacity, fontFamily: FONTS.mono }}>
        {/* Connected Navbar — replaces header after wallet connects */}
        {showConnectedNavbar ? (
          <div
            style={{
              position: 'relative',
              zIndex: 100,
              opacity: fadeIn(frame, 100, 10),
            }}
          >
            <Navbar walletConnected />
            {walletGlowIntensity > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 220,
                  height: 64,
                  background: `radial-gradient(ellipse at 80% 50%, rgba(0,255,65,${0.35 * walletGlowIntensity}) 0%, transparent 70%)`,
                  pointerEvents: 'none' as const,
                  zIndex: 101,
                }}
              />
            )}
          </div>
        ) : (
          /* Pre-connect header — matches real page.tsx layout */
          <div
            style={{
              position: 'relative',
              zIndex: 100,
              padding: '32px 40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: headerOpacity,
            }}
          >
            {/* Left: Logo + DUST PROTOCOL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DustLogo size={40} showText={false} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: '#fff', fontFamily: FONTS.mono }}>
                  DUST
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.25em', color: 'rgba(0,255,65,0.35)', fontFamily: FONTS.mono, textTransform: 'uppercase' as const }}>
                  PROTOCOL
                </span>
              </div>
            </div>

            {/* Right: Docs + Connect Wallet */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  borderRadius: 2,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                }}
              >
                Docs
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  backgroundColor: COLORS.neonGreen,
                  color: COLORS.bg,
                  borderRadius: 2,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  boxShadow: '0 0 20px rgba(0,255,65,0.2), 0 0 60px rgba(0,255,65,0.06)',
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.bg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
                </svg>
                Connect Wallet
              </div>
            </div>
          </div>
        )}

        {/* Desktop Split Layout */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            padding: '0 60px',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100% - 160px)',
          }}
        >
          {/* Left Side: Private Transfers */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start', justifyContent: 'center', opacity: leftOpacity }}>
            <div>
              <div
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 72,
                  fontWeight: 400,
                  color: COLORS.white,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                  marginBottom: 16,
                }}
              >
                <div>Private</div>
                <div>Transfers</div>
              </div>
              <p
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.7)',
                  opacity: subtitleLeftOpacity,
                  lineHeight: 1.6,
                  maxWidth: 320,
                }}
              >
                Untraceable payments that dissolve into the blockchain.
              </p>
            </div>

            {/* Pay search input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380, opacity: inputOpacity }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <div
                  style={{
                    flex: 1,
                    height: 56,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 20px',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <span style={{ fontFamily: FONTS.mono, fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>
                    username.dust
                  </span>
                </div>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <ArrowUpRightIcon size={20} color="white" />
                </div>
              </div>
              <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                ENTER A USERNAME TO PAY
              </span>
            </div>
          </div>

          {/* Right Side: Privacy Swap */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-end', justifyContent: 'center', textAlign: 'right' as const, opacity: rightOpacity }}>
            <div>
              <div
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 72,
                  fontWeight: 400,
                  color: COLORS.white,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                  marginBottom: 16,
                }}
              >
                <div>Privacy</div>
                <div>Swap</div>
              </div>
              <p
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.7)',
                  opacity: subtitleRightOpacity,
                  lineHeight: 1.6,
                  maxWidth: 320,
                  marginLeft: 'auto',
                }}
              >
                Swap tokens anonymously without leaving a trace.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            opacity: footerOpacity,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.5)' }}>
            &copy; 2026 Dust Protocol. All rights reserved.
          </span>
          <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.4)' }}>
            dustprotocol.app
          </span>
          <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            Follow us on X
          </span>
        </div>
      </AbsoluteFill>

      {/* Privy popup overlay with dark backdrop */}
      {privyVisible && (
        <AbsoluteFill
          style={{
            zIndex: 150,
            backgroundColor: 'rgba(0,0,0,0.7)',
            opacity: privyOpacity,
          }}
        >
          <PrivyPopup
            visible={privyVisible}
            selectedLogin={privySelectedLogin}
            loading={privyLoading}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
