import type { StyleProp, ViewStyle } from 'react-native';

import type { SlideCaptchaError } from './errors';

export type SlideCaptchaStatus = 'idle' | 'loading' | 'ready' | 'verifying' | 'success' | 'error';

export type SlideCaptchaHeaders = Record<string, string>;

export interface SlideCaptchaFetchRequestInit {
  method?: string;
  headers?: SlideCaptchaHeaders;
  body?: string;
}

export interface SlideCaptchaFetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<unknown>;
}

export type SlideCaptchaFetcher = (
  url: string,
  init?: SlideCaptchaFetchRequestInit,
) => Promise<SlideCaptchaFetchResponse>;

export interface SlideCaptchaClientOptions {
  baseUrl: string;
  headers?: SlideCaptchaHeaders;
  fetcher?: SlideCaptchaFetcher;
}

export interface SlideCaptchaChallenge {
  challenge_id: string;
  background_url: string;
  piece_url: string;
  piece_width: number;
  piece_height: number;
  image_width: number;
  image_height: number;
  rotation_enabled: boolean;
  rotation_step: number;
}

export interface SlideCaptchaMovementPoint {
  x: number;
  y: number;
  r: number;
  t: number;
}

export interface SlideCaptchaVerifyPayload {
  challenge_id: string;
  x: number;
  y: number;
  rotation: number;
  movements: SlideCaptchaMovementPoint[];
}

export interface SlideCaptchaVerifyResponse {
  success: boolean;
  token?: string;
  reason?: string;
  message?: string;
}

export interface SlideCaptchaPosition {
  x: number;
  y: number;
}

export interface SlideCaptchaState {
  status: SlideCaptchaStatus;
  challenge?: SlideCaptchaChallenge;
  token?: string;
  error?: SlideCaptchaError;
  position: SlideCaptchaPosition;
  rotation: number;
  movements: SlideCaptchaMovementPoint[];
}

export interface SlideCaptchaTexts {
  title: string;
  description: string;
  loading: string;
  verify: string;
  verifying: string;
  refresh: string;
  close: string;
  rotateLeft: string;
  rotateRight: string;
  error: string;
}

export interface UseSlideCaptchaOptions extends SlideCaptchaClientOptions {
  preload?: boolean;
  onChange?: (state: SlideCaptchaState) => void;
}

export interface UseSlideCaptchaReturn {
  state: SlideCaptchaState;
  refresh: () => Promise<void>;
  verify: () => Promise<SlideCaptchaVerifyResponse>;
  setPosition: (position: SlideCaptchaPosition) => void;
  setRotation: (rotation: number) => void;
  recordMovement: (point: SlideCaptchaMovementPoint) => void;
  resetInteraction: () => void;
}

export interface SlideCaptchaProps extends SlideCaptchaClientOptions {
  visible: boolean;
  onRequestClose?: () => void;
  preload?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  texts?: Partial<SlideCaptchaTexts>;
  onSuccess: (token: string) => void;
  onError?: (error: SlideCaptchaError) => void;
  onRefresh?: () => void;
  onChange?: (state: SlideCaptchaState) => void;
}
