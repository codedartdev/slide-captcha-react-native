export type SlideCaptchaErrorCode =
  | 'invalid_base_url'
  | 'missing_fetcher'
  | 'network_error'
  | 'http_error'
  | 'invalid_json'
  | 'invalid_challenge'
  | 'invalid_verify_payload'
  | 'invalid_verify_response'
  | 'verification_failed';

export interface SlideCaptchaErrorOptions {
  code: SlideCaptchaErrorCode;
  message: string;
  status?: number;
  reason?: string;
  details?: unknown;
  cause?: unknown;
}

export class SlideCaptchaError extends Error {
  readonly code: SlideCaptchaErrorCode;
  readonly status?: number;
  readonly reason?: string;
  readonly details?: unknown;

  constructor(options: SlideCaptchaErrorOptions) {
    super(options.message);
    this.name = 'SlideCaptchaError';
    this.code = options.code;
    this.status = options.status;
    this.reason = options.reason;
    this.details = options.details;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function toSlideCaptchaError(error: unknown): SlideCaptchaError {
  if (error instanceof SlideCaptchaError) {
    return error;
  }

  return new SlideCaptchaError({
    code: 'network_error',
    message: 'Unable to connect to the slide CAPTCHA server.',
    cause: error,
  });
}
