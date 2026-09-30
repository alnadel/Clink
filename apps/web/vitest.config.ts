import { defineProject } from 'vitest/config';

// Unit tests for pure modules only (no DOM). UI is tested with Playwright in e2e/.
export default defineProject({
  test: {
    name: 'web',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
