import { SlideCaptchaError } from './errors';
import type {
  SlideCaptchaChallenge,
  SlideCaptchaClientOptions,
  SlideCaptchaFetcher,
  SlideCaptchaFetchResponse,
  SlideCaptchaVerifyPayload,
  SlideCaptchaVerifyResponse,
} from './types';

export interface SlideCaptchaClient {
  getChallenge: () => Promise<SlideCaptchaChallenge>;
  verifyChallenge: (payload: SlideCaptchaVerifyPayload) => Promise<SlideCaptchaVerifyResponse>;
}

const challengePath = '/slide-captcha/new';
const verifyPath = '/slide-captcha/verify';

export function createSlideCaptchaClient(options: SlideCaptchaClientOptions): SlideCaptchaClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher: SlideCaptchaFetcher = options.fetcher ?? getGlobalFetcher();

  return {
    async getChallenge() {
      const data = await requestJson(fetcher, buildUrl(baseUrl, challengePath), {
        method: 'GET',
        headers: options.headers,
      });

      return parseChallenge(data);
    },

    async verifyChallenge(payload) {
      validateVerifyPayload(payload);

      const data = await requestJson(fetcher, buildUrl(baseUrl, verifyPath), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(payload),
      });

      return parseVerifyResponse(data);
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');

  if (!/^https?:\/\/.+/i.test(normalized)) {
    throw new SlideCaptchaError({
      code: 'invalid_base_url',
      message: 'Slide CAPTCHA baseUrl must be an absolute http(s) URL.',
      details: { baseUrl },
    });
  }

  return normalized;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function getGlobalFetcher(): SlideCaptchaFetcher {
  const fetcher = globalThis.fetch;

  if (typeof fetcher !== 'function') {
    throw new SlideCaptchaError({
      code: 'missing_fetcher',
      message: 'No fetch implementation is available. Pass a custom fetcher option.',
    });
  }

  return (url, init) =>
    (fetcher as (input: string, init?: unknown) => Promise<unknown>)(
      url,
      init,
    ) as Promise<SlideCaptchaFetchResponse>;
}

async function requestJson(
  fetcher: SlideCaptchaFetcher,
  url: string,
  init: Parameters<SlideCaptchaFetcher>[1],
): Promise<unknown> {
  let response: SlideCaptchaFetchResponse;

  try {
    response = await fetcher(url, init);
  } catch (error) {
    throw new SlideCaptchaError({
      code: 'network_error',
      message: 'Unable to connect to the slide CAPTCHA server.',
      cause: error,
    });
  }

  const data = await readJson(response);

  if (!response.ok) {
    const backendError = asRecord(data);
    const message = readOptionalString(backendError, 'message');
    const reason = readOptionalString(backendError, 'reason');

    throw new SlideCaptchaError({
      code: 'http_error',
      message: message ?? `Slide CAPTCHA request failed with status ${response.status}.`,
      status: response.status,
      reason,
      details: data,
    });
  }

  return data;
}

async function readJson(response: SlideCaptchaFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new SlideCaptchaError({
      code: 'invalid_json',
      message: 'Slide CAPTCHA server returned invalid JSON.',
      status: response.status,
      cause: error,
    });
  }
}

function parseChallenge(data: unknown): SlideCaptchaChallenge {
  const record = asRecord(data);

  if (
    !record ||
    !isNonEmptyString(record.challenge_id) ||
    !isNonEmptyString(record.background_url) ||
    !isNonEmptyString(record.piece_url) ||
    !isPositiveNumber(record.piece_width) ||
    !isPositiveNumber(record.piece_height) ||
    !isPositiveNumber(record.image_width) ||
    !isPositiveNumber(record.image_height) ||
    typeof record.rotation_enabled !== 'boolean' ||
    !isNumber(record.rotation_step) ||
    (record.rotation_enabled && record.rotation_step <= 0)
  ) {
    throw new SlideCaptchaError({
      code: 'invalid_challenge',
      message: 'Slide CAPTCHA challenge response is missing required fields.',
      details: data,
    });
  }

  return {
    challenge_id: record.challenge_id,
    background_url: record.background_url,
    piece_url: record.piece_url,
    piece_width: record.piece_width,
    piece_height: record.piece_height,
    image_width: record.image_width,
    image_height: record.image_height,
    rotation_enabled: record.rotation_enabled,
    rotation_step: record.rotation_step,
  };
}

function parseVerifyResponse(data: unknown): SlideCaptchaVerifyResponse {
  const record = asRecord(data);

  if (!record || typeof record.success !== 'boolean') {
    throw new SlideCaptchaError({
      code: 'invalid_verify_response',
      message: 'Slide CAPTCHA verify response is missing required fields.',
      details: data,
    });
  }

  return {
    success: record.success,
    token: readOptionalString(record, 'token'),
    reason: readOptionalString(record, 'reason'),
    message: readOptionalString(record, 'message'),
  };
}

function validateVerifyPayload(payload: SlideCaptchaVerifyPayload): void {
  if (
    !isNonEmptyString(payload.challenge_id) ||
    !isNumber(payload.x) ||
    !isNumber(payload.y) ||
    !isNumber(payload.rotation) ||
    !Array.isArray(payload.movements) ||
    payload.movements.some(
      (point) =>
        !isNumber(point.x) || !isNumber(point.y) || !isNumber(point.r) || !isNumber(point.t),
    )
  ) {
    throw new SlideCaptchaError({
      code: 'invalid_verify_payload',
      message: 'Slide CAPTCHA verify payload is invalid.',
      details: payload,
    });
  }
}

function asRecord(value: unknown): Record<string, any> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, any>;
}

function readOptionalString(record: Record<string, any> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}
