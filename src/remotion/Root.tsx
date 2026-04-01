import React from 'react';
import { Composition } from 'remotion';
import { VIDEO, SCENES } from './styles/theme';
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
import { DustProtocolDemo } from './Video';
import { CaptionedDemo } from './CaptionedDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CaptionedDemo"
        component={CaptionedDemo}
        durationInFrames={10317}
        fps={30}
        width={1660}
        height={1080}
      />
      <Composition
        id="DustProtocolDemo"
        component={DustProtocolDemo}
        durationInFrames={VIDEO.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />

      <Composition
        id="Intro"
        component={IntroScene}
        durationInFrames={SCENES.intro.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Landing"
        component={LandingScene}
        durationInFrames={SCENES.landing.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Onboarding"
        component={OnboardingScene}
        durationInFrames={SCENES.onboarding.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Dashboard"
        component={DashboardScene}
        durationInFrames={SCENES.dashboard.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Receive"
        component={ReceiveScene}
        durationInFrames={SCENES.receive.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="SenderPays"
        component={SenderPaysScene}
        durationInFrames={SCENES.senderPays.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="PaymentArrives"
        component={PaymentArrivesScene}
        durationInFrames={SCENES.paymentArrives.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="SendFlow"
        component={SendFlowScene}
        durationInFrames={SCENES.send.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="CustomLink"
        component={CustomLinkScene}
        durationInFrames={SCENES.customLink.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="SwapFlow"
        component={SwapScene}
        durationInFrames={SCENES.swap.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Activity"
        component={ActivityScene}
        durationInFrames={SCENES.activity.duration}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
