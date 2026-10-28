import * as THREE from 'three';
import type { ImageLayer, TerrainData } from './api';
import { isTerrainReady } from './terrain';

/**
 * Layer compositing — the visible image layers are blended once into a
 * single 2D image (in sort order, at their placements and opacities), and
 * that one image is what the scene renders: as the terrain's texture in 3D
 * and as a single flat plane in plan view.
 *
 * Why: rendering each layer as its own transparent, terrain-draped mesh
 * made the result depend on draw order and view angle — layers occluded
 * each other where the terrain dipped below the plan backdrop, contour
 * lines vanished except at glancing angles, and near-top-down 3D views
 * showed whichever layer happened to win the depth sort. One composited
 * texture has none of those failure modes: what the layers show is fixed
 * in the image itself.
 */

export interface CompositeExtent {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface CompositeImage {
  texture: THREE.CanvasTexture;
  extent: CompositeExtent;
}

function layerCorners(layer: ImageLayer): Array<[number, number]> {
  const rot = ((layer.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const hw = layer.width / 2;
  const hh = layer.height / 2;
  const local: Array<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  return local.map(([lx, ly]) => [
    layer.x + lx * cos - ly * sin,
    layer.y + lx * sin + ly * cos,
  ]);
}

/**
 * The world extent the composite covers: the union of every visible
 * layer's (rotated) footprint and the terrain grid, so the terrain's own
 * UV mapping always lands inside the image.
 */
export function compositeExtent(
  layers: ImageLayer[],
  terrainData: TerrainData | null | undefined,
): CompositeExtent | null {
  const visible = layers.filter(l => l.visible && l.url);
  if (visible.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const layer of visible) {
    for (const [cx, cy] of layerCorners(layer)) grow(cx, cy);
  }
  if (isTerrainReady(terrainData)) {
    const { grid_width: gW, grid_height: gH, cell_size: cs, origin_x: ox, origin_y: oy } = terrainData;
    grow(ox, oy);
    grow(ox + gW * cs, oy + gH * cs);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Blend the visible layers into one canvas texture over `extent`.
 * Layers draw in sort order, each placed by the same convention the scene
 * uses: layer x/y are the center in farm coordinates, the image's top
 * edge is north, rotation is counter-clockwise in the farm frame.
 */
export async function buildCompositeTexture(
  layers: ImageLayer[],
  extent: CompositeExtent,
  maxSide = 3584,
): Promise<THREE.CanvasTexture | null> {
  const visible = layers
    .filter(l => l.visible && l.url)
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (visible.length === 0) return null;

  const scale = maxSide / Math.max(extent.width, extent.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(extent.width * scale));
  canvas.height = Math.max(2, Math.round(extent.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const maxY = extent.minY + extent.height;
  const toCanvas = (fx: number, fy: number): [number, number] => [
    (fx - extent.minX) * scale,
    (maxY - fy) * scale,
  ];

  for (const layer of visible) {
    let img: HTMLImageElement;
    try {
      img = await loadImage(layer.url);
    } catch {
      continue; // a layer that fails to load simply isn't in the blend
    }
    const rot = ((layer.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const hw = layer.width / 2;
    const hh = layer.height / 2;
    // Image pixel corners in farm space: TL = north-west, TR = north-east,
    // BL = south-west (image rows run north to south).
    const corner = (lx: number, ly: number): [number, number] =>
      toCanvas(
        layer.x + lx * cos - ly * sin,
        layer.y + lx * sin + ly * cos,
      );
    const [tlx, tly] = corner(-hw, hh);
    const [trx, try_] = corner(hw, hh);
    const [blx, bly] = corner(-hw, -hh);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) continue;
    // Affine map from image pixels to canvas pixels through the 3 corners.
    ctx.setTransform(
      (trx - tlx) / iw,
      (try_ - tly) / iw,
      (blx - tlx) / ih,
      (bly - tly) / ih,
      tlx,
      tly,
    );
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(img, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
