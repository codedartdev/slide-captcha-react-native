import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createSlideCaptchaClient } from '../client/createSlideCaptchaClient';
import { SlideCaptchaError, toSlideCaptchaError } from '../client/errors';
import type {
  SlideCaptchaMovementPoint,
  SlideCaptchaPosition,
  SlideCaptchaState,
  SlideCaptchaVerifyResponse,
  UseSlideCaptchaOptions,
  UseSlideCaptchaReturn,
} from '../client/types';

const initialState: SlideCaptchaState = {
  status: 'idle',
  position: { x: 0, y: 0 },
  rotation: 0,
  movements: [],
};
const maxMovementPoints = 300;

export function useSlideCaptcha(options: UseSlideCaptchaOptions): UseSlideCaptchaReturn {
  const { baseUrl, headers, fetcher, preload = true, onChange } = options;
  const [state, setState] = useState<SlideCaptchaState>(initialState);
  const stateRef = useRef(state);

  const client = useMemo(
    () => createSlideCaptchaClient({ baseUrl, headers, fetcher }),
    [baseUrl, fetcher, headers],
  );

  const updateState = useCallback((updater: (current: SlideCaptchaState) => SlideCaptchaState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    updateState((current) => ({
      ...current,
      status: 'loading',
      challenge: undefined,
      error: undefined,
      token: undefined,
      position: { x: 0, y: 0 },
      rotation: 0,
      movements: [],
    }));

    try {
      const challenge = await client.getChallenge();

      updateState((current) => ({
        ...current,
        status: 'ready',
        challenge,
        error: undefined,
        token: undefined,
        position: { x: 0, y: 0 },
        rotation: 0,
        movements: [],
      }));
    } catch (error) {
      const slideCaptchaError = toSlideCaptchaError(error);

      updateState((current) => ({
        ...current,
        status: 'error',
        challenge: undefined,
        error: slideCaptchaError,
      }));
    }
  }, [client, updateState]);

  const verify = useCallback(async (): Promise<SlideCaptchaVerifyResponse> => {
    const current = stateRef.current;

    if (!current.challenge) {
      const error = new SlideCaptchaError({
        code: 'invalid_challenge',
        message: 'No slide CAPTCHA challenge is loaded.',
      });

      updateState((previous) => ({
        ...previous,
        status: 'error',
        error,
      }));

      throw error;
    }

    updateState((previous) => ({
      ...previous,
      status: 'verifying',
      error: undefined,
    }));

    try {
      const response = await client.verifyChallenge({
        challenge_id: current.challenge.challenge_id,
        x: current.position.x,
        y: current.position.y,
        rotation: current.rotation,
        movements: current.movements,
      });

      if (!response.success) {
        throw new SlideCaptchaError({
          code: 'verification_failed',
          message: response.message ?? 'Slide CAPTCHA verification failed.',
          reason: response.reason,
          details: response,
        });
      }

      if (!response.token) {
        throw new SlideCaptchaError({
          code: 'invalid_verify_response',
          message: 'Slide CAPTCHA verify response did not include a token.',
          details: response,
        });
      }

      updateState((previous) => ({
        ...previous,
        status: 'success',
        token: response.token,
        error: undefined,
        movements: [],
      }));

      return response;
    } catch (error) {
      const slideCaptchaError = toSlideCaptchaError(error);

      updateState((previous) => ({
        ...previous,
        status: 'error',
        error: slideCaptchaError,
      }));

      throw slideCaptchaError;
    }
  }, [client, updateState]);

  const setPosition = useCallback(
    (position: SlideCaptchaPosition) => {
      updateState((current) => ({
        ...current,
        position,
      }));
    },
    [updateState],
  );

  const setRotation = useCallback(
    (rotation: number) => {
      updateState((current) => ({
        ...current,
        rotation,
      }));
    },
    [updateState],
  );

  const recordMovement = useCallback(
    (point: SlideCaptchaMovementPoint) => {
      updateState((current) => ({
        ...current,
        movements: [...current.movements, point].slice(-maxMovementPoints),
      }));
    },
    [updateState],
  );

  const resetInteraction = useCallback(() => {
    updateState((current) => ({
      ...current,
      position: { x: 0, y: 0 },
      rotation: 0,
      movements: [],
    }));
  }, [updateState]);

  useEffect(() => {
    stateRef.current = state;
    onChange?.(state);
  }, [onChange, state]);

  useEffect(() => {
    if (preload) {
      void refresh();
    }
  }, [preload, refresh]);

  return {
    state,
    refresh,
    verify,
    setPosition,
    setRotation,
    recordMovement,
    resetInteraction,
  };
}
