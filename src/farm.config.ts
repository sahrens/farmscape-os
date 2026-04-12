/**
 * FarmscapeOS — Farm Configuration
 *
 * This file re-exports the active farm configuration.
 * To switch farms, change the import below.
 *
 * To create your own farm config, copy `src/farms/example.config.ts`
 * and update the values for your property.
 */

export interface FarmConfig {
  // Identity
  name: string;
  subtitle?: string;
  address?: string;

  // Units
  unit: 'ft' | 'm';
  unitLabel: string;

  // Property boundary polygon (in local coordinate system)
  boundary: Array<{ x: number; y: number; label?: string }>;

  // Optional secondary boundary lines (clearing edges, zones, etc.)
  overlays?: Array<{
    name: string;
    points: Array<{ x: number; y: number }>;
    color?: string;
    opacity?: number;
  }>;

  // Camera defaults for the 3D viewer
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    far?: number;
  };

  // Ground plane sizing (centered on the property)
  ground: {
    center: [number, number];
    size: [number, number];
  };

  // Color overrides for element subtypes (hex colors)
  colors?: Record<string, string>;

  // Human-readable labels for subtypes
  subtypeLabels?: Record<string, string>;

  // Donation configuration
  donation?: {
    farmUrl?: string;
    farmLabel?: string;
    upstreamPercent?: number;
    upstreamUrl?: string;
  };
}

// ─── Default color palette for common element types/subtypes ───
export const DEFAULT_COLORS: Record<string, string> = {
  structure: '#8B4513',
  tree: '#228B22',
  zone: '#DAA520',
  infrastructure: '#808080',
};

// ─── Active farm configuration ───
// Change this import to switch to your farm config.
// Copy src/farms/example.config.ts → src/farms/myfarm.config.ts,
// customize it, then update this import.
import example from './farms/example.config';
export default example;
