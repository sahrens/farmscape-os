import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/lib/store';
import farmConfig from '@/farm.config';

/**
 * TerrainMesh — editable heightmap terrain with push/pull tools and topo lines.
 * Isolated behind the terrainEnabled toggle. When active, replaces the flat ground.
 */

// Default terrain dimensions (matching the farm ground extent)
const DEFAULT_GRID_W = 100; // grid cells in x
const DEFAULT_GRID_H = 175; // grid cells in y  
const DEFAULT_CELL_SIZE = 4.0; // farm units per cell (covers ~400x700 area)

export function TerrainMesh() {
  const terrainData = useStore(s => s.terrainData);
  const saveTerrain = useStore(s => s.saveTerrain);
  const terrainEditMode = useStore(s => s.terrainEditMode);
  const terrainBrushMode = useStore(s => s.terrainBrushMode);
  const terrainBrushSize = useStore(s => s.terrainBrushSize);

  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.PlaneGeometry>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dirty, setDirty] = useState(false);
  const heightsRef = useRef<Float32Array | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridW = terrainData?.grid_width || DEFAULT_GRID_W;
  const gridH = terrainData?.grid_height || DEFAULT_GRID_H;
  const cellSize = terrainData?.cell_size || DEFAULT_CELL_SIZE;
  const originX = terrainData?.origin_x ?? 0;
  const originY = terrainData?.origin_y ?? 0;

  const totalW = gridW * cellSize;
  const totalH = gridH * cellSize;

  // Initialize heights array
  useEffect(() => {
    const count = gridW * gridH;
    const arr = new Float32Array(count);
    if (terrainData?.heights && terrainData.heights.length === count) {
      for (let i = 0; i < count; i++) arr[i] = terrainData.heights[i];
    }
    heightsRef.current = arr;
    updateGeometry();
  }, [terrainData, gridW, gridH]);

  const updateGeometry = useCallback(() => {
    const geo = geoRef.current;
    const heights = heightsRef.current;
    if (!geo || !heights) return;

    const pos = geo.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      const ix = i % (gridW + 1);
      const iy = Math.floor(i / (gridW + 1));
      // Map grid index to height array (nearest cell)
      const hx = Math.min(ix, gridW - 1);
      const hy = Math.min(iy, gridH - 1);
      const hi = hy * gridW + hx;
      pos.setZ(i, heights[hi] || 0);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }, [gridW, gridH]);

  // Apply brush at a point
  const applyBrush = useCallback((point: THREE.Vector3) => {
    const heights = heightsRef.current;
    if (!heights) return;

    // Convert world point to grid coords
    // The mesh is rotated -90deg on X and positioned at center
    // So mesh local X = world X, mesh local Y = world -Z
    const localX = point.x - originX;
    const localY = -point.z - originY;
    const gx = Math.round(localX / cellSize);
    const gy = Math.round(localY / cellSize);

    const r = terrainBrushSize;
    const strength = terrainBrushMode === 'lower' ? -0.3 : 0.3;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = gx + dx;
        const cy = gy + dy;
        if (cx < 0 || cx >= gridW || cy < 0 || cy >= gridH) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;

        const falloff = 1 - dist / (r + 0.5);
        const idx = cy * gridW + cx;

        if (terrainBrushMode === 'smooth') {
          let sum = 0;
          let count = 0;
          for (let sy = -1; sy <= 1; sy++) {
            for (let sx = -1; sx <= 1; sx++) {
              const nx = cx + sx;
              const ny = cy + sy;
              if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                sum += heights[ny * gridW + nx];
                count++;
              }
            }
          }
          const avg = sum / count;
          heights[idx] += (avg - heights[idx]) * falloff * 0.3;
        } else {
          heights[idx] += strength * falloff;
        }
      }
    }

    updateGeometry();
    setDirty(true);
  }, [terrainBrushMode, terrainBrushSize, gridW, gridH, cellSize, originX, originY, updateGeometry]);

  // Auto-save after editing stops (2s debounce)
  useEffect(() => {
    if (!dirty) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const heights = heightsRef.current;
      if (heights) {
        saveTerrain(Array.from(heights));
        setDirty(false);
      }
    }, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dirty, saveTerrain]);

  // Continuous brush application during drag
  const { raycaster, camera, pointer } = useThree();

  useFrame(() => {
    if (!isDragging || !terrainEditMode || !meshRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      applyBrush(intersects[0].point);
    }
  });

  const handlePointerDown = useCallback((e: { point: THREE.Vector3; stopPropagation?: () => void }) => {
    if (!terrainEditMode) return;
    e.stopPropagation?.();
    setIsDragging(true);
    applyBrush(e.point);
  }, [terrainEditMode, applyBrush]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Topo contour lines
  const topoLines = useMemo(() => {
    const heights = heightsRef.current;
    if (!heights || heights.every(h => h === 0)) return null;

    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] < minH) minH = heights[i];
      if (heights[i] > maxH) maxH = heights[i];
    }
    if (maxH - minH < 1) return null;

    const interval = 2; // contour every 2 farm units of elevation
    const lines: Array<{ points: Float32Array; level: number }> = [];

    for (let level = Math.ceil(minH / interval) * interval; level <= maxH; level += interval) {
      const segments: number[] = [];

      for (let gy = 0; gy < gridH - 1; gy++) {
        for (let gx = 0; gx < gridW - 1; gx++) {
          const h00 = heights[gy * gridW + gx];
          const h10 = heights[gy * gridW + gx + 1];
          const h01 = heights[(gy + 1) * gridW + gx];
          const h11 = heights[(gy + 1) * gridW + gx + 1];

          const above = [h00 >= level, h10 >= level, h01 >= level, h11 >= level];
          const crossCount = above.filter(Boolean).length;
          if (crossCount === 0 || crossCount === 4) continue;

          const lerp = (a: number, b: number) => (level - a) / (b - a);
          const pts: number[][] = [];

          // Bottom edge
          if (above[0] !== above[1]) {
            const t = lerp(h00, h10);
            pts.push([originX + (gx + t) * cellSize, level + 0.1, -(originY + gy * cellSize)]);
          }
          // Top edge
          if (above[2] !== above[3]) {
            const t = lerp(h01, h11);
            pts.push([originX + (gx + t) * cellSize, level + 0.1, -(originY + (gy + 1) * cellSize)]);
          }
          // Left edge
          if (above[0] !== above[2]) {
            const t = lerp(h00, h01);
            pts.push([originX + gx * cellSize, level + 0.1, -(originY + (gy + t) * cellSize)]);
          }
          // Right edge
          if (above[1] !== above[3]) {
            const t = lerp(h10, h11);
            pts.push([originX + (gx + 1) * cellSize, level + 0.1, -(originY + (gy + t) * cellSize)]);
          }

          if (pts.length >= 2) {
            segments.push(...pts[0], ...pts[1]);
          }
        }
      }

      if (segments.length > 0) {
        lines.push({ points: new Float32Array(segments), level });
      }
    }
    return lines;
  }, [terrainData?.heights, gridW, gridH, cellSize, originX, originY]);

  return (
    <group>
      {/* Terrain mesh */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[originX + totalW / 2, 0, -(originY + totalH / 2)]}
        onPointerDown={handlePointerDown as unknown as (e: THREE.Event) => void}
        onPointerUp={handlePointerUp}
        receiveShadow
      >
        <planeGeometry ref={geoRef} args={[totalW, totalH, gridW, gridH]} />
        <meshStandardMaterial
          color="#4a7a3a"
          wireframe={terrainEditMode}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>

      {/* Topo contour lines */}
      {topoLines && topoLines.map((line, i) => (
        <lineSegments key={`topo-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={line.points}
              count={line.points.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" opacity={0.35} transparent linewidth={1} />
        </lineSegments>
      ))}
    </group>
  );
}

/**
 * TerrainControls — HTML overlay panel for terrain editing tools.
 * Rendered outside the Canvas in App.tsx.
 */
export function TerrainControls() {
  const terrainEnabled = useStore(s => s.terrainEnabled);
  const setTerrainEnabled = useStore(s => s.setTerrainEnabled);
  const terrainEditMode = useStore(s => s.terrainEditMode);
  const setTerrainEditMode = useStore(s => s.setTerrainEditMode);
  const terrainBrushMode = useStore(s => s.terrainBrushMode);
  const setTerrainBrushMode = useStore(s => s.setTerrainBrushMode);
  const terrainBrushSize = useStore(s => s.terrainBrushSize);
  const setTerrainBrushSize = useStore(s => s.setTerrainBrushSize);
  const fetchTerrain = useStore(s => s.fetchTerrain);
  const user = useStore(s => s.user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (terrainEnabled) fetchTerrain();
  }, [terrainEnabled, fetchTerrain]);

  if (!isAdmin) return null;

  return (
    <div className="absolute top-14 left-14 z-20 bg-earth-900/95 backdrop-blur border border-earth-700 rounded-xl shadow-xl p-3 space-y-2 w-52">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-earth-200">⛰ Terrain</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={terrainEnabled}
            onChange={(e) => setTerrainEnabled(e.target.checked)}
            className="w-4 h-4 accent-forest-500"
          />
          <span className="text-xs text-earth-400">{terrainEnabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {terrainEnabled && (
        <>
          <div className="border-t border-earth-800 pt-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={terrainEditMode}
                onChange={(e) => setTerrainEditMode(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-xs text-earth-300">Edit (push/pull)</span>
            </label>
          </div>

          {terrainEditMode && (
            <div className="space-y-2 border-t border-earth-800 pt-2">
              <div className="flex gap-1">
                {(['raise', 'lower', 'smooth'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTerrainBrushMode(mode)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${
                      terrainBrushMode === mode
                        ? 'bg-forest-600 text-white'
                        : 'bg-earth-800 text-earth-400 hover:bg-earth-700'
                    }`}
                  >
                    {mode === 'raise' ? '▲' : mode === 'lower' ? '▼' : '~'} {mode}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-earth-500 w-10">Size</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={terrainBrushSize}
                  onChange={(e) => setTerrainBrushSize(parseInt(e.target.value))}
                  className="flex-1 h-1.5 accent-forest-500"
                />
                <span className="text-xs text-earth-400 w-4">{terrainBrushSize}</span>
              </div>
              <p className="text-[10px] text-earth-600 italic">
                Click & drag on terrain to sculpt. Auto-saves after 2s.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
