import React from 'react';
import { COLORS, FONTS } from '../styles/theme';

type LoginMethod = 'google' | 'twitter' | 'farcaster' | 'email';

interface PrivyPopupProps {
  visible: boolean;
  selectedLogin?: LoginMethod | null;
  loading?: boolean;
}

const ACCENT = '#7c7fff';

const Spinner: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 16,
      height: 16,
      border: `2px solid ${color}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
    }}
  />
);

const GoogleIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const XIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="#000000">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FarcasterIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="#855DCD">
    <path d="M5.24 3h13.52v1.37l1.62 1.37H22v2.74h-1.62V19.26c0 .76-.61 1.37-1.37 1.37h-.68c-.76 0-1.37-.61-1.37-1.37v-5.48c0-1.52-1.23-2.74-2.74-2.74h-4.44c-1.52 0-2.74 1.23-2.74 2.74v5.48c0 .76-.61 1.37-1.37 1.37h-.68c-.76 0-1.37-.61-1.37-1.37V8.48H2V5.74h1.62l1.62-1.37V3z" />
  </svg>
);

const EmailIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const MetaMaskIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <path d="M21.3 2L13 8.2l1.5-3.6L21.3 2z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.5" />
    <path d="M2.7 2l8.2 6.3-1.4-3.7L2.7 2zM18.4 16.8l-2.2 3.4 4.7 1.3 1.3-4.6-3.8-.1zM1.8 16.9l1.3 4.6 4.7-1.3-2.2-3.4-3.8.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
    <path d="M7.6 10.5l-1.3 2 4.7.2-.2-5-3.2 2.8zM16.4 10.5l-3.3-2.9-.1 5.1 4.7-.2-1.3-2z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
    <path d="M7.8 20.2l2.8-1.4-2.4-1.9-.4 3.3zM13.4 18.8l2.8 1.4-.4-3.3-2.4 1.9z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
  </svg>
);

const WalletConnectIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <path d="M6.09 8.56c3.26-3.2 8.56-3.2 11.82 0l.39.38a.4.4 0 0 1 0 .58l-1.34 1.32a.21.21 0 0 1-.3 0l-.54-.53a5.83 5.83 0 0 0-8.24 0l-.58.57a.21.21 0 0 1-.3 0L5.67 9.56a.4.4 0 0 1 0-.58l.42-.42zm14.6 2.72 1.2 1.17a.4.4 0 0 1 0 .58l-5.38 5.28a.42.42 0 0 1-.59 0l-3.82-3.75a.1.1 0 0 0-.15 0l-3.82 3.75a.42.42 0 0 1-.59 0L2.16 13.03a.4.4 0 0 1 0-.58l1.2-1.17a.42.42 0 0 1 .59 0l3.82 3.74a.1.1 0 0 0 .15 0l3.82-3.74a.42.42 0 0 1 .59 0l3.82 3.74a.1.1 0 0 0 .15 0l3.82-3.74a.42.42 0 0 1 .59 0z" fill="#3B99FC" />
  </svg>
);

const CoinbaseIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#0052FF" />
    <path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm-2.25 5.25h4.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75z" fill="#ffffff" />
  </svg>
);

const SOCIAL_BUTTONS: {
  id: LoginMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'twitter', label: 'X', icon: <XIcon /> },
  { id: 'farcaster', label: 'Farcaster', icon: <FarcasterIcon /> },
];

const WALLET_OPTIONS = [
  { id: 'metamask', label: 'MetaMask', icon: <MetaMaskIcon /> },
  { id: 'walletconnect', label: 'WalletConnect', icon: <WalletConnectIcon /> },
  { id: 'coinbase', label: 'Coinbase Wallet', icon: <CoinbaseIcon /> },
];

export const PrivyPopup: React.FC<PrivyPopupProps> = ({
  visible,
  selectedLogin = null,
  loading = false,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        opacity: visible ? 1 : 0,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: 400,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: '28px 24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#1a1a2e',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in to Dust Protocol
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#6b7280',
              marginTop: 6,
            }}
          >
            Private payments powered by stealth addresses
          </div>
        </div>

        {/* Social login buttons — full-width stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SOCIAL_BUTTONS.map((btn) => {
            const isSelected = selectedLogin === btn.id;
            const dimmed = selectedLogin !== null && !isSelected;
            return (
              <div
                key={btn.id}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  backgroundColor: dimmed ? '#f9fafb' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#1a1a2e',
                  opacity: dimmed ? 0.45 : 1,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${ACCENT}`
                    : '0 1px 2px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected && loading ? <Spinner color={ACCENT} /> : btn.icon}
                <span>{btn.label}</span>
              </div>
            );
          })}
        </div>

        {/* Email input */}
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              height: 44,
              borderRadius: 10,
              border: selectedLogin === 'email'
                ? `2px solid ${ACCENT}`
                : '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 14,
              paddingRight: 14,
              fontSize: 14,
              color: '#9ca3af',
              opacity: selectedLogin !== null && selectedLogin !== 'email' ? 0.45 : 1,
            }}
          >
            <EmailIcon />
            <span>Enter your email</span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          <span
            style={{
              fontSize: 12,
              color: '#9ca3af',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
        </div>

        {/* Wallet options — each as a row with icon and label */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WALLET_OPTIONS.map((wallet) => (
            <div
              key={wallet.id}
              style={{
                height: 44,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 14,
                paddingRight: 14,
                fontSize: 15,
                fontWeight: 500,
                color: '#1a1a2e',
                backgroundColor: 'transparent',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {wallet.icon}
              </div>
              <span>{wallet.label}</span>
            </div>
          ))}
        </div>

        {/* Privy branding */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#c4c4c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              fontSize: 12,
              color: '#c4c4c4',
              fontWeight: 500,
            }}
          >
            Secured by Privy
          </span>
        </div>
      </div>
    </div>
  );
};
