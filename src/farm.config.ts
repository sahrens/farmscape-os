/**
 * FarmscapeOS — Farm Configuration Loader
 *
 * Loads your farm config from `src/farms/local.config.ts` if it exists.
 * Falls back to the example config if no local config is found.
 *
 * Setup for your own farm:
 *   1. Run `pnpm run init` to generate a config interactively, OR
 *   2. Copy `src/farms/example.config.ts` → `src/farms/local.config.ts` and edit it
 *
 * For the private-repo pattern (symlink):
 *   ln -s ../../../your-farm.config.ts farmscape-os/src/farms/local.config.ts
 */

import type { FarmConfig } from './farm.config.types';
import exampleConfig from './farms/example.config';

// Re-export types for convenience
export type { FarmConfig } from './farm.config.types';
export { DEFAULT_COLORS } from './farm.config.types';

// Vite resolves the optional local config at build time. When
// src/farms/local.config.ts is absent (e.g. a fresh clone of this repo),
// the glob is empty and we fall back to the example config.
const localModules = import.meta.glob<{ default: FarmConfig }>('./farms/local.config.ts', {
  eager: true,
});
const localConfig = Object.values(localModules)[0]?.default;

const config: FarmConfig = localConfig ?? exampleConfig;

export default config;
