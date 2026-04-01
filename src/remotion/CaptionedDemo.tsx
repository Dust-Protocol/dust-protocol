import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  staticFile,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';

const FPS = 30;

interface Caption {
  text: string;
  sub?: string;
  from: number;
  to: number;
}

const CAPTIONS: Caption[] = [
  // 0:00–0:04 — Landing page
  { text: 'DUST PROTOCOL', sub: 'Private payments that dissolve into the blockchain', from: 0, to: 4 },

  // 0:05–0:16 — Privy modal → MetaMask connect → signature
  { text: 'One-click wallet connect', sub: 'Privy handles auth — Google, Twitter, Farcaster, or any wallet', from: 5, to: 16 },

  // 0:18–0:27 — Onboarding: username
  { text: 'Pick a human-readable name', sub: 'acc11.dust — your private payment address on Flow', from: 18, to: 27 },

  // 0:28–0:40 — PIN + recovery code + wallet signature
  { text: 'PIN creates your stealth keys', sub: '6-digit PIN + wallet signature → PBKDF2 → private keys that never leave the browser', from: 28, to: 40 },

  // 0:42–0:48 — Setting up wallet, ERC-6538 registration
  { text: 'Registering on-chain', sub: 'Stealth meta-address published to ERC-6538 registry on Flow EVM', from: 42, to: 48 },

  // 0:50–1:08 — Dashboard exploring
  { text: 'Your stealth wallet is live', sub: 'Private balance, ZK privacy pool, and .dust identity — all on Flow', from: 50, to: 64 },

  // 1:10–1:16 — Dashboard idle / exploring sections
  // (breathing room — no caption)

  // 1:18–1:24 — Receive modal with QR
  { text: 'Share your pay link', sub: 'Anyone can send you private payments — they never see your real address', from: 78, to: 84 },

  // 1:26–1:34 — New tab, navigate to /pay/acc11
  { text: 'Opening the pay link as a sender', sub: 'Simulating someone paying acc11.dust from a different wallet', from: 86, to: 94 },

  // 1:36–1:50 — Connect wallet on pay page, MetaMask accounts
  { text: 'Connecting the sender\'s wallet', sub: 'A different wallet sends a payment to acc11.dust via the pay link', from: 96, to: 108 },

  // 1:52–1:58 — Enter 200 FLOW, click preview
  { text: '200 FLOW to a stealth address', sub: 'The recipient address is a one-time address — unlinkable to acc11.dust on-chain', from: 112, to: 118 },

  // 2:00–2:16 — MetaMask confirm, sending, payment success
  { text: 'Payment confirmed', sub: 'Funds sent to 0x6830f... — a fresh address derived via ECDH. Fee: sponsored.', from: 120, to: 136 },

  // 2:18–2:28 — Flowscan verification
  { text: 'Verified on Flowscan', sub: '200 FLOW on-chain — the stealth address reveals nothing about acc11.dust', from: 138, to: 148 },

  // 2:30–2:52 — Second payment: 325 FLOW
  { text: 'Second payment: 325 FLOW', sub: 'New stealth address 0xCc509... — every payment gets a unique address. No reuse.', from: 152, to: 168 },

  // 2:54–3:00 — Flowscan second tx
  { text: 'Two payments, two different addresses', sub: 'On-chain, these look completely unrelated — only the recipient can connect them', from: 174, to: 182 },

  // 3:02–3:16 — Switch to receiver wallet, accounts, PIN screen
  { text: 'Switching to the receiver', sub: 'Now viewing from acc11.dust\'s perspective — entering PIN to unlock stealth keys', from: 184, to: 198 },

  // 3:18–3:30 — PIN entered, dashboard scanning, payments found
  { text: 'Scanning the blockchain...', sub: 'Stealth scanner found 525 FLOW across 2 incoming payments', from: 200, to: 212 },

  // 3:32–3:50 — Balance shows 525 FLOW, 2 unclaimed
  { text: '525 FLOW received privately', sub: '2 stealth payments detected and auto-claimed via ERC-4337 account abstraction', from: 212, to: 230 },

  // 3:52–4:04 — Dashboard idle, navigate to swap
  // (breathing room — no caption)

  // 4:04–4:12 — Swap page, enter PIN, privacy keys active
  { text: 'Private token swaps', sub: 'FLOW → USDC via PunchSwap V2 — the swap happens inside the ZK privacy pool', from: 242, to: 252 },

  // 4:14–4:22 — Shield/deposit modal
  { text: 'Shielding 2000 FLOW', sub: 'Depositing into the ZK-UTXO pool — amount hidden via Pedersen commitments', from: 254, to: 264 },

  // 4:24–4:42 — Shielding in progress → deposit successful
  { text: 'Deposit confirmed on-chain', sub: '2000 FLOW now shielded — FFLONK proof verified, no trusted setup required', from: 268, to: 282 },

  // 4:44–4:56 — Swap page, trying amounts, settle on 200
  { text: 'Configuring the swap', sub: 'Denomination privacy auto-splits into 100 FLOW chunks to hide the exact amount', from: 288, to: 300 },

  // 4:58–5:02 — 200 FLOW → 192.86 USDC, click swap
  { text: '200 FLOW → 192.86 USDC', sub: '2 chunks of 100 FLOW — each swapped separately with random delays', from: 298, to: 304 },

  // 5:04–5:22 — ZK proof generation, multi-step progress
  { text: 'ZK proof pipeline running', sub: 'Split proof → compliance → on-chain confirm → swap proof → batch submit', from: 306, to: 322 },

  // 5:24–5:28 — Swap complete!
  { text: '192.86 USDC received as shielded UTXOs', sub: 'Fully private swap — no one can see what you traded or how much', from: 324, to: 330 },

  // 5:30–5:44 — Flowscan transaction details
  { text: 'DUST PROTOCOL', sub: 'Financial privacy on Flow — built for PL Genesis Hackathon', from: 332, to: 343 },
];

