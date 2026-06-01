import { describe, expect, it, vi } from 'vitest';

import { createSlideCaptchaClient } from '../src/client/createSlideCaptchaClient';
import { SlideCaptchaError } from '../src/client/errors';
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

describe('createSlideCaptchaClient', () => {
  it('loads a challenge with a normalized base URL and configured headers', async () => {
    const fetcher = vi.fn(async () => jsonResponse(challenge));
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test/',
      headers: {
        Authorization: 'Bearer token',
      },
      fetcher,
    });

    await expect(client.getChallenge()).resolves.toEqual(challenge);
    expect(fetcher).toHaveBeenCalledWith('http://api.example.test/slide-captcha/new', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token',
      },
    });
  });

  it('verifies a challenge with JSON payload and configured headers', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ success: true, token: 'token-1' }));
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      headers: {
        Accept: 'application/json',
      },
      fetcher,
    });
    const payload = {
      challenge_id: 'challenge-1',
      x: 120,
      y: 4,
      rotation: 15,
      movements: [{ x: 120, y: 4, r: 15, t: 320 }],
    };

    await expect(client.verifyChallenge(payload)).resolves.toEqual({
      success: true,
      token: 'token-1',
      reason: undefined,
      message: undefined,
    });
    expect(fetcher).toHaveBeenCalledWith('http://api.example.test/slide-captcha/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  });

  it('returns a backend verification failure response without throwing', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ success: false, reason: 'mismatch', message: 'Try again.' }),
    );
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(
      client.verifyChallenge({
        challenge_id: 'challenge-1',
        x: 0,
        y: 0,
        rotation: 0,
        movements: [],
      }),
    ).resolves.toEqual({
      success: false,
      token: undefined,
      reason: 'mismatch',
      message: 'Try again.',
    });
  });

  it('normalizes network errors', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(client.getChallenge()).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it('normalizes invalid JSON', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid');
      },
    }));
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(client.getChallenge()).rejects.toMatchObject({
      code: 'invalid_json',
    });
  });

  it('normalizes backend HTTP errors', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ message: 'Expired challenge.', reason: 'expired' }, false, 422),
    );
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(client.getChallenge()).rejects.toMatchObject({
      code: 'http_error',
      status: 422,
      reason: 'expired',
      message: 'Expired challenge.',
    });
  });

  it('validates challenge payloads minimally', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ...challenge, image_width: 0 }));
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(client.getChallenge()).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
  });

  it('rejects enabled rotation challenges without a positive step', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        ...challenge,
        rotation_enabled: true,
        rotation_step: 0,
      }),
    );
    const client = createSlideCaptchaClient({
      baseUrl: 'http://api.example.test',
      fetcher,
    });

    await expect(client.getChallenge()).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
  });

  it('rejects invalid base URLs', () => {
    expect(() =>
      createSlideCaptchaClient({
        baseUrl: '/relative',
        fetcher: vi.fn() as unknown as SlideCaptchaFetcher,
      }),
    ).toThrow(SlideCaptchaError);
  });
});
