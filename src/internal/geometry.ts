import type { SlideCaptchaChallenge, SlideCaptchaPosition } from '../client/types';

export interface SlideCaptchaRenderedLayout {
  imageWidth: number;
  imageHeight: number;
  pieceWidth: number;
  pieceHeight: number;
  scale: number;
}

export function getRenderedLayout(
  challenge: SlideCaptchaChallenge,
  availableWidth: number,
): SlideCaptchaRenderedLayout {
  const imageWidth = Math.max(1, Math.min(availableWidth, challenge.image_width));
  const scale = imageWidth / challenge.image_width;

  return {
    imageWidth,
    imageHeight: challenge.image_height * scale,
    pieceWidth: challenge.piece_width * scale,
    pieceHeight: challenge.piece_height * scale,
    scale,
  };
}

export function clampPosition(
  position: SlideCaptchaPosition,
  maxX: number,
  maxY: number,
): SlideCaptchaPosition {
  return {
    x: clamp(position.x, 0, maxX),
    y: clamp(position.y, 0, maxY),
  };
}

export function renderedToBackendPosition(
  renderedPosition: SlideCaptchaPosition,
  layout: SlideCaptchaRenderedLayout,
  challenge: SlideCaptchaChallenge,
): SlideCaptchaPosition {
  const backendPosition = {
    x: Math.round(renderedPosition.x / layout.scale),
    y: Math.round(renderedPosition.y / layout.scale),
  };

  return clampPosition(
    backendPosition,
    challenge.image_width - challenge.piece_width,
    challenge.image_height - challenge.piece_height,
  );
}

export function backendToRenderedPosition(
  backendPosition: SlideCaptchaPosition,
  layout: SlideCaptchaRenderedLayout,
): SlideCaptchaPosition {
  return {
    x: backendPosition.x * layout.scale,
    y: backendPosition.y * layout.scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
