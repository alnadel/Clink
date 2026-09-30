import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'content-tools',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
