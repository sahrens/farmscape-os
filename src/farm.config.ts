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

// Re-export types for convenience
export type { FarmConfig } from './farm.config.types';
export { DEFAULT_COLORS } from './farm.config.types';

// Direct import — Vite follows symlinks for regular imports.
// If local.config.ts doesn't exist, the build will fall through to example.
// To switch configs, just create/remove the symlink or file.
import config from './farms/local.config';

export default config;
