import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { StatusBadge } from '../components/StatusBadge';
import { SystemDesignPanel } from '../components/SystemDesignPanel';
import { ETHIcon, ShieldIcon, EyeOffIcon, CheckIcon, SendIcon, ArrowDownLeftIcon, ArrowUpRightIcon, ExternalLinkIcon } from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, fadeOut, slideUp, slideLeft, sceneFade, pulseGlow } from '../utils/animations';

const BALANCE_BEFORE = '2.3470';
const BALANCE_AFTER = '2.8470';
const PAYMENT_AMOUNT = '0.5 ETH';

const MOCK_ACTIVITIES = [
  { type: 'incoming' as const, amount: '0.5000', from: '0x8d56...3496', block: '#4,281,003', status: 'unclaimed' as const },
  { type: 'outgoing' as const, amount: '0.2500', to: '0xaBc1...F2d3', date: 'Mar 18, 2026', status: 'completed' as const },
  { type: 'incoming' as const, amount: '1.0000', from: '0x7fA9...1e2B', block: '#4,280,441', status: 'claimed' as const },
] as const;

const CornerAccents: React.FC = () => (
  <>
    <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderTop: `1px solid ${COLORS.white10}`, borderLeft: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderTop: `1px solid ${COLORS.white10}`, borderRight: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderBottom: `1px solid ${COLORS.white10}`, borderLeft: `1px solid ${COLORS.white10}` }} />
    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottom: `1px solid ${COLORS.white10}`, borderRight: `1px solid ${COLORS.white10}` }} />
  </>
);

