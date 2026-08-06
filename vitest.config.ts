import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Unit tests.
 *
 * Pure logic only — no database, no server, no browser. Everything that needs
 * one of those is an integration gate under `scripts/` instead, so this suite
 * stays fast enough to run on every save.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default'],
  },
})
