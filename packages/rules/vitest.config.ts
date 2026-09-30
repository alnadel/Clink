import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'rules',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The rules engine carries the whole game, so it is held to a coverage floor (issue #33).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts', 'src/formats.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
