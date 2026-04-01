import { interpolate, spring, Easing } from 'remotion';

export function fadeIn(frame: number, startFrame: number, duration = 15) {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function fadeOut(frame: number, startFrame: number, duration = 15) {
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function slideUp(frame: number, startFrame: number, distance = 30, duration = 20) {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function slideDown(frame: number, startFrame: number, distance = 30, duration = 20) {
  return interpolate(frame, [startFrame, startFrame + duration], [-distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function slideLeft(frame: number, startFrame: number, distance = 40, duration = 20) {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function scaleIn(frame: number, fps: number, delay = 0) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });
}

export function typeText(text: string, frame: number, startFrame: number, charsPerFrame = 0.5): string {
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.floor(elapsed * charsPerFrame);
  return text.slice(0, Math.min(chars, text.length));
}

export function pulseGlow(frame: number, fps: number, speed = 1): number {
  return 0.3 + 0.2 * Math.sin((frame / fps) * Math.PI * 2 * speed);
}

export function staggerDelay(index: number, baseDelay: number, staggerAmount = 5): number {
  return baseDelay + index * staggerAmount;
}

export function cursorBlink(frame: number, fps: number): boolean {
  return Math.floor((frame / fps) * 2) % 2 === 0;
}

export function countUp(frame: number, startFrame: number, endValue: number, duration = 30): number {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return progress * endValue;
}

export function sceneFade(frame: number, sceneStart: number, sceneDuration: number, fadeDuration = 10) {
  const fadeInOp = fadeIn(frame, sceneStart, fadeDuration);
  const fadeOutOp = fadeOut(frame, sceneStart + sceneDuration - fadeDuration, fadeDuration);
  return Math.min(fadeInOp, fadeOutOp);
}