const CaptionOverlay: React.FC<{ caption: Caption }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localDuration = (caption.to - caption.from) * fps;

  const fadeIn = spring({ frame, fps, config: { damping: 30, stiffness: 120 } });
  const fadeOut = interpolate(
    frame,
    [localDuration - 15, localDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const slideUp = interpolate(fadeIn, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 16,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideUp}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '8px 20px',
          borderRadius: 6,
          background: 'rgba(6, 8, 15, 0.75)',
          border: '1px solid rgba(0, 255, 65, 0.12)',
          backdropFilter: 'blur(8px)',
          maxWidth: '70%',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
            fontSize: 18,
            fontWeight: 700,
            color: '#00FF41',
            letterSpacing: '0.04em',
            textAlign: 'center',
            textShadow: '0 0 12px rgba(0,255,65,0.25)',
          }}
        >
          {caption.text}
        </div>
        {caption.sub && (
          <div
            style={{
              fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
              fontSize: 12,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {caption.sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const VOICEOVERS = [
  { file: 'vo/vo_01.mp3', from: 0 },
  { file: 'vo/vo_02.mp3', from: 5 },
  { file: 'vo/vo_03.mp3', from: 18 },
  { file: 'vo/vo_04.mp3', from: 28 },
  { file: 'vo/vo_05.mp3', from: 42 },
  { file: 'vo/vo_06.mp3', from: 50 },
  { file: 'vo/vo_07.mp3', from: 78 },
  { file: 'vo/vo_08.mp3', from: 86 },
  { file: 'vo/vo_09.mp3', from: 96 },
  { file: 'vo/vo_10.mp3', from: 120 },
  { file: 'vo/vo_11.mp3', from: 138 },
  { file: 'vo/vo_12.mp3', from: 152 },
  { file: 'vo/vo_13.mp3', from: 174 },
  { file: 'vo/vo_14.mp3', from: 184 },
  { file: 'vo/vo_15.mp3', from: 200 },
  { file: 'vo/vo_16.mp3', from: 212 },
  { file: 'vo/vo_17.mp3', from: 242 },
  { file: 'vo/vo_18.mp3', from: 254 },
  { file: 'vo/vo_19.mp3', from: 268 },
  { file: 'vo/vo_20.mp3', from: 288 },
  { file: 'vo/vo_21.mp3', from: 298 },
  { file: 'vo/vo_22.mp3', from: 306 },
  { file: 'vo/vo_23.mp3', from: 324 },
  { file: 'vo/vo_24.mp3', from: 332 },
];

export const CaptionedDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video
        src={staticFile('demo-recording.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {CAPTIONS.map((cap, i) => (
        <Sequence
          key={`cap-${i}`}
          from={cap.from * FPS}
          durationInFrames={(cap.to - cap.from) * FPS}
          name={cap.text.slice(0, 30)}
        >
          <CaptionOverlay caption={cap} />
        </Sequence>
      ))}
      {VOICEOVERS.map((vo, i) => (
        <Sequence key={`vo-${i}`} from={vo.from * FPS} name={`VO ${i + 1}`}>
          <Audio src={staticFile(vo.file)} volume={0.9} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
