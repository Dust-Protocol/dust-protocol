import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { StatusBadge } from '../components/StatusBadge';
import {
  ShieldIcon,
  EyeOffIcon,
  CheckIcon,
  LinkIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ETHIcon,
  CopyIcon,
  ExternalLinkIcon,
  SendIcon,
} from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, sceneFade, pulseGlow } from '../utils/animations';

const SECTION_STAGGER = 8;

const CornerAccents: React.FC = () => (
  <>
    <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderTop: `1px solid ${COLORS.white10}`, borderLeft: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderTop: `1px solid ${COLORS.white10}`, borderRight: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderBottom: `1px solid ${COLORS.white10}`, borderLeft: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottom: `1px solid ${COLORS.white10}`, borderRight: `1px solid ${COLORS.white10}` }} />
  </>
);

const SectionWrapper: React.FC<{
  frame: number;
  index: number;
  children: React.ReactNode;
}> = ({ frame, index, children }) => {
  const start = index * SECTION_STAGGER;
  const opacity = fadeIn(frame, start, 12);
  return (
    <div style={{ opacity }}>
      {children}
    </div>
  );
};

const HeaderSection: React.FC = () => (
  <div style={{ textAlign: 'center', marginBottom: 8 }}>
    <div
      style={{
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: '0.2em',
        color: COLORS.white,
        textTransform: 'uppercase',
        fontFamily: FONTS.mono,
        marginBottom: 4,
      }}
    >
      STEALTH_WALLET
    </div>
    <div
      style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: FONTS.mono,
        letterSpacing: '0.05em',
      }}
    >
      Privacy-first asset management
    </div>
  </div>
);

const BalanceBreakdownItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  labelColor?: string;
  borderColor?: string;
  bgColor?: string;
}> = ({ icon, label, value, labelColor = COLORS.white50, borderColor = COLORS.white04, bgColor = 'rgba(255,255,255,0.01)' }) => (
  <div
    style={{
      padding: 12,
      borderRadius: 2,
      border: `1px solid ${borderColor}`,
      backgroundColor: bgColor,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {icon}
      <span
        style={{
          fontSize: 9,
          color: labelColor,
          fontFamily: FONTS.mono,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </span>
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 14,
        fontWeight: 700,
        color: COLORS.white,
        fontFamily: FONTS.mono,
      }}
    >
      {value}
      <ETHIcon size={14} />
    </div>
  </div>
);

const UnifiedBalanceCardSection: React.FC<{ frame: number }> = ({ frame }) => {
  const glowOpacity = pulseGlow(frame, 30, 0.5);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: 24,
        borderRadius: 2,
        border: `1px solid ${COLORS.borderDefault}`,
        backgroundColor: COLORS.bgCard,
        overflow: 'hidden',
      }}
    >
      {/* Header: pulsing green dot + BALANCE_OVERVIEW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: COLORS.neonGreen,
              boxShadow: `0 0 4px ${COLORS.neonGreen}`,
              opacity: glowOpacity + 0.5,
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: COLORS.white50,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: FONTS.mono,
            }}
          >
            BALANCE_OVERVIEW
          </span>
        </div>
      </div>

      {/* Total balance */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white, letterSpacing: '-0.02em' }}>
          2.8470
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ETHIcon size={20} />
          <span style={{ fontSize: 16, color: COLORS.white70, fontFamily: FONTS.mono }}>ETH</span>
        </div>
      </div>

      {/* Breakdown label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: COLORS.white50, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ▸ Breakdown
        </span>
      </div>

      {/* 3-column breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <BalanceBreakdownItem
          icon={<EyeOffIcon size={12} color={COLORS.white40} />}
          label="Stealth"
          value="0.5000"
        />
        <BalanceBreakdownItem
          icon={<CheckIcon size={12} color={COLORS.white40} />}
          label="Claimed"
          value="0.3470"
        />
        <BalanceBreakdownItem
          icon={<ShieldIcon size={12} color={COLORS.neonGreen} />}
          label="Shielded"
          value="2.0000"
          labelColor={COLORS.neonGreen}
          borderColor="rgba(0,255,65,0.06)"
          bgColor="rgba(0,255,65,0.02)"
        />
      </div>

      <CornerAccents />
    </div>
  );
};

const ActionButtons: React.FC = () => (
  <div style={{ display: 'flex', gap: 10 }}>
    {/* Send — solid green bg, black text */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 0',
        borderRadius: 2,
        backgroundColor: COLORS.neonGreen,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: FONTS.mono,
        color: '#000',
      }}
    >
      <SendIcon size={17} color="#000" />
      Send
    </div>
    {/* Shield — green border, green text */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 0',
        borderRadius: 2,
        border: '1px solid rgba(0,255,65,0.3)',
        backgroundColor: 'rgba(0,255,65,0.05)',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: FONTS.mono,
        color: COLORS.neonGreen,
      }}
    >
      <ShieldIcon size={17} color={COLORS.neonGreen} />
      Shield
    </div>
    {/* Receive — white border, white text */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 0',
        borderRadius: 2,
        border: `1px solid ${COLORS.white10}`,
        backgroundColor: 'rgba(255,255,255,0.03)',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: FONTS.mono,
        color: COLORS.white,
      }}
    >
      <ArrowDownLeftIcon size={17} color={COLORS.white70} />
      Receive
    </div>
  </div>
);

