/**
 * FarmscapeOS — Farm Configuration Loader
 *
 * Automatically loads your farm config if it exists at `src/farms/local.config.ts`.
 * Falls back to the example config if no local config is found.
 *
 * Setup for your own farm:
 *   1. Run `pnpm run init` to generate a config interactively, OR
 *   2. Copy `src/farms/example.config.ts` → `src/farms/local.config.ts` and edit it
 *
 * For the private-repo pattern (symlink):
 *   ln -s ../../your-farm.config.ts farmscape-os/src/farms/local.config.ts
 */

// Re-export types for convenience
export type { FarmConfig } from './farm.config.types';
export { DEFAULT_COLORS } from './farm.config.types';

// Vite eager glob: resolved at build time.
// If src/farms/local.config.ts exists (file or symlink), it's included.
const localModules = import.meta.glob('./farms/local.config.ts', { eager: true }) as Record<
  string,
  { default: import('./farm.config.types').FarmConfig }
>;

import example from './farms/example.config';

const localModule = localModules['./farms/local.config.ts'];
const config = localModule ? localModule.default : example;

export default config;
