import { describe, expect, it } from 'vitest';

import {
  backendToRenderedPosition,
  clampPosition,
  getRenderedLayout,
  renderedToBackendPosition,
} from '../src/internal/geometry';
import type { SlideCaptchaChallenge } from '../src/client/types';

const challenge: SlideCaptchaChallenge = {
  challenge_id: 'challenge-1',
  background_url: 'http://example.test/background.png',
  piece_url: 'http://example.test/piece.png',
  piece_width: 80,
  piece_height: 60,
  image_width: 400,
  image_height: 200,
  rotation_enabled: false,
  rotation_step: 0,
};

describe('geometry helpers', () => {
  it('scales challenge dimensions to the available rendered width', () => {
    expect(getRenderedLayout(challenge, 200)).toEqual({
      imageWidth: 200,
      imageHeight: 100,
      pieceWidth: 40,
      pieceHeight: 30,
      scale: 0.5,
    });
  });

  it('does not render wider than the real image', () => {
    expect(getRenderedLayout(challenge, 800).imageWidth).toBe(400);
  });

  it('clamps positions inside bounds', () => {
    expect(clampPosition({ x: -10, y: 300 }, 120, 80)).toEqual({
      x: 0,
      y: 80,
    });
  });

  it('converts rendered coordinates to backend coordinates', () => {
    const layout = getRenderedLayout(challenge, 200);

    expect(renderedToBackendPosition({ x: 75, y: 21 }, layout, challenge)).toEqual({
      x: 150,
      y: 42,
    });
  });

  it('clamps backend coordinates against the piece size', () => {
    const layout = getRenderedLayout(challenge, 200);

    expect(renderedToBackendPosition({ x: 500, y: 500 }, layout, challenge)).toEqual({
      x: 320,
      y: 140,
    });
  });

  it('converts backend coordinates to rendered coordinates', () => {
    const layout = getRenderedLayout(challenge, 200);

    expect(backendToRenderedPosition({ x: 150, y: 42 }, layout)).toEqual({
      x: 75,
      y: 21,
    });
  });
});
