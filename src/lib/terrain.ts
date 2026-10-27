import type { TerrainData } from './api';

/**
 * Terrain height sampling — shared utilities.
 *
 * The terrain grid stores one height per cell in farm units, indexed
 * `heights[row * grid_width + col]`, where:
 *   farm x = origin_x + col * cell_size
 *   farm y = origin_y + row * cell_size   (row 0 is the minimum-y edge)
 *
 * Everything that sits on the ground — farm elements, image layers,
 * boundary and overlay lines — samples heights through here so the whole
 * scene agrees on the terrain surface.
 */

/** True when the data holds a complete grid that can be sampled. */
export function isTerrainReady(data: TerrainData | null | undefined): data is TerrainData {
  return (
    !!data &&
    Array.isArray(data.heights) &&
    data.heights.length === data.grid_width * data.grid_height &&
    data.cell_size > 0
  );
}

/**
 * Bilinearly interpolated terrain height at farm coordinates (x, y).
 * Returns 0 when there is no usable terrain data or the point lies
 * outside the grid, so callers can use it unconditionally.
 */
export function sampleTerrainHeight(
  data: TerrainData | null | undefined,
  x: number,
  y: number,
): number {
  if (!isTerrainReady(data)) return 0;
  const { grid_width: gW, grid_height: gH, cell_size: cs, origin_x: ox, origin_y: oy, heights } = data;

  const fx = (x - ox) / cs;
  const fy = (y - oy) / cs;
  if (fx < 0 || fy < 0 || fx > gW - 1 || fy > gH - 1) return 0;

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, gW - 1);
  const y1 = Math.min(y0 + 1, gH - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const h00 = heights[y0 * gW + x0] || 0;
  const h10 = heights[y0 * gW + x1] || 0;
  const h01 = heights[y1 * gW + x0] || 0;
  const h11 = heights[y1 * gW + x1] || 0;

  return (
    h00 * (1 - tx) * (1 - ty) +
    h10 * tx * (1 - ty) +
    h01 * (1 - tx) * ty +
    h11 * tx * ty
  );
}
