import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      'react-native': new URL('./test/reactNativeMock.tsx', import.meta.url).pathname,
    },
  },
});
