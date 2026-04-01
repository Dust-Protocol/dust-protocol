import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SCENES } from './styles/theme';
import { IntroScene } from './scenes/01-Intro';
import { LandingScene } from './scenes/02-Landing';
import { OnboardingScene } from './scenes/03-Onboarding';
import { DashboardScene } from './scenes/04-Dashboard';
import { ReceiveScene } from './scenes/05-Receive';
import { SenderPaysScene } from './scenes/06-SenderPays';
import { PaymentArrivesScene } from './scenes/07-PaymentArrives';
import { SendFlowScene } from './scenes/08-SendFlow';
import { CustomLinkScene } from './scenes/09-CustomLink';
import { SwapScene } from './scenes/10-Swap';
import { ActivityScene } from './scenes/11-Activity';

export const DustProtocolDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#06080F' }}>
      <Sequence from={SCENES.intro.start} durationInFrames={SCENES.intro.duration} name="Intro">
        <IntroScene />
      </Sequence>
      <Sequence from={SCENES.landing.start} durationInFrames={SCENES.landing.duration} name="Landing">
        <LandingScene />
      </Sequence>
      <Sequence from={SCENES.onboarding.start} durationInFrames={SCENES.onboarding.duration} name="Onboarding">
        <OnboardingScene />
      </Sequence>
      <Sequence from={SCENES.dashboard.start} durationInFrames={SCENES.dashboard.duration} name="Dashboard">
        <DashboardScene />
      </Sequence>
      <Sequence from={SCENES.receive.start} durationInFrames={SCENES.receive.duration} name="Receive">
        <ReceiveScene />
      </Sequence>
      <Sequence from={SCENES.senderPays.start} durationInFrames={SCENES.senderPays.duration} name="SenderPays">
        <SenderPaysScene />
      </Sequence>
      <Sequence from={SCENES.paymentArrives.start} durationInFrames={SCENES.paymentArrives.duration} name="PaymentArrives">
        <PaymentArrivesScene />
      </Sequence>
      <Sequence from={SCENES.send.start} durationInFrames={SCENES.send.duration} name="SendFlow">
        <SendFlowScene />
      </Sequence>
      <Sequence from={SCENES.customLink.start} durationInFrames={SCENES.customLink.duration} name="CustomLink">
        <CustomLinkScene />
      </Sequence>
      <Sequence from={SCENES.swap.start} durationInFrames={SCENES.swap.duration} name="SwapFlow">
        <SwapScene />
      </Sequence>
      <Sequence from={SCENES.activity.start} durationInFrames={SCENES.activity.duration} name="Activity">
        <ActivityScene />
      </Sequence>
    </AbsoluteFill>
  );
};
