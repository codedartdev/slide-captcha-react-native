import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { SlideCaptcha } from '../src/components/SlideCaptcha';
import type { SlideCaptchaChallenge, SlideCaptchaFetcher } from '../src/client/types';

const challenge: SlideCaptchaChallenge = {
  challenge_id: 'challenge-1',
  background_url: 'http://example.test/background.png',
  piece_url: 'http://example.test/piece.png',
  piece_width: 64,
  piece_height: 64,
  image_width: 320,
  image_height: 180,
  rotation_enabled: true,
  rotation_step: 15,
};

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

function waitForEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SlideCaptcha', () => {
  it('preloads the challenge while staying hidden until visible is true', async () => {
    const fetcher = vi.fn(async () => jsonResponse(challenge));
    const onSuccess = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <SlideCaptcha
          baseUrl="http://api.example.test"
          visible={false}
          fetcher={fetcher}
          onSuccess={onSuccess}
        />,
      );
      await waitForEffects();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(renderer!.toJSON()).toBeNull();

    await act(async () => {
      renderer!.update(
        <SlideCaptcha
          baseUrl="http://api.example.test"
          visible
          fetcher={fetcher}
          onSuccess={onSuccess}
        />,
      );
      await waitForEffects();
    });

    expect(renderer!.root.findAll((node) => (node.type as unknown) === 'Modal')).toHaveLength(1);
  });

  it('calls onSuccess after verification succeeds and preloads the next challenge', async () => {
    const fetcher: SlideCaptchaFetcher = vi.fn(async (url) => {
      if (url.endsWith('/slide-captcha/verify')) {
        return jsonResponse({ success: true, token: 'token-1' });
      }

      return jsonResponse(challenge);
    });
    const onSuccess = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <SlideCaptcha
          baseUrl="http://api.example.test"
          visible
          fetcher={fetcher}
          onSuccess={onSuccess}
        />,
      );
      await waitForEffects();
    });

    const verifyButton = renderer!.root.findByProps({ accessibilityLabel: 'Verify' });

    await act(async () => {
      await verifyButton.props.onPress();
      await waitForEffects();
    });

    expect(onSuccess).toHaveBeenCalledWith('token-1');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://api.example.test/slide-captcha/verify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('reports verification failures through onError', async () => {
    const fetcher: SlideCaptchaFetcher = vi.fn(async (url) => {
      if (url.endsWith('/slide-captcha/verify')) {
        return jsonResponse({
          success: false,
          reason: 'mismatch',
          message: 'Try again.',
        });
      }

      return jsonResponse(challenge);
    });
    const onError = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <SlideCaptcha
          baseUrl="http://api.example.test"
          visible
          fetcher={fetcher}
          onSuccess={vi.fn()}
          onError={onError}
        />,
      );
      await waitForEffects();
    });

    const verifyButton = renderer!.root.findByProps({ accessibilityLabel: 'Verify' });

    await act(async () => {
      await verifyButton.props.onPress();
      await waitForEffects();
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'verification_failed',
        reason: 'mismatch',
      }),
    );
  });
});