const V2PoolCardSection: React.FC = () => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      padding: 24,
      borderRadius: 2,
      border: '1px solid rgba(0,255,65,0.12)',
      backgroundColor: 'rgba(0,255,65,0.02)',
      overflow: 'hidden',
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldIcon size={14} color={COLORS.neonGreen} />
        <span style={{ fontSize: 9, color: COLORS.white50, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          PRIVACY_POOL
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS.neonGreen }} />
        <span style={{ fontSize: 9, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>High</span>
      </div>
    </div>

    {/* V2 feature line — green left border */}
    <div style={{ borderLeft: `2px solid ${COLORS.neonGreen}`, paddingLeft: 8, marginBottom: 16, fontSize: 10, color: COLORS.white40, fontFamily: FONTS.mono }}>
      Private amounts · Zero-knowledge proofs
    </div>

    {/* Balance + deposit count */}
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
      <span style={{ fontSize: 24, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white, letterSpacing: '-0.02em' }}>
        2.0000
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ETHIcon size={16} />
        <span style={{ fontSize: 14, color: COLORS.white40, fontFamily: FONTS.mono }}>ETH</span>
      </div>
      <span style={{ fontSize: 10, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
        3 deposits
      </span>
    </div>

    {/* Keys active indicator */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: COLORS.neonGreen }} />
      <span style={{ fontSize: 10, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>Keys active</span>
    </div>

    {/* Bracket-style action buttons — matches real V2PoolCard */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', border: `1px solid ${COLORS.white10}`, borderRadius: 2, fontSize: 12, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white }}>
        [ UNSHIELD ]
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', border: '1px solid rgba(124,127,255,0.2)', borderRadius: 2, fontSize: 12, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.purple }}>
        [ SEND ]
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', border: `1px solid ${COLORS.white10}`, borderRadius: 2, fontSize: 12, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white }}>
        [ PRIVATE SEND ]
      </div>
    </div>

    <CornerAccents />
  </div>
);

const PersonalLinkCardSection: React.FC = () => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      padding: 24,
      borderRadius: 2,
      border: `1px solid ${COLORS.borderDefault}`,
      backgroundColor: COLORS.bgCard,
      overflow: 'hidden',
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <LinkIcon size={14} color={COLORS.white40} />
      <span style={{ fontSize: 9, color: COLORS.white50, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        IDENTITY
      </span>
    </div>

    {/* Name + actions row */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono, marginBottom: 4 }}>
          alice.dust
        </div>
        <span style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono }}>/pay/alice</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1px solid ${COLORS.white10}`, borderRadius: 2 }}>
          <CopyIcon size={12} color={COLORS.white50} />
          <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.6)' }}>Copy Link</span>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${COLORS.white10}`, borderRadius: 2 }}>
          <ExternalLinkIcon size={12} color={COLORS.white50} />
        </div>
      </div>
    </div>

    <CornerAccents />
  </div>
);

const ACTIVITY_ROWS = [
  { direction: 'in' as const, amount: '0.5000', addr: 'from 0x742d...2bD6', time: 'Block #7234091', badge: 'claimed', variant: 'success' as const },
  { direction: 'in' as const, amount: '1.0000', addr: 'from 0xabcd...ef01', time: 'Block #7234088', badge: 'unclaimed', variant: 'warning' as const },
  { direction: 'out' as const, amount: '0.3470', addr: 'to 0x1234...5678', time: '3/18/2026', badge: 'completed', variant: 'success' as const },
];

const FILTER_TABS = ['all', 'incoming', 'outgoing'];

const RecentActivityCardSection: React.FC<{ frame: number; sectionStart: number }> = ({ frame, sectionStart }) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      padding: 24,
      borderRadius: 2,
      border: `1px solid ${COLORS.borderDefault}`,
      backgroundColor: COLORS.bgCard,
      overflow: 'hidden',
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 9, color: COLORS.white50, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          RECENT_ACTIVITY
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono }}>5 total</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono }}>View All</span>
        <ExternalLinkIcon size={10} color={COLORS.white40} />
      </div>
    </div>

    {/* Filter tabs — rounded-full pill style */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {FILTER_TABS.map((tab) => {
        const isActive = tab === 'all';
        return (
          <div
            key={tab}
            style={{
              padding: '4px 12px',
              border: `1px solid ${isActive ? 'rgba(0,255,65,0.2)' : COLORS.borderDefault}`,
              borderRadius: 9999,
              backgroundColor: isActive ? 'rgba(0,255,65,0.1)' : 'transparent',
              fontSize: 9,
              fontFamily: FONTS.mono,
              color: isActive ? COLORS.neonGreen : COLORS.white40,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>

    {/* Activity rows */}
    {ACTIVITY_ROWS.map((row, i) => {
      const rowStart = sectionStart + i * 4;
      const rowOpacity = fadeIn(frame, rowStart, 8);
      const isIncoming = row.direction === 'in';
      return (
        <div
          key={i}
          style={{
            opacity: rowOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 8px',
            borderBottom: i < ACTIVITY_ROWS.length - 1 ? `1px solid ${COLORS.white03}` : 'none',
            borderRadius: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                padding: 6,
                borderRadius: '50%',
                backgroundColor: isIncoming ? 'rgba(0,255,65,0.1)' : COLORS.white04,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isIncoming
                ? <ArrowDownLeftIcon size={12} color={COLORS.neonGreen} />
                : <ArrowUpRightIcon size={12} color="rgba(255,255,255,0.6)" />
              }
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white }}>
                {row.amount} ETH
              </div>
              <div style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono }}>{row.addr}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: FONTS.mono }}>{row.time}</span>
            <div
              style={{
                padding: '2px 6px',
                borderRadius: 9999,
                fontSize: 8,
                fontFamily: FONTS.mono,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: `1px solid ${row.variant === 'success' ? 'rgba(0,255,65,0.1)' : 'rgba(255,176,0,0.1)'}`,
                backgroundColor: row.variant === 'success' ? 'rgba(0,255,65,0.05)' : 'rgba(255,176,0,0.05)',
                color: row.variant === 'success' ? COLORS.neonGreen : COLORS.amber,
              }}
            >
              {row.badge}
            </div>
          </div>
        </div>
      );
    })}

    <CornerAccents />
  </div>
);

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sceneOpacity = sceneFade(frame, 0, durationInFrames);

  return (
    <Background>
      <AbsoluteFill style={{ opacity: sceneOpacity }}>
        <Navbar activeRoute="/dashboard" walletConnected />

        {/* Matches real DashboardPageClient: px-3.5 py-7, max-w-[640px], centered column, gap-4 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 28,
            paddingBottom: 28,
            paddingLeft: 14,
            paddingRight: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionWrapper frame={frame} index={0}>
              <HeaderSection />
            </SectionWrapper>

            <SectionWrapper frame={frame} index={1}>
              <UnifiedBalanceCardSection frame={frame} />
            </SectionWrapper>

            <SectionWrapper frame={frame} index={2}>
              <ActionButtons />
            </SectionWrapper>

            <SectionWrapper frame={frame} index={3}>
              <V2PoolCardSection />
            </SectionWrapper>

            <SectionWrapper frame={frame} index={4}>
              <PersonalLinkCardSection />
            </SectionWrapper>

            <SectionWrapper frame={frame} index={5}>
              <RecentActivityCardSection frame={frame} sectionStart={5 * SECTION_STAGGER} />
            </SectionWrapper>
          </div>
        </div>
      </AbsoluteFill>
    </Background>
  );
};
