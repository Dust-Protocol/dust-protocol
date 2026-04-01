import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { Navbar } from '../components/Navbar';
import { CornerAccents } from '../components/CornerAccents';
import { Cursor } from '../components/Cursor';
import {
  LinkIcon, CopyIcon, CheckIcon, QRIcon, ShieldIcon,
  SendIcon, LockIcon, ExternalLinkIcon,
} from '../components/Icons';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, slideUp, sceneFade, typeText } from '../utils/animations';

const ACCENT_GREEN = '#00FF41';
const ACCENT_VIOLET = '#7C3AED';
const ACCENT_EMERALD = '#059669';
const EMOJI_BG_PINK = '#F9A8D4';

export const CustomLinkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneOpacity = sceneFade(frame, 0, 150);

  // Phase 1: Links page (0–28)
  const pageOpacity = fadeIn(frame, 0, 10);
  const pageSlide = slideUp(frame, 0, 20, 10);
  const createBtnClicking = frame >= 24 && frame <= 27;

  // Phase 2: Create link form (28–58)
  const showForm = frame >= 28;
  const formOpacity = fadeIn(frame, 28, 8);
  const emojiSelected = frame >= 34;
  const linkNameText = typeText('Coffee Tips', frame, 36, 0.8);
  const descText = typeText('Buy me a coffee!', frame, 46, 1);
  const createClicking = frame >= 55 && frame <= 58;

  // Phase 3: Link created (58–78)
  const showCreated = frame >= 58 && frame < 78;
  const createdOpacity = fadeIn(frame, 58, 8);
  const createdSlide = slideUp(frame, 58, 15, 8);

  // Phase 4: Pay page (78–140)
  const showPayPage = frame >= 78 && frame < 140;
  const payPageOpacity = fadeIn(frame, 78, 8);
  const payPageSlide = slideUp(frame, 78, 20, 10);
  const amountText = typeText('0.05', frame, 88, 0.5);
  const previewClicking = frame >= 98 && frame <= 101;
  const showConfirm = frame >= 102 && frame < 115;
  const confirmOpacity = fadeIn(frame, 102, 6);
  const sendClicking = frame >= 112 && frame <= 115;
  const showSpinner = frame >= 115 && frame < 120;
  const showPaySuccess = frame >= 120 && frame < 140;
  const paySuccessScale = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });

  // Fade out (130–150)
  const finalFade = frame >= 130
    ? interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const cursorPositions = [
    { x: 700, y: 350, frame: 5 },
    { x: 700, y: 350, frame: 24 },
    { x: 960, y: 380, frame: 34 },
    { x: 1050, y: 380, frame: 36 },
    { x: 960, y: 520, frame: 46 },
    { x: 960, y: 680, frame: 55 },
    { x: 960, y: 500, frame: 78 },
    { x: 960, y: 440, frame: 88 },
    { x: 960, y: 530, frame: 98 },
    { x: 1060, y: 600, frame: 112 },
  ];

  return (
    <Background>
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity }}>
        <Navbar activeRoute="/links" />

        {/* ── Phase 1: Links page grid ── */}
        {frame < 78 && (
          <div
            style={{
              position: 'absolute', top: 100, left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
              opacity: (showForm ? (frame < 58 ? 0.15 : 0) : pageOpacity) * finalFade,
              transform: `translateY(${pageSlide}px)`,
            }}
          >
            {/* Heading — real: text-2xl font-bold tracking-widest text-white font-mono text-center */}
            <span
              style={{
                fontSize: 24, fontWeight: 700, letterSpacing: '0.12em',
                color: COLORS.white, fontFamily: FONTS.mono, textAlign: 'center',
              }}
            >
              Links
            </span>

            {/* Row 1 */}
            <div style={{ display: 'flex', gap: 16, width: 680 }}>
              {/* Create New Link — real: dashed border, min-h-200, rounded-sm */}
              <div
                style={{
                  flex: 1, minHeight: 200, padding: 24,
                  border: `2px dashed ${COLORS.white10}`,
                  backgroundColor: COLORS.white03,
                  borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: createBtnClicking ? 'scale(0.97)' : 'scale(1)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  {/* Plus circle — real: w-12 h-12 rounded-full bg-[rgba(255,255,255,0.05)] */}
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      backgroundColor: COLORS.white06,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 24, color: COLORS.white40, fontWeight: 300 }}>+</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.white50 }}>
                    Create New Link
                  </span>
                </div>
              </div>

              {/* Pizza card — real LinkCard: p-6 border-2.5px accentColor */}
              <LinkCardStatic
                emoji="🍕" emojiBg="#FCD34D" name="Pizza Fund"
                dustName="pizza.alice.dust" accentColor={ACCENT_GREEN}
                views={24} payments={12}
              />
            </div>

            {/* Row 2 */}
            <div style={{ display: 'flex', gap: 16, width: 680 }}>
              {/* Personal card — icon instead of emoji */}
              <div
                style={{
                  flex: 1, padding: 24,
                  backgroundColor: COLORS.bgCard, border: `2.5px solid ${ACCENT_VIOLET}`,
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                  display: 'flex', flexDirection: 'column', gap: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${ACCENT_VIOLET}1F, ${ACCENT_VIOLET}0F)`,
                      border: `1px solid ${ACCENT_VIOLET}26`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <LinkIcon size={20} color={ACCENT_VIOLET} />
                  </div>
                  <TypeBadge />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.white90, fontFamily: FONTS.mono }}>
                  Personal
                </span>
                <LinkRow dustName="alice.dust" />
              </div>

              {/* Art card */}
              <LinkCardStatic
                emoji="🎨" emojiBg="#86EFAC" name="Art Commissions"
                dustName="art.alice.dust" accentColor={ACCENT_EMERALD}
                views={8} payments={5}
              />
            </div>
          </div>
        )}

        {/* ── Phase 2 & 3: Create form overlay ── */}
        {showForm && frame < 78 && (
          <div
            style={{
              position: 'absolute', inset: 0, top: 72,
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: formOpacity * finalFade,
            }}
          >
            <div
              style={{
                width: 500, backgroundColor: COLORS.bg,
                border: `1px solid ${COLORS.white10}`, borderRadius: 2,
                padding: 32, position: 'relative',
                transform: `translateY(${slideUp(frame, 28, 20, 10)}px)`,
                display: 'flex', flexDirection: 'column', gap: 24,
              }}
            >
              <CornerAccents />

              {!showCreated && (
                <>
                  {/* Header — real: back arrow + "Create Link" 24px bold */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: COLORS.white40 }}>←</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
                      Create Link
                    </span>
                  </div>

                  {/* Link Name & Style — real: emoji 72px circle + name input 52px */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.white, fontFamily: FONTS.mono }}>
                      Link Name &amp; Style
                    </span>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 64, height: 64, borderRadius: '50%',
                          backgroundColor: emojiSelected ? EMOJI_BG_PINK : COLORS.white06,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 28, position: 'relative',
                          boxShadow: emojiSelected ? `0 4px 16px ${EMOJI_BG_PINK}80` : 'none',
                        }}
                      >
                        {emojiSelected ? '☕' : '🎨'}
                        <div
                          style={{
                            position: 'absolute', bottom: -2, right: -2,
                            width: 20, height: 20, borderRadius: '50%',
                            backgroundColor: COLORS.bg, border: `2px solid ${COLORS.white10}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8,
                          }}
                        >
                          ✏️
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1, height: 48, padding: '0 16px',
                          backgroundColor: COLORS.white04, border: `2px solid ${COLORS.white10}`,
                          borderRadius: 2, display: 'flex', alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 15, fontWeight: 500, fontFamily: FONTS.mono,
                            color: linkNameText ? COLORS.white : COLORS.white20,
                          }}
                        >
                          {linkNameText || 'e.g., Coffee Tips'}
                          {frame >= 36 && frame < 46 && <span style={{ color: COLORS.neonGreen }}>|</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description — real: textarea, bg-input, border */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.white, fontFamily: FONTS.mono }}>
                      Description (Optional)
                    </span>
                    <div
                      style={{
                        minHeight: 72, padding: 14,
                        backgroundColor: COLORS.white04, border: `2px solid ${COLORS.white10}`,
                        borderRadius: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13, fontFamily: FONTS.mono,
                          color: descText ? COLORS.white : COLORS.white20,
                        }}
                      >
                        {descText || 'Tell people what this payment is for...'}
                        {frame >= 46 && frame < 54 && <span style={{ color: COLORS.neonGreen }}>|</span>}
                      </span>
                    </div>
                  </div>

                  {/* Amount info — real: tinted box with "Open Amount" */}
                  <div
                    style={{
                      padding: '16px 20px',
                      backgroundColor: COLORS.neonGreenBg, borderRadius: 2,
                      border: `2px solid ${COLORS.neonGreenBorder}`,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                        Amount
                      </span>
                      <span style={{ fontSize: 13, color: COLORS.white50 }}>
                        <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>Open Amount:</span>{' '}
                        Let customers choose their own amount
                      </span>
                    </div>
                  </div>

                  {/* Create button — real: green, rounded-full, shadow */}
                  <div
                    style={{
                      padding: '14px 0', background: COLORS.neonGreen,
                      borderRadius: 999, textAlign: 'center' as const,
                      transform: createClicking ? 'scale(0.97)' : 'scale(1)',
                      boxShadow: '0 4px 16px rgba(0,255,65,0.35)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#000', fontFamily: FONTS.mono }}>
                      Create Payment Link
                    </span>
                  </div>

                  {/* Link preview — real: "Your link: slug.username.dust" */}
                  {linkNameText.length > 3 && (
                    <div
                      style={{
                        padding: '10px 14px', backgroundColor: COLORS.neonGreenBg,
                        borderRadius: 2, textAlign: 'center' as const,
                      }}
                    >
                      <span style={{ fontSize: 12, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                        Your link: <span style={{ fontWeight: 600 }}>coffee-tips.alice.dust</span>
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Phase 3: Created success */}
              {showCreated && (
                <div
                  style={{
                    opacity: createdOpacity,
                    transform: `translateY(${createdSlide}px)`,
                    display: 'flex', flexDirection: 'column', gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckIcon size={20} color={COLORS.neonGreen} />
                    <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                      Link Created!
                    </span>
                  </div>

                  {/* Created card — real LinkCard styling */}
                  <div
                    style={{
                      padding: 24, backgroundColor: COLORS.bgCard,
                      border: `2.5px solid ${COLORS.neonGreen}`, borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      display: 'flex', flexDirection: 'column', gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          backgroundColor: EMOJI_BG_PINK,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, boxShadow: `0 3px 10px ${COLORS.neonGreen}40`,
                        }}
                      >
                        ☕
                      </div>
                      <TypeBadge />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.white90, fontFamily: FONTS.mono }}>
                      Coffee Tips
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LinkIcon size={14} color={COLORS.white20} />
                        <span style={{ fontSize: 13, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                          coffee-tips.alice.dust
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <SmallActionBtn icon={<CopyIcon size={11} color={COLORS.white50} />} label="Copy" />
                        <SmallActionBtn icon={<ExternalLinkIcon size={11} color={COLORS.white50} />} label="Share" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phase 4: Sender pay page ── */}
        {showPayPage && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              opacity: payPageOpacity * finalFade,
              transform: `translateY(${payPageSlide}px)`,
            }}
          >
            {/* Browser chrome */}
            <div
              style={{
                height: 52, backgroundColor: 'rgba(13,15,23,0.98)',
                borderBottom: `1px solid ${COLORS.white10}`,
                display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                {['#FF5F57', '#FFBD2E', '#28C840'].map((c) => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
                ))}
              </div>
              <div
                style={{
                  flex: 1, height: 30, backgroundColor: COLORS.white04,
                  border: `1px solid ${COLORS.white10}`, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 12, color: COLORS.white50, fontFamily: FONTS.mono }}>
                  dustprotocol.app/pay/alice/coffee-tips
                </span>
              </div>
            </div>

            {/* Page body */}
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', backgroundColor: COLORS.bg, position: 'relative',
              }}
            >
              {/* Header bar — real: Dust logo + "Payment" badge */}
              <div
                style={{
                  width: '100%', padding: '16px 24px',
                  borderBottom: `1px solid ${COLORS.white10}`,
                  display: 'flex', justifyContent: 'center',
                }}
              >
                <div style={{ width: 460, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ShieldIcon size={20} color={COLORS.neonGreen} />
                    <span
                      style={{
                        fontSize: 18, fontWeight: 800, color: COLORS.white,
                        fontFamily: FONTS.mono, letterSpacing: '-0.03em',
                      }}
                    >
                      Dust
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '5px 12px', backgroundColor: COLORS.neonGreenBg,
                      border: `1px solid ${COLORS.neonGreenBorder}`, borderRadius: 999,
                    }}
                  >
                    <span style={{ fontSize: 11, color: COLORS.neonGreen, fontWeight: 600, fontFamily: FONTS.mono }}>
                      Payment
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment card */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 420, position: 'relative' }}>
                  {/* Gradient border — real: linear-gradient glow */}
                  <div
                    style={{
                      position: 'absolute', inset: -2, borderRadius: 14,
                      background: 'linear-gradient(135deg, #00FF41, #7C3AED, #00FF41)',
                      opacity: showPaySuccess ? 0.8 : 0.15,
                    }}
                  />

                  <div
                    style={{
                      backgroundColor: '#0D0F17', borderRadius: 12,
                      overflow: 'hidden', position: 'relative',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Card header — real: shield + dustName + subtitle */}
                    <div
                      style={{
                        padding: '24px 20px 20px', textAlign: 'center' as const,
                        background: showPaySuccess
                          ? 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, transparent 100%)'
                          : 'linear-gradient(180deg, rgba(0,255,65,0.04) 0%, transparent 100%)',
                        borderBottom: showPaySuccess ? 'none' : `1px solid ${COLORS.white10}`,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            padding: 12, borderRadius: '50%',
                            backgroundColor: showPaySuccess ? 'rgba(34,197,94,0.1)' : COLORS.neonGreenBg,
                          }}
                        >
                          <ShieldIcon size={22} color={showPaySuccess ? '#22C55E' : COLORS.neonGreen} />
                        </div>
                        <span
                          style={{
                            fontSize: 20, fontWeight: 700, fontFamily: FONTS.mono,
                            color: showPaySuccess ? '#22C55E' : COLORS.neonGreen,
                          }}
                        >
                          coffee-tips.alice.dust
                        </span>
                        <span style={{ fontSize: 12, color: COLORS.white40 }}>
                          {showPaySuccess ? 'Private payment completed' : 'Send a private payment'}
                        </span>
                      </div>
                    </div>

                    {/* Tabs — real: "Send with Wallet" | "QR / Address" */}
                    {!showPaySuccess && (
                      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.white10}` }}>
                        <div
                          style={{
                            flex: 1, padding: 12, textAlign: 'center' as const,
                            borderBottom: `2px solid ${COLORS.neonGreen}`,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
                            Send with Wallet
                          </span>
                        </div>
                        <div style={{ flex: 1, padding: 12, textAlign: 'center' as const }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.white40, fontFamily: FONTS.mono }}>
                            QR / Address
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Card body */}
                    <div style={{ padding: 20 }}>
                      {showPaySuccess ? (
                        <PaySuccess amount="0.05" scale={paySuccessScale} />
                      ) : showConfirm ? (
                        <ConfirmStep
                          opacity={confirmOpacity}
                          sendClicking={sendClicking}
                          showSpinner={showSpinner}
                        />
                      ) : (
                        <InputStep
                          amountText={amountText}
                          frame={frame}
                          previewClicking={previewClicking}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Cursor
          frame={frame}
          positions={cursorPositions}
          clicking={createBtnClicking || createClicking || previewClicking || sendClicking}
        />
      </div>
    </Background>
  );
};

/* ── Extracted sub-components (no hooks, pure render) ── */

const TypeBadge: React.FC = () => (
  <div style={{ padding: '4px 10px', borderRadius: 2, backgroundColor: COLORS.white04 }}>
    <span
      style={{
        fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: FONTS.mono, color: COLORS.white50,
      }}
    >
      Simple Payment
    </span>
  </div>
);

const LinkRow: React.FC<{ dustName: string }> = ({ dustName }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <LinkIcon size={14} color={COLORS.white20} />
      <span style={{ fontSize: 13, color: COLORS.white20, fontFamily: FONTS.mono }}>{dustName}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <CopyIcon size={14} color={COLORS.white20} />
      <QRIcon size={14} color={COLORS.white20} />
    </div>
  </div>
);

const SmallActionBtn: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '5px 10px', border: `1px solid ${COLORS.white10}`,
      borderRadius: 2, backgroundColor: COLORS.white04,
    }}
  >
    {icon}
    <span style={{ fontSize: 10, color: COLORS.white50, fontFamily: FONTS.mono }}>{label}</span>
  </div>
);

interface LinkCardStaticProps {
  emoji: string;
  emojiBg: string;
  name: string;
  dustName: string;
  accentColor: string;
  views: number;
  payments: number;
}

const LinkCardStatic: React.FC<LinkCardStaticProps> = ({
  emoji, emojiBg, name, dustName, accentColor, views, payments,
}) => (
  <div
    style={{
      flex: 1, padding: 24,
      backgroundColor: COLORS.bgCard, border: `2.5px solid ${accentColor}`,
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div
        style={{
          width: 44, height: 44, borderRadius: '50%', backgroundColor: emojiBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: `0 3px 10px ${accentColor}40`,
        }}
      >
        {emoji}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <TypeBadge />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: COLORS.white20, fontFamily: FONTS.mono }}>👁 {views}</span>
          <span style={{ fontSize: 11, color: COLORS.white20, fontFamily: FONTS.mono }}>💰 {payments}</span>
        </div>
      </div>
    </div>
    <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.white90, fontFamily: FONTS.mono }}>
      {name}
    </span>
    <LinkRow dustName={dustName} />
  </div>
);

const InputStep: React.FC<{
  amountText: string;
  frame: number;
  previewClicking: boolean;
}> = ({ amountText, frame, previewClicking }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <span
        style={{
          fontSize: 11, color: COLORS.white40, display: 'block', marginBottom: 8,
          fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
          fontFamily: FONTS.mono,
        }}
      >
        Amount
      </span>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: '100%', height: 56, backgroundColor: COLORS.white04,
            border: `1.5px solid ${COLORS.white10}`, borderRadius: 2,
            display: 'flex', alignItems: 'center', padding: '0 56px 0 16px',
          }}
        >
          <span
            style={{
              fontSize: 26, fontWeight: 600, fontFamily: FONTS.mono,
              color: amountText ? COLORS.white : COLORS.white20,
            }}
          >
            {amountText || '0.0'}
            {frame >= 88 && frame < 98 && <span style={{ color: COLORS.neonGreen }}>|</span>}
          </span>
        </div>
        <span
          style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, fontWeight: 600, color: COLORS.white40, fontFamily: FONTS.mono,
          }}
        >
          ETH
        </span>
      </div>
      <span style={{ fontSize: 11, color: COLORS.white40, marginTop: 6, display: 'block' }}>
        on Ethereum Sepolia
      </span>
    </div>

    <div
      style={{
        width: '100%', height: 48,
        backgroundColor: amountText ? COLORS.neonGreen : COLORS.white06,
        borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: amountText ? '0 2px 8px rgba(0,255,65,0.3)' : 'none',
        opacity: amountText ? 1 : 0.5,
        transform: previewClicking ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      <span
        style={{
          fontSize: 14, fontWeight: 600, fontFamily: FONTS.mono,
          color: amountText ? '#000' : COLORS.white40,
        }}
      >
        Preview Payment
      </span>
    </div>
  </div>
);

const ConfirmStep: React.FC<{
  opacity: number;
  sendClicking: boolean;
  showSpinner: boolean;
}> = ({ opacity, sendClicking, showSpinner }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity }}>
    {/* Summary — real: Amount / To / Network fee */}
    <div
      style={{
        padding: 16, backgroundColor: COLORS.white04, borderRadius: 2,
        border: `1px solid ${COLORS.white10}`,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono }}>Amount</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
          0.05 ETH
        </span>
      </div>
      <div style={{ height: 1, backgroundColor: COLORS.white10 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono }}>To</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.neonGreen, fontFamily: FONTS.mono }}>
          coffee-tips.alice.dust
        </span>
      </div>
      <div style={{ height: 1, backgroundColor: COLORS.white10 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: COLORS.white40, fontFamily: FONTS.mono }}>Network fee</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#22C55E', fontFamily: FONTS.mono }}>
          Free (sponsored)
        </span>
      </div>
    </div>

    {/* Privacy notice — real: lock icon + stealth text */}
    <div
      style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 12px', backgroundColor: COLORS.neonGreenBg,
        border: `1px solid ${COLORS.neonGreenBorder}`, borderRadius: 2,
      }}
    >
      <LockIcon size={13} color={COLORS.neonGreen} />
      <span style={{ fontSize: 11, color: COLORS.white50 }}>
        Uses a stealth address. Cannot be linked to the recipient.
      </span>
    </div>

    {/* Buttons — real: Back + Send Payment */}
    <div style={{ display: 'flex', gap: 8 }}>
      <div
        style={{
          flex: 1, height: 44, backgroundColor: COLORS.white06,
          border: `1px solid ${COLORS.white10}`, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.white50, fontFamily: FONTS.mono }}>
          Back
        </span>
      </div>
      <div
        style={{
          flex: 2, height: 44, backgroundColor: COLORS.neonGreen, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transform: sendClicking ? 'scale(0.97)' : 'scale(1)',
          boxShadow: '0 2px 8px rgba(0,255,65,0.3)',
        }}
      >
        {showSpinner ? (
          <>
            <div
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000', fontFamily: FONTS.mono }}>
              Sending...
            </span>
          </>
        ) : (
          <>
            <SendIcon size={14} color="#000" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000', fontFamily: FONTS.mono }}>
              Send Payment
            </span>
          </>
        )}
      </div>
    </div>
  </div>
);

const PaySuccess: React.FC<{ amount: string; scale: number }> = ({ amount, scale }) => (
  <div
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: '8px 0', transform: `scale(${scale})`,
    }}
  >
    <div
      style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
      }}
    >
      <CheckIcon size={32} color="#fff" />
    </div>
    <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
      Payment Sent!
    </span>
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontSize: 26, fontWeight: 700, color: COLORS.white, fontFamily: FONTS.mono }}>
        {amount}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.white40, fontFamily: FONTS.mono }}>
        ETH
      </span>
    </div>
    <span style={{ fontSize: 13, color: COLORS.white40 }}>
      sent to <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>coffee-tips.alice.dust</span>
    </span>
  </div>
);
