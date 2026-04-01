import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Background } from '../components/Background';
import { CornerAccents } from '../components/CornerAccents';
import { COLORS, FONTS } from '../styles/theme';
import { fadeIn, slideUp, typeText, sceneFade, scaleIn } from '../utils/animations';

const STEPS_COUNT = 2;

function ProgressDots({ currentIndex }: { currentIndex: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {Array.from({ length: STEPS_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor:
                i < currentIndex
                  ? 'rgba(0,255,65,0.5)'
                  : i === currentIndex
                    ? 'rgba(255,255,255,0.8)'
                    : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          fontFamily: FONTS.mono,
          letterSpacing: '0.05em',
        }}
      >
        Step {Math.min(currentIndex + 1, STEPS_COUNT)} of {STEPS_COUNT}
        {currentIndex === 0 && ' · ~30 seconds'}
        {currentIndex === 1 && ' · ~30 seconds'}
        {currentIndex === 2 && ' · ~15 seconds'}
      </span>
    </div>
  );
}

function PinBoxes({ filledCount, focused }: { filledCount: number; focused: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const isFilled = i < filledCount;
        const isFocused = focused && i === filledCount;
        return (
          <div
            key={i}
            style={{
              width: 44,
              height: 52,
              borderRadius: 2,
              border: `1px solid ${isFocused ? COLORS.neonGreen : isFilled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isFilled && (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: COLORS.white,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function GreenButton({ label, enabled = true }: { label: string; enabled?: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: 44,
        borderRadius: 2,
        backgroundColor: enabled ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${enabled ? 'rgba(0,255,65,0.2)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: enabled ? COLORS.neonGreen : 'rgba(255,255,255,0.3)',
          fontFamily: FONTS.mono,
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function WarningBox({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 2,
        border: '1px solid rgba(255,176,0,0.3)',
        backgroundColor: 'rgba(255,176,0,0.06)',
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          color: COLORS.amber,
          marginBottom: 4,
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 11,
          fontFamily: FONTS.mono,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: COLORS.white,
          letterSpacing: '-0.01em',
          margin: 0,
          fontFamily: FONTS.mono,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: FONTS.mono,
          margin: 0,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

export const OnboardingScene: React.FC = () => {
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

  // --- Frame ranges ---
  // Username: 10–70
  // Create PIN: 70–115
  // Confirm PIN: 115–145
  // Activating: 145–180
  // Success: 180–210

  // Username typing
  const usernameTyped = typeText('alice', frame, 20, 0.25);
  const availableOpacity = fadeIn(frame, 42, 8);

  // Create PIN: one dot every 5 frames starting at 78
  const createPinFilled = Math.min(6, Math.max(0, Math.floor((frame - 78) / 5) + 1));

  // Confirm PIN: one dot every 4 frames starting at 122
  const confirmPinFilled = Math.min(6, Math.max(0, Math.floor((frame - 122) / 4) + 1));

  // Activating spinner
  const spinnerRotation = (frame - 145) * 12;

  // Success
  const successScale = scaleIn(frame, fps, 180);
  const successOpacity = fadeIn(frame, 180, 5);
  const finalFade = frame >= 200
    ? interpolate(frame, [200, 210], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  // Progress dot index
  let currentIndex = 0;
  if (frame >= 70) currentIndex = 1;

  // Activating/success: show final step
  const isActivatingOrSuccess = frame >= 165;

  return (
    <Background>
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: modalOpacity,
          }}
        >
          {/* Modal card — matches OnboardingWizard wrapper */}
          <div
            style={{
              position: 'relative',
              width: 420,
              backgroundColor: 'rgba(6,8,15,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
              transform: `scale(${modalScale})`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CornerAccents />

            {/* Progress dots + step indicator */}
            {!isActivatingOrSuccess && (
              <ProgressDots currentIndex={currentIndex} />
            )}

            {/* Content area */}
            <div style={{ padding: '24px 28px 32px 28px' }}>

              {/* Step 1: Username (frames 10–55) */}
              {frame >= 10 && frame < 70 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: fadeIn(frame, 10, 8),
                    transform: `translateY(${slideUp(frame, 10, 12, 8)}px)`,
                  }}
                >
                  <StepHeader
                    title="[ USERNAME ]"
                    subtitle="How others will find and pay you"
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Input field */}
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '100%',
                          padding: '12px 65px 12px 12px',
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${usernameTyped.length > 0 ? COLORS.neonGreen : 'rgba(255,255,255,0.1)'}`,
                          fontFamily: FONTS.mono,
                          fontSize: 14,
                          color: usernameTyped.length > 0 ? COLORS.white : 'rgba(255,255,255,0.2)',
                          boxSizing: 'border-box',
                        }}
                      >
                        {usernameTyped || 'yourname'}
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.3)',
                          fontFamily: FONTS.mono,
                        }}
                      >
                        .dust
                      </span>
                    </div>

                    {/* Availability status — fixed height */}
                    <div style={{ height: 18, paddingLeft: 2 }}>
                      {frame >= 35 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            opacity: availableOpacity,
                          }}
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <circle cx={12} cy={12} r={10} stroke="#22C55E" strokeWidth={2} />
                            <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span
                            style={{
                              fontSize: 12,
                              color: 'rgba(34,197,94,0.8)',
                              fontWeight: 500,
                              fontFamily: FONTS.mono,
                            }}
                          >
                            alice.dust is available
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <GreenButton label="Continue" enabled={frame >= 35} />

                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: FONTS.mono,
                    }}
                  >
                    Already have an account? Reclaim it
                  </div>
                </div>
              )}

              {/* Step 2a: Create PIN (frames 55–95) */}
              {frame >= 70 && frame < 115 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: fadeIn(frame, 55, 8),
                    transform: `translateY(${slideUp(frame, 55, 12, 8)}px)`,
                  }}
                >
                  <StepHeader
                    title="[ CREATE PIN ]"
                    subtitle="Your PIN + wallet signature creates your stealth keys"
                  />

                  <WarningBox
                    title="IMPORTANT"
                    body="Choose a PIN you can remember. You will receive a recovery code on the next step in case you forget it."
                  />

                  <PinBoxes
                    filledCount={frame >= 70 && frame < 115 ? createPinFilled : 0}
                    focused={frame >= 70 && frame < 115}
                  />

                  <GreenButton label="Continue" enabled={createPinFilled >= 6} />

                  <p
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: FONTS.mono,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    A recovery code will be provided after confirmation.
                  </p>
                </div>
              )}

              {/* Step 2b: Confirm PIN (frames 95–125) */}
              {frame >= 115 && frame < 145 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: fadeIn(frame, 95, 8),
                    transform: `translateY(${slideUp(frame, 95, 12, 8)}px)`,
                  }}
                >
                  <StepHeader
                    title="[ CONFIRM PIN ]"
                    subtitle="Enter the same PIN to confirm"
                  />

                  <WarningBox
                    title="IMPORTANT"
                    body="Choose a PIN you can remember. You will receive a recovery code on the next step in case you forget it."
                  />

                  <PinBoxes
                    filledCount={frame >= 115 && frame < 145 ? confirmPinFilled : 0}
                    focused={frame >= 115 && frame < 145}
                  />

                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* Back button */}
                    <div
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.5)',
                          fontFamily: FONTS.mono,
                          letterSpacing: '0.08em',
                        }}
                      >
                        Back
                      </span>
                    </div>
                    {/* Confirm button */}
                    <div
                      style={{
                        flex: 2,
                        height: 44,
                        borderRadius: 2,
                        backgroundColor: confirmPinFilled >= 6 ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${confirmPinFilled >= 6 ? 'rgba(0,255,65,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: confirmPinFilled >= 6 ? COLORS.neonGreen : 'rgba(255,255,255,0.3)',
                          fontFamily: FONTS.mono,
                          letterSpacing: '0.08em',
                        }}
                      >
                        Confirm
                      </span>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: FONTS.mono,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    A recovery code will be provided after confirmation.
                  </p>
                </div>
              )}

              {/* Activating (frames 145–180) */}
              {frame >= 145 && frame < 180 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: fadeIn(frame, 145, 8),
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <p
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: COLORS.white,
                        letterSpacing: '-0.01em',
                        margin: 0,
                        fontFamily: FONTS.mono,
                      }}
                    >
                      Setting up your wallet
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.4)',
                        margin: 0,
                      }}
                    >
                      Creating your private identity...
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.25)',
                        margin: 0,
                      }}
                    >
                      Registering on Thanos Sepolia
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      justifyContent: 'center',
                      padding: '32px 0',
                    }}
                  >
                    {/* Spinner */}
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.1)',
                        borderTopColor: 'rgba(0,255,65,0.8)',
                        transform: `rotate(${spinnerRotation}deg)`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.5)',
                        fontFamily: FONTS.mono,
                      }}
                    >
                      Please wait...
                    </span>
                  </div>
                </div>
              )}

              {/* Success (frames 190–210) */}
              {frame >= 180 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: successOpacity * finalFade,
                    transform: `scale(${successScale})`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    {/* Green checkmark circle */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,255,65,0.1)',
                        border: '1px solid rgba(0,255,65,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,65,0.8)" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: COLORS.white,
                        letterSpacing: '-0.01em',
                        margin: 0,
                        fontFamily: FONTS.mono,
                      }}
                    >
                      Your private wallet is ready!
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.4)',
                        margin: 0,
                      }}
                    >
                      Redirecting to dashboard...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Background>
  );
};
