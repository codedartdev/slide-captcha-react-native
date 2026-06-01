import React from 'react';

type ComponentProps = Record<string, any> & {
  children?: React.ReactNode;
};

function createHostComponent(name: string) {
  return function HostComponent({ children, ...props }: ComponentProps) {
    return React.createElement(name, props, children);
  };
}

export const View = createHostComponent('View');
export const Text = createHostComponent('Text');
export const Image = createHostComponent('Image');
export const ActivityIndicator = createHostComponent('ActivityIndicator');
export const SafeAreaView = createHostComponent('SafeAreaView');
export const KeyboardAvoidingView = createHostComponent('KeyboardAvoidingView');
export const TextInput = createHostComponent('TextInput');

export function Modal({ children, visible, ...props }: ComponentProps & { visible?: boolean }) {
  if (!visible) {
    return null;
  }

  return React.createElement('Modal', { ...props, visible }, children);
}

export function Pressable({ children, style, ...props }: ComponentProps) {
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
  return React.createElement('Pressable', { ...props, style: resolvedStyle }, children);
}

export const StyleSheet = {
  create<T extends Record<string, any>>(styles: T): T {
    return styles;
  },
  flatten(style: any) {
    return Array.isArray(style) ? Object.assign({}, ...style) : style;
  },
};

export const PanResponder = {
  create(config: Record<string, any>) {
    return {
      panHandlers: config,
    };
  },
};

export function useWindowDimensions() {
  return {
    width: 390,
    height: 844,
    scale: 2,
    fontScale: 1,
  };
}

export const Platform = {
  OS: 'ios',
  select<T>(values: Record<string, T>): T | undefined {
    return values.ios ?? values.default;
  },
};

export type GestureResponderEvent = any;
export type LayoutChangeEvent = {
  nativeEvent: {
    layout: {
      width: number;
      height: number;
      x: number;
      y: number;
    };
  };
};
export type PanResponderGestureState = {
  dx: number;
  dy: number;
};
