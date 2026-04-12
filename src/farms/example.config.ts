/**
 * Example Farm Configuration — Copy and customize for your property
 *
 * 1. Copy this file: `cp example.config.ts local.config.ts`
 * 2. Fill in your property details below
 * 3. Build and deploy — farm.config.ts auto-detects local.config.ts
 * 4. Seed your D1 database with your elements (see README)
 */
import type { FarmConfig } from '../farm.config.types';

const myFarm: FarmConfig = {
  // ─── Identity ───
  name: 'My Farm',
  subtitle: 'Managed with FarmscapeOS',
  address: '123 Farm Road, Somewhere, USA',

  // ─── Coordinate system ───
  // Choose 'ft' (feet) or 'm' (meters) — all element positions use this unit
  unit: 'ft',
  unitLabel: 'ft',

  // ─── Property boundary ───
  // Define your property boundary as a polygon in local coordinates.
  // Pick a corner as (0,0) and measure other corners relative to it.
  // You can use GPS coordinates converted to a local system, or
  // measure directly with a tape measure / laser rangefinder.
  boundary: [
    { x: 0, y: 0, label: 'SW Corner' },
    { x: 200, y: 0, label: 'SE Corner' },
    { x: 200, y: 300, label: 'NE Corner' },
    { x: 0, y: 300, label: 'NW Corner' },
  ],

  // ─── Optional overlay lines ───
  // Additional boundary lines, clearing edges, fence lines, etc.
  overlays: [
    // {
    //   name: 'Garden Fence',
    //   points: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }],
    //   color: '#88aa66',
    //   opacity: 0.4,
    // },
  ],

  // ─── 3D Viewer camera ───
  // position: where the camera starts [x, height, z]
  // target: what the camera looks at [x, height, z]
  // Tip: set target to the center of your property
  camera: {
    position: [100, 200, 100],
    target: [100, 0, -150],
    far: 2000,
  },

  // ─── Ground plane ───
  // center: [x, z] center of the ground plane (z is negative y in 3D)
  // size: [width, depth] of the ground plane — make it larger than your property
  ground: {
    center: [100, -150],
    size: [400, 500],
  },

  // ─── Subtype colors ───
  // Override colors for specific subtypes (hex values)
  colors: {
    // apple: '#FF4444',
    // pear: '#AACC44',
    // greenhouse: '#88BBDD',
  },

  // ─── Subtype labels ───
  // Human-readable labels for subtypes shown in the UI
  subtypeLabels: {
    // apple: 'Apple Tree',
    // pear: 'Pear Tree',
    // greenhouse: 'Greenhouse',
  },

  // ─── Donations ───
  // Optional: configure donation links for your farm
  donation: {
    // farmUrl: 'https://your-donation-page.com',
    // farmLabel: 'Support Our Farm',
    upstreamPercent: 5,
    upstreamUrl: 'https://github.com/sponsors/sahrens',
  },
};

export default myFarm;
