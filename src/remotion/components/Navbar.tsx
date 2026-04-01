import React from 'react';
import { COLORS, FONTS } from '../styles/theme';
import { DustLogo } from './Logo';
import { ChevronDownIcon } from './Icons';

interface NavbarProps {
  activeRoute?: string;
  walletConnected?: boolean;
  walletAddress?: string;
}

const NAV_ITEMS = [
  { label: 'Dashboard', route: '/dashboard' },
  { label: 'Swap', route: '/swap' },
  { label: 'Shield', route: '/pools' },
  { label: 'Wallet', route: '/wallet' },
  { label: 'Links', route: '/links' },
  { label: 'Activity', route: '/activities' },
  { label: 'Settings', route: '/settings' },
  { label: 'Docs', route: '/docs' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeRoute = '/dashboard',
  walletConnected = true,
  walletAddress = '0x8d56\u20263496',
}) => {
  return (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        borderBottom: `1px solid ${COLORS.borderSubtle}`,
        backgroundColor: 'rgba(6,8,15,0.95)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Left — logo */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <DustLogo size={24} showText={false} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: COLORS.white,
                fontFamily: FONTS.mono,
              }}
            >
              DUST
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                color: 'rgba(0,255,65,0.5)',
                fontFamily: FONTS.mono,
                textTransform: 'uppercase' as const,
              }}
            >
              PROTOCOL
            </span>
          </div>
        </div>
      </div>

      {/* Center — nav links (only when connected) */}
      {walletConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.route === activeRoute;
            return (
              <div
                key={item.route}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap' as const,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.1em',
                    color: isActive ? COLORS.neonGreen : COLORS.white40,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 8,
                      right: 8,
                      height: 1,
                      backgroundColor: 'rgba(0,255,65,0.7)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Right — wallet button (no chain badge in Flow-only mode) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, minWidth: 0 }}>
        {walletConnected ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2,
              backgroundColor: '#0a0d14',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                backgroundColor: COLORS.neonGreen,
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontFamily: FONTS.mono,
                color: COLORS.white90,
              }}
            >
              {walletAddress}
            </span>
            <ChevronDownIcon size={14} color={COLORS.white40} />
          </div>
        ) : (
          <div
            style={{
              padding: '8px 20px',
              fontSize: 11,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: COLORS.neonGreen,
              border: '1px solid rgba(0,255,65,0.3)',
              backgroundColor: 'rgba(0,255,65,0.05)',
              borderRadius: 2,
            }}
          >
            CONNECT WALLET
          </div>
        )}
      </div>
    </div>
  );
};
