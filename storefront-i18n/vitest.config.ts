import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Test hygiene: wipe mock call history before every test and restore
    // vi.spyOn targets to their real implementations, so no test can pass
    // (or fail) on the strength of calls a previous test happened to record.
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
