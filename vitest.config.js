/**
 * Vitest configuration for API Panel - scoped to tests/ only
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Restrict to this project root — prevents scanning Hermes's own test files
  // in parent directories (causes jsdom import errors).
  root: '.',
  test: {
    globals: true,
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    // Restrict to this project only — don't follow vitest workspace configs
    // from parent directories (e.g., Hermes's own test suite).
    pool: 'threads',
    server: { deps: { inline: [] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: false,
      include: ['src/**', 'electron/**'],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
    },
  },
});