const PulsingDot: React.FC<{ frame: number; color?: string }> = ({ frame, color = COLORS.neonGreen }) => {
  const glow = pulseGlow(frame, 30, 1.5);
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}`,
        opacity: 0.5 + glow * 0.5,
        flexShrink: 0,
      }}
    />
  );
};

const SpinnerIcon: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.white40} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const NotificationBanner: React.FC<{ frame: number }> = ({ frame }) => {
  const slideDistance = interpolate(frame, [0, 20], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bannerOpacity = fadeIn(frame, 0, 20);
  const isClaiming = frame >= 90 && frame < 120;
  const isClaimed = frame >= 120;

  let statusContent: React.ReactNode;
  if (isClaimed) {
    statusContent = <StatusBadge label="Claimed" variant="success" />;
  } else if (isClaiming) {
    statusContent = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SpinnerIcon />
        <StatusBadge label="Claiming..." variant="warning" />
      </div>
    );
  } else {
    statusContent = <StatusBadge label="Unclaimed" variant="warning" />;
  }

  return (
    <div
      style={{
        opacity: bannerOpacity,
        transform: `translateY(${slideDistance}px)`,
        width: '100%',
        padding: '12px 16px',
        borderRadius: 2,
        border: '1px solid rgba(34,197,94,0.3)',
        backgroundColor: 'rgba(34,197,94,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PulsingDot frame={frame} color={COLORS.successGreen} />
        <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.white90 }}>
          New payment detected: {PAYMENT_AMOUNT}
        </span>
      </div>
      {statusContent}
      <CornerAccents />
    </div>
  );
};

const BalanceCard: React.FC<{ frame: number }> = ({ frame }) => {
  const isClaimed = frame >= 120;
  const balanceProgress = interpolate(frame, [120, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const beforeVal = parseFloat(BALANCE_BEFORE);
  const afterVal = parseFloat(BALANCE_AFTER);
  const currentBalance = (beforeVal + (afterVal - beforeVal) * balanceProgress).toFixed(4);

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
      {/* Header row — matches UnifiedBalanceCard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PulsingDot frame={frame} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: COLORS.white50, textTransform: 'uppercase', fontFamily: FONTS.mono }}>
            BALANCE_OVERVIEW
          </span>
        </div>
        <RefreshIcon />
      </div>

      {/* Total balance — matches real: text-3xl font-bold text-white font-mono tracking-tight */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.white, letterSpacing: '-0.02em' }}>
          {currentBalance}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ETHIcon size={20} />
          <span style={{ fontSize: 18, color: COLORS.white70, fontFamily: FONTS.mono }}>ETH</span>
        </div>
      </div>

      {/* Breakdown section — matches real: grid grid-cols-3 gap-3 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={COLORS.white50} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span style={{ fontSize: 9, color: COLORS.white50, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: FONTS.mono }}>
            Breakdown
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <BreakdownItem
            icon={<EyeOffIcon size={12} color={COLORS.white40} />}
            label="Stealth"
            value={isClaimed ? '0.5000' : '0.0000'}
          />
          <BreakdownItem
            icon={<CheckIcon size={12} color={COLORS.white40} />}
            label="Claimed"
            value="0.3470"
          />
          <BreakdownItem
            icon={<ShieldIcon size={12} color={COLORS.neonGreen} />}
            label="Shielded"
            value="2.0000"
            highlight
          />
        </div>
      </div>

      {/* Unclaimed badge — matches real: amber pill with pulsing dot */}
      {!isClaimed && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 9999,
              backgroundColor: 'rgba(255,176,0,0.1)',
              border: '1px solid rgba(255,176,0,0.2)',
            }}
          >
            <PulsingDot frame={frame} color={COLORS.amber} />
            <span style={{ fontSize: 9, color: COLORS.amber, fontFamily: FONTS.mono, letterSpacing: '0.05em' }}>
              1 unclaimed payment
            </span>
          </div>
        </div>
      )}

      <CornerAccents />
    </div>
  );
};

const BreakdownItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ icon, label, value, highlight }) => (
  <div
    style={{
      padding: 12,
      borderRadius: 2,
      border: `1px solid ${highlight ? 'rgba(0,255,65,0.06)' : COLORS.white04}`,
      backgroundColor: highlight ? 'rgba(0,255,65,0.02)' : 'rgba(255,255,255,0.01)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {icon}
      <span style={{ fontSize: 9, color: highlight ? COLORS.neonGreen : COLORS.white50, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
      {value}
      <ETHIcon size={14} />
    </div>
  </div>
);

const ActionButtons: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = fadeIn(frame, 10, 15);
  const slide = slideUp(frame, 10);

  return (
    <div style={{ opacity, transform: `translateY(${slide}px)`, display: 'flex', gap: 10, width: '100%' }}>
      {/* Send — matches real: bg-[#00FF41] text-black font-mono font-bold */}
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
          cursor: 'pointer',
        }}
      >
        <SendIcon size={17} color="#000" />
        <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 14, color: '#000' }}>Send</span>
      </div>

      {/* Shield — matches real: border border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.05)] text-[#00FF41] */}
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
        }}
      >
        <ShieldIcon size={17} color={COLORS.neonGreen} />
        <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 14, color: COLORS.neonGreen }}>Shield</span>
      </div>

      {/* Receive — matches real: border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-white */}
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
          backgroundColor: COLORS.white03,
        }}
      >
        <ArrowDownLeftIcon size={17} color={COLORS.white70} />
        <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 14, color: COLORS.white }}>Receive</span>
      </div>
    </div>
  );
};

const RecentActivityCard: React.FC<{ frame: number }> = ({ frame }) => {
  const isClaimed = frame >= 120;
  const opacity = fadeIn(frame, 15, 15);
  const slide = slideUp(frame, 15);

  const activities = MOCK_ACTIVITIES.map((a, i) => {
    if (i === 0 && isClaimed) return { ...a, status: 'claimed' as const };
    return a;
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slide}px)`,
        position: 'relative',
        width: '100%',
        padding: 24,
        borderRadius: 2,
        border: `1px solid ${COLORS.borderDefault}`,
        backgroundColor: COLORS.bgCard,
        overflow: 'hidden',
      }}
    >
      {/* Header — matches real RecentActivityCard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: COLORS.white50, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: FONTS.mono }}>
            RECENT_ACTIVITY
          </span>
          <span style={{ fontSize: 9, color: COLORS.white20, fontFamily: FONTS.mono }}>
            3 total
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <span style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono }}>View All</span>
          <ExternalLinkIcon size={10} color={COLORS.white40} />
        </div>
      </div>

      {/* Filter tabs — matches real: pill buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {(['all', 'incoming', 'outgoing'] as const).map((f, i) => (
          <div
            key={f}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 9,
              fontFamily: FONTS.mono,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: `1px solid ${i === 0 ? 'rgba(0,255,65,0.2)' : COLORS.borderDefault}`,
              backgroundColor: i === 0 ? 'rgba(0,255,65,0.1)' : 'transparent',
              color: i === 0 ? COLORS.neonGreen : COLORS.white40,
            }}
          >
            {f}
          </div>
        ))}
      </div>

      {/* Activity list — matches real row structure */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activities.map((item, i) => {
          const isIncoming = item.type === 'incoming';
          const statusLabel = item.status;
          const isSuccess = statusLabel === 'claimed' || statusLabel === 'completed';
          const isWarning = statusLabel === 'unclaimed';

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 8px',
                borderBottom: i < activities.length - 1 ? `1px solid ${COLORS.white03}` : 'none',
                borderRadius: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Direction icon — matches real: rounded-full bg */}
                <div
                  style={{
                    padding: 6,
                    borderRadius: '50%',
                    backgroundColor: isIncoming ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isIncoming
                    ? <ArrowDownLeftIcon size={12} color={COLORS.neonGreen} />
                    : <ArrowUpRightIcon size={12} color={COLORS.white50} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
                    {item.amount} ETH
                  </span>
                  <span style={{ fontSize: 9, color: COLORS.white40, fontFamily: FONTS.mono }}>
                    {isIncoming ? `from ${(item as typeof MOCK_ACTIVITIES[0]).from}` : `to ${(item as typeof MOCK_ACTIVITIES[1]).to}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 9, color: COLORS.white20, fontFamily: FONTS.mono }}>
                  {isIncoming ? `Block ${(item as typeof MOCK_ACTIVITIES[0]).block}` : (item as typeof MOCK_ACTIVITIES[1]).date}
                </span>
                <div
                  style={{
                    padding: '2px 6px',
                    borderRadius: 9999,
                    fontSize: 8,
                    fontFamily: FONTS.mono,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: `1px solid ${isSuccess ? 'rgba(0,255,65,0.1)' : isWarning ? 'rgba(255,176,0,0.1)' : COLORS.white10}`,
                    backgroundColor: isSuccess ? 'rgba(0,255,65,0.05)' : isWarning ? 'rgba(255,176,0,0.05)' : 'rgba(255,255,255,0.05)',
                    color: isSuccess ? COLORS.neonGreen : isWarning ? COLORS.amber : COLORS.white40,
                  }}
                >
                  {statusLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CornerAccents />
    </div>
  );
};

export const PaymentArrivesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sceneOpacity = sceneFade(frame, 0, durationInFrames);

  const dashboardMaxWidth = interpolate(
    frame,
    [30, 60, 150, 170],
    [600, 540, 540, 600],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const leftPanelX = slideLeft(frame, 30, 320, 25);
  const leftPanelOpacity = frame < 150
    ? fadeIn(frame, 30, 15)
    : fadeOut(frame, 150, 20);

  const rightPanelX = interpolate(frame, [45, 70], [-320, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightPanelOpacity = frame < 150
    ? fadeIn(frame, 45, 15)
    : fadeOut(frame, 150, 20);

  return (
    <Background>
      <AbsoluteFill style={{ opacity: sceneOpacity }}>
        <Navbar activeRoute="/dashboard" walletConnected />

        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Left SystemDesignPanel */}
          {frame >= 30 && (
            <div
              style={{
                position: 'absolute',
                left: 10,
                top: 24,
                width: 320,
                opacity: leftPanelOpacity,
                transform: `translateX(${leftPanelX}px)`,
                zIndex: 10,
              }}
            >
              <SystemDesignPanel frame={frame} side="left" startFrame={30} />
            </div>
          )}

          {/* Center dashboard — mirrors DashboardPageClient layout */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '24px 14px',
              width: '100%',
              zIndex: 5,
              overflowY: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: dashboardMaxWidth,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header — matches real: text-center mb-2 */}
              <div style={{ textAlign: 'center', marginBottom: 4, opacity: fadeIn(frame, 0, 15), transform: `translateY(${slideUp(frame, 0)}px)` }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    color: COLORS.white,
                    fontFamily: FONTS.mono,
                    marginBottom: 4,
                  }}
                >
                  STEALTH_WALLET
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.white40,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.05em',
                  }}
                >
                  Privacy-first asset management
                </div>
              </div>

              {/* Notification banner — video-specific */}
              <NotificationBanner frame={frame} />

              {/* UnifiedBalanceCard */}
              <div style={{ opacity: fadeIn(frame, 5, 15), transform: `translateY(${slideUp(frame, 5)}px)` }}>
                <BalanceCard frame={frame} />
              </div>

              {/* Action buttons row — Send / Shield / Receive */}
              <ActionButtons frame={frame} />

              {/* RecentActivityCard */}
              <RecentActivityCard frame={frame} />
            </div>
          </div>

          {/* Right SystemDesignPanel */}
          {frame >= 45 && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                top: 24,
                width: 320,
                opacity: rightPanelOpacity,
                transform: `translateX(${-rightPanelX}px)`,
                zIndex: 10,
              }}
            >
              <SystemDesignPanel frame={frame} side="right" startFrame={45} />
            </div>
          )}
        </div>
      </AbsoluteFill>
    </Background>
  );
};
