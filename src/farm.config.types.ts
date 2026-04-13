/**
 * FarmscapeOS — Farm Configuration Types
 *
 * Shared type definitions for farm configuration files.
 * Import this in your farm config: `import type { FarmConfig } from '../farm.config.types';`
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
    bookmarks?: Array<{
      name: string;
      position: [number, number, number];
      target: [number, number, number];
    }>;
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

  // Geo-reference: maps local coordinates to GPS
  geoReference?: {
    origin: { lat: number; lng: number }; // GPS of local coordinate origin (0,0)
    bearing: number; // Degrees CW from true north to local y-axis
    metersPerUnit: number; // Calibrated scale: meters per local coordinate unit
  };

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
