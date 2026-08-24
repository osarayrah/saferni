import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    // sync.merge.test.ts uses Node's built-in test runner, not Vitest.
    exclude: ['node_modules/**', 'lib/__tests__/**'],
  },
});
