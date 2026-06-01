import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponderGestureState,
} from 'react-native';

import { useSlideCaptcha } from '../hooks/useSlideCaptcha';
import {
  backendToRenderedPosition,
  clampPosition,
  getRenderedLayout,
  renderedToBackendPosition,
} from '../internal/geometry';
import type { SlideCaptchaError } from '../client/errors';
import type {
  SlideCaptchaMovementPoint,
  SlideCaptchaPosition,
  SlideCaptchaProps,
  SlideCaptchaTexts,
} from '../client/types';

const defaultTexts: SlideCaptchaTexts = {
  title: 'Security check',
  description: 'Drag the piece into the correct position.',
  loading: 'Loading challenge...',
  verify: 'Verify',
  verifying: 'Verifying...',
  refresh: 'Refresh',
  close: 'Close',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  error: 'Could not complete the challenge.',
};

export function SlideCaptcha(props: SlideCaptchaProps) {
  const {
    visible,
    onRequestClose,
    preload = true,
    disabled = false,
    style,
    texts: customTexts,
    onSuccess,
    onError,
    onRefresh,
    onChange,
    baseUrl,
    headers,
    fetcher,
  } = props;

  const texts = useMemo(() => ({ ...defaultTexts, ...customTexts }), [customTexts]);
  const { width: screenWidth } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(Math.min(screenWidth - 48, 360));
  const lastErrorRef = useRef<SlideCaptchaError | undefined>();
  const interactionStartedAtRef = useRef(0);
  const dragStartRef = useRef<SlideCaptchaPosition>({ x: 0, y: 0 });

  const { state, refresh, verify, setPosition, setRotation, recordMovement } = useSlideCaptcha({
    baseUrl,
    headers,
    fetcher,
    preload,
    onChange,
  });

  const challenge = state.challenge;
  const layout = useMemo(
    () => (challenge ? getRenderedLayout(challenge, availableWidth) : undefined),
    [availableWidth, challenge],
  );

  const renderedPosition = useMemo(
    () => (layout ? backendToRenderedPosition(state.position, layout) : { x: 0, y: 0 }),
    [layout, state.position],
  );

  const canInteract = Boolean(challenge && layout && !disabled && state.status !== 'verifying');

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canInteract,
        onMoveShouldSetPanResponder: () => canInteract,
        onPanResponderGrant: () => {
          if (!layout) {
            return;
          }

          interactionStartedAtRef.current = Date.now();
          dragStartRef.current = renderedPosition;
        },
        onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (!challenge || !layout) {
            return;
          }

          const nextRenderedPosition = clampPosition(
            {
              x: dragStartRef.current.x + gesture.dx,
              y: dragStartRef.current.y + gesture.dy,
            },
            layout.imageWidth - layout.pieceWidth,
            layout.imageHeight - layout.pieceHeight,
          );
          const nextBackendPosition = renderedToBackendPosition(
            nextRenderedPosition,
            layout,
            challenge,
          );

          setPosition(nextBackendPosition);
          recordMovement(
            toMovementPoint(nextBackendPosition, state.rotation, interactionStartedAtRef.current),
          );
        },
      }),
    [canInteract, challenge, layout, recordMovement, renderedPosition, setPosition, state.rotation],
  );

  useEffect(() => {
    if (!preload && visible && state.status === 'idle') {
      void refresh();
    }
  }, [preload, refresh, state.status, visible]);

  useEffect(() => {
    if (state.error && lastErrorRef.current !== state.error) {
      lastErrorRef.current = state.error;
      onError?.(state.error);
    }
  }, [onError, state.error]);

  async function handleRefresh() {
    await refresh();
    onRefresh?.();
  }

  async function handleVerify() {
    try {
      const response = await verify();
      if (response.token) {
        onSuccess(response.token);
      }
      void refresh();
    } catch {
      // useSlideCaptcha normalizes and exposes the error through state.error.
    }
  }

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;

    if (nextWidth > 0) {
      setAvailableWidth(nextWidth);
    }
  }

  function rotate(direction: -1 | 1) {
    if (!challenge) {
      return;
    }

    const nextRotation = normalizeRotation(state.rotation + challenge.rotation_step * direction);
    setRotation(nextRotation);
    recordMovement(toMovementPoint(state.position, nextRotation, interactionStartedAtRef.current));
  }

  const isBusy = state.status === 'loading' || state.status === 'verifying';
  const showChallenge = Boolean(challenge && layout && state.status !== 'loading');

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, style]} onLayout={handleLayout}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>{texts.title}</Text>
              <Text style={styles.description}>{texts.description}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={texts.close}
              disabled={disabled || state.status === 'verifying'}
              onPress={onRequestClose}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
                (disabled || state.status === 'verifying') && styles.disabled,
              ]}
            >
              <Text style={styles.iconButtonText}>x</Text>
            </Pressable>
          </View>

          {isBusy && !showChallenge ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.message}>{texts.loading}</Text>
            </View>
          ) : null}

          {showChallenge && challenge && layout ? (
            <View style={styles.challenge}>
              <View
                style={[
                  styles.imageStage,
                  {
                    width: layout.imageWidth,
                    height: layout.imageHeight,
                  },
                ]}
              >
                <Image
                  source={{ uri: challenge.background_url }}
                  resizeMode="stretch"
                  style={[
                    styles.backgroundImage,
                    {
                      width: layout.imageWidth,
                      height: layout.imageHeight,
                    },
                  ]}
                />
                <View
                  {...panResponder.panHandlers}
                  style={[
                    styles.piece,
                    {
                      width: layout.pieceWidth,
                      height: layout.pieceHeight,
                      transform: [
                        { translateX: renderedPosition.x },
                        { translateY: renderedPosition.y },
                        { rotate: `${state.rotation}deg` },
                      ],
                    },
                    !canInteract && styles.disabled,
                  ]}
                >
                  <Image
                    source={{ uri: challenge.piece_url }}
                    resizeMode="stretch"
                    style={styles.pieceImage}
                  />
                </View>
              </View>

              {challenge.rotation_enabled ? (
                <View style={styles.rotationControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={texts.rotateLeft}
                    disabled={!canInteract}
                    onPress={() => rotate(-1)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                      !canInteract && styles.disabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.rotationValue}>{state.rotation}°</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={texts.rotateRight}
                    disabled={!canInteract}
                    onPress={() => rotate(1)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                      !canInteract && styles.disabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>+</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {state.error ? (
            <Text style={styles.errorText}>{state.error.message || texts.error}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={texts.refresh}
              disabled={disabled || state.status === 'loading' || state.status === 'verifying'}
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && styles.pressed,
                (disabled || state.status === 'loading' || state.status === 'verifying') &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.secondaryActionText}>{texts.refresh}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={texts.verify}
              disabled={!showChallenge || disabled || state.status === 'verifying'}
              onPress={handleVerify}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
                (!showChallenge || disabled || state.status === 'verifying') && styles.disabled,
              ]}
            >
              <Text style={styles.primaryActionText}>
                {state.status === 'verifying' ? texts.verifying : texts.verify}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function toMovementPoint(
  position: SlideCaptchaPosition,
  rotation: number,
  startedAt: number,
): SlideCaptchaMovementPoint {
  return {
    x: position.x,
    y: position.y,
    r: rotation,
    t: startedAt > 0 ? Date.now() - startedAt : 0,
  };
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(10, 14, 18, 0.56)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  heading: {
    flex: 1,
  },
  title: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    marginTop: 4,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  iconButtonText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  message: {
    color: '#4b5563',
    fontSize: 14,
  },
  challenge: {
    alignItems: 'center',
    gap: 14,
  },
  imageStage: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pieceImage: {
    width: '100%',
    height: '100%',
  },
  rotationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  secondaryButtonText: {
    color: '#312e81',
    fontSize: 20,
    fontWeight: '700',
  },
  rotationValue: {
    minWidth: 56,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryAction: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryAction: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.52,
  },
});
