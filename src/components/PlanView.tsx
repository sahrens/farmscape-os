/**
 * PlanView — Landscape architecture plan view overlay.
 * When active, renders flat architectural plan symbols (top-down) for each element
 * and switches the camera to orthographic top-down.
 *
 * Plan graphics:
 * - Trees: canopy circle with radial branch lines (varies by subtype)
 * - Structures: footprint rectangle with roof ridge line and hatch
 * - Zones: dashed border with diagonal hatch fill
 * - Infrastructure: line-based symbols (dashed, dotted, solid)
 */
import { useMemo, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/lib/store';
import type { FarmElement } from '@/lib/types';
import farmConfig, { DEFAULT_COLORS } from '@/farm.config';

const COLORS: Record<string, string> = {
  ...DEFAULT_COLORS,
  ...(farmConfig.colors || {}),
};

function getColor(el: FarmElement): string {
  if (el.metadata && typeof el.metadata === 'object' && 'color' in el.metadata) {
    return el.metadata.color as string;
  }
  return COLORS[el.subtype || ''] || COLORS[el.type] || '#888888';
}

// Helper: create a Line component that works with R3F without TS conflicts
// R3F's <line> conflicts with SVG line type. Use primitive instead.
function Line3D({ geometry, color, opacity = 1 }: { geometry: THREE.BufferGeometry; color: string; opacity?: number }) {
  const ref = useRef<THREE.Line>(null);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity }), [color, opacity]);
  const line = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive ref={ref} object={line} />;
}

function LineSegments3D({ geometry, color, opacity = 1 }: { geometry: THREE.BufferGeometry; color: string; opacity?: number }) {
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity }), [color, opacity]);
  const segments = useMemo(() => new THREE.LineSegments(geometry, mat), [geometry, mat]);
  return <primitive object={segments} />;
}

// ─── Orthographic camera controller ────────────────────────────────
export function PlanCameraController() {
  const { camera } = useThree();
  const planView = useStore(s => s.planView);
  const savedCamRef = useRef<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
  } | null>(null);

  useEffect(() => {
    if (!planView) {
      // Restore perspective camera
      if (savedCamRef.current) {
        camera.position.copy(savedCamRef.current.position);
        camera.quaternion.copy(savedCamRef.current.quaternion);
        (camera as THREE.PerspectiveCamera).fov = savedCamRef.current.fov;
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        savedCamRef.current = null;
      }
      return;
    }

    // Save current camera state
    savedCamRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: (camera as THREE.PerspectiveCamera).fov,
    };

    // Move camera to top-down position
    const [cx, cz] = farmConfig.ground.center;
    const height = 800;
    camera.position.set(cx, height, cz);
    camera.lookAt(cx, 0, cz);

    // Use very narrow FOV to simulate orthographic
    (camera as THREE.PerspectiveCamera).fov = 45;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [planView, camera]);

  // Keep camera locked top-down in plan view
  useFrame(() => {
    if (!planView) return;
    const [cx, cz] = farmConfig.ground.center;
    camera.position.set(camera.position.x, 800, camera.position.z);
    camera.lookAt(camera.position.x, 0, camera.position.z);
  });

  return null;
}

// ─── Tree plan symbol ──────────────────────────────────────────────
function TreePlanSymbol({ el }: { el: FarmElement }) {
  const color = getColor(el);
  const canopy = (el.width || 10) / 2;
  const isPlanned = el.status === 'planned';
  const isPalm = el.subtype === 'royal_palm' || el.subtype === 'palm';
  const isPine = el.subtype === 'cook_pine' || el.subtype === 'pine' || el.subtype === 'conifer';

  // Create canopy circle outline
  const circleGeo = useMemo(() => {
    const segments = 32;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * canopy, Math.sin(angle) * canopy, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [canopy]);

  // Create radial branch lines
  const branchGeo = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const numBranches = isPalm ? 8 : isPine ? 6 : 5;
    const innerRadius = isPalm ? canopy * 0.1 : canopy * 0.15;
    const outerRadius = canopy * (isPalm ? 0.95 : 0.85);

    for (let i = 0; i < numBranches; i++) {
      const angle = (i / numBranches) * Math.PI * 2 + (isPine ? Math.PI / numBranches : 0);
      points.push(new THREE.Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0));
      points.push(new THREE.Vector3(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [canopy, isPalm, isPine]);

  // Pine: additional concentric circle
  const innerCircleGeo = useMemo(() => {
    if (!isPine) return null;
    const segments = 16;
    const r = canopy * 0.5;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [canopy, isPine]);

  // Palm: frond curves (arcs radiating outward)
  const palmFrondsGeo = useMemo(() => {
    if (!isPalm) return null;
    const points: THREE.Vector3[] = [];
    const numFronds = 8;
    for (let i = 0; i < numFronds; i++) {
      const baseAngle = (i / numFronds) * Math.PI * 2;
      // Draw a curved frond
      for (let j = 0; j < 8; j++) {
        const t = j / 8;
        const r = canopy * 0.3 + t * canopy * 0.6;
        const a = baseAngle + Math.sin(t * Math.PI) * 0.3;
        points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
        const t2 = (j + 1) / 8;
        const r2 = canopy * 0.3 + t2 * canopy * 0.6;
        const a2 = baseAngle + Math.sin(t2 * Math.PI) * 0.3;
        points.push(new THREE.Vector3(Math.cos(a2) * r2, Math.sin(a2) * r2, 0));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [canopy, isPalm]);

  // Filled canopy disc (semi-transparent)
  const discGeo = useMemo(() => new THREE.CircleGeometry(canopy, 32), [canopy]);

  return (
    <group position={[el.x, 0.5, -el.y]} rotation={[-Math.PI / 2, 0, (el.rotation * Math.PI) / 180]}>
      {/* Filled canopy */}
      <mesh geometry={discGeo}>
        <meshBasicMaterial color={color} transparent opacity={isPlanned ? 0.15 : 0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Canopy outline */}
      <Line3D geometry={circleGeo} color={color} opacity={isPlanned ? 0.5 : 0.9} />
      {/* Branch lines */}
      <LineSegments3D geometry={branchGeo} color={color} opacity={isPlanned ? 0.4 : 0.7} />
      {/* Pine inner ring */}
      {innerCircleGeo && <Line3D geometry={innerCircleGeo} color={color} opacity={0.5} />}
      {/* Palm fronds */}
      {palmFrondsGeo && <LineSegments3D geometry={palmFrondsGeo} color={color} opacity={0.6} />}
      {/* Center dot */}
      <mesh>
        <circleGeometry args={[canopy * 0.08, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ─── Structure plan symbol ─────────────────────────────────────────
function StructurePlanSymbol({ el }: { el: FarmElement }) {
  const color = getColor(el);
  const w = el.width || 20;
  const d = el.height || 15;
  const isPlanned = el.status === 'planned';

  // Footprint outline
  const outlineGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  // Roof ridge line (center line along longest axis)
  const ridgeGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const points = w >= d
      ? [new THREE.Vector3(-hw * 0.9, 0, 0), new THREE.Vector3(hw * 0.9, 0, 0)]
      : [new THREE.Vector3(0, -hd * 0.9, 0), new THREE.Vector3(0, hd * 0.9, 0)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  // Diagonal hatch lines inside footprint
  const hatchGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const spacing = Math.min(w, d) * 0.25;
    const points: THREE.Vector3[] = [];
    // Diagonal lines
    for (let offset = -(hw + hd); offset < hw + hd; offset += spacing) {
      // Line: y = x - offset, clipped to [-hw,hw] x [-hd,hd]
      let x1 = Math.max(-hw, offset - hd);
      let x2 = Math.min(hw, offset + hd);
      let y1 = x1 - offset;
      let y2 = x2 - offset;
      // Clip y
      if (y1 < -hd) { y1 = -hd; x1 = offset + y1; }
      if (y1 > hd) { y1 = hd; x1 = offset + y1; }
      if (y2 < -hd) { y2 = -hd; x2 = offset + y2; }
      if (y2 > hd) { y2 = hd; x2 = offset + y2; }
      x1 = Math.max(-hw, Math.min(hw, x1));
      x2 = Math.max(-hw, Math.min(hw, x2));
      y1 = Math.max(-hd, Math.min(hd, y1));
      y2 = Math.max(-hd, Math.min(hd, y2));
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (Math.sqrt(dx * dx + dy * dy) > 1) {
        points.push(new THREE.Vector3(x1, y1, 0));
        points.push(new THREE.Vector3(x2, y2, 0));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  return (
    <group position={[el.x, 0.5, -el.y]} rotation={[-Math.PI / 2, 0, (el.rotation * Math.PI) / 180]}>
      {/* Filled footprint */}
      <mesh>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={isPlanned ? 0.1 : 0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Outline */}
      <Line3D geometry={outlineGeo} color={color} opacity={isPlanned ? 0.5 : 1} />
      {/* Ridge line */}
      <LineSegments3D geometry={ridgeGeo} color="#333333" opacity={isPlanned ? 0.3 : 0.6} />
      {/* Hatch fill */}
      <LineSegments3D geometry={hatchGeo} color={color} opacity={isPlanned ? 0.15 : 0.25} />
    </group>
  );
}

// ─── Zone plan symbol ──────────────────────────────────────────────
function ZonePlanSymbol({ el }: { el: FarmElement }) {
  const color = getColor(el);
  const w = el.width || 30;
  const d = el.height || 30;
  const isPlanned = el.status === 'planned';

  // Dashed border (simulated with segments)
  const dashedBorderGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const dashLen = 3;
    const gapLen = 2;
    const points: THREE.Vector3[] = [];

    const edges: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-hw, -hd, 0), new THREE.Vector3(hw, -hd, 0)],
      [new THREE.Vector3(hw, -hd, 0), new THREE.Vector3(hw, hd, 0)],
      [new THREE.Vector3(hw, hd, 0), new THREE.Vector3(-hw, hd, 0)],
      [new THREE.Vector3(-hw, hd, 0), new THREE.Vector3(-hw, -hd, 0)],
    ];

    for (const [start, end] of edges) {
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      dir.normalize();
      let pos = 0;
      let drawing = true;
      while (pos < len) {
        const segLen = drawing ? dashLen : gapLen;
        const nextPos = Math.min(pos + segLen, len);
        if (drawing) {
          points.push(new THREE.Vector3().copy(start).addScaledVector(dir, pos));
          points.push(new THREE.Vector3().copy(start).addScaledVector(dir, nextPos));
        }
        pos = nextPos;
        drawing = !drawing;
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  // Diagonal hatch pattern
  const hatchGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const spacing = 5;
    const points: THREE.Vector3[] = [];
    for (let offset = -(hw + hd); offset < hw + hd; offset += spacing) {
      let x1 = Math.max(-hw, offset - hd);
      let x2 = Math.min(hw, offset + hd);
      let y1 = x1 - offset;
      let y2 = x2 - offset;
      if (y1 < -hd) { y1 = -hd; x1 = offset + y1; }
      if (y2 > hd) { y2 = hd; x2 = offset + y2; }
      x1 = Math.max(-hw, Math.min(hw, x1));
      x2 = Math.max(-hw, Math.min(hw, x2));
      y1 = Math.max(-hd, Math.min(hd, y1));
      y2 = Math.max(-hd, Math.min(hd, y2));
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (Math.sqrt(dx * dx + dy * dy) > 1) {
        points.push(new THREE.Vector3(x1, y1, 0));
        points.push(new THREE.Vector3(x2, y2, 0));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  return (
    <group position={[el.x, 0.3, -el.y]} rotation={[-Math.PI / 2, 0, (el.rotation * Math.PI) / 180]}>
      {/* Light fill */}
      <mesh>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={isPlanned ? 0.05 : 0.1} side={THREE.DoubleSide} />
      </mesh>
      {/* Dashed border */}
      <LineSegments3D geometry={dashedBorderGeo} color={color} opacity={isPlanned ? 0.4 : 0.8} />
      {/* Hatch */}
      <LineSegments3D geometry={hatchGeo} color={color} opacity={isPlanned ? 0.1 : 0.2} />
    </group>
  );
}

// ─── Infrastructure plan symbol ────────────────────────────────────
function InfrastructurePlanSymbol({ el }: { el: FarmElement }) {
  const color = getColor(el);
  const w = el.width || 10;
  const d = el.height || 10;
  const isPlanned = el.status === 'planned';

  if (el.subtype === 'boundary_marker' || el.subtype === 'marker') {
    // X mark for boundary markers
    const xGeo = useMemo(() => {
      const s = 3;
      return new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-s, -s, 0), new THREE.Vector3(s, s, 0),
        new THREE.Vector3(-s, s, 0), new THREE.Vector3(s, -s, 0),
      ]);
    }, []);

    return (
      <group position={[el.x, 0.5, -el.y]} rotation={[-Math.PI / 2, 0, 0]}>
        <LineSegments3D geometry={xGeo} color="#FF4444" opacity={isPlanned ? 0.5 : 1} />
        <mesh>
          <circleGeometry args={[1.5, 8]} />
          <meshBasicMaterial color="#FF4444" transparent opacity={isPlanned ? 0.3 : 0.6} />
        </mesh>
      </group>
    );
  }

  if (el.subtype === 'hedge') {
    // Row of small circles (hedge in plan)
    const hedgeGeo = useMemo(() => {
      const points: THREE.Vector3[] = [];
      const count = Math.max(3, Math.floor(w / 4));
      const spacing = w / count;
      const radius = spacing * 0.4;
      for (let i = 0; i < count; i++) {
        const cx = -w / 2 + spacing * (i + 0.5);
        for (let j = 0; j < 12; j++) {
          const a1 = (j / 12) * Math.PI * 2;
          const a2 = ((j + 1) / 12) * Math.PI * 2;
          points.push(new THREE.Vector3(cx + Math.cos(a1) * radius, Math.sin(a1) * radius, 0));
          points.push(new THREE.Vector3(cx + Math.cos(a2) * radius, Math.sin(a2) * radius, 0));
        }
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    }, [w]);

    return (
      <group position={[el.x, 0.5, -el.y]} rotation={[-Math.PI / 2, 0, (el.rotation * Math.PI) / 180]}>
        <LineSegments3D geometry={hedgeGeo} color={color} opacity={isPlanned ? 0.4 : 0.8} />
      </group>
    );
  }

  // Default: rectangle outline (driveway, generic infrastructure)
  const outlineGeo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d]);

  // Stipple fill for driveways
  const stippleGeo = useMemo(() => {
    if (el.subtype !== 'driveway') return null;
    const hw = w / 2;
    const hd = d / 2;
    const spacing = 4;
    const points: THREE.Vector3[] = [];
    for (let x = -hw + spacing; x < hw; x += spacing) {
      for (let y = -hd + spacing; y < hd; y += spacing) {
        points.push(new THREE.Vector3(x - 0.3, y, 0));
        points.push(new THREE.Vector3(x + 0.3, y, 0));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, d, el.subtype]);

  return (
    <group position={[el.x, 0.4, -el.y]} rotation={[-Math.PI / 2, 0, (el.rotation * Math.PI) / 180]}>
      {/* Fill for driveways */}
      {el.subtype === 'driveway' && (
        <mesh>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={color} transparent opacity={isPlanned ? 0.08 : 0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Outline */}
      <Line3D geometry={outlineGeo} color={color} opacity={isPlanned ? 0.4 : 0.7} />
      {/* Stipple */}
      {stippleGeo && <LineSegments3D geometry={stippleGeo} color={color} opacity={isPlanned ? 0.2 : 0.4} />}
    </group>
  );
}

// ─── Plan symbol dispatcher ────────────────────────────────────────
export function PlanSymbol({ el }: { el: FarmElement }) {
  switch (el.type) {
    case 'tree':
      return <TreePlanSymbol el={el} />;
    case 'structure':
      return <StructurePlanSymbol el={el} />;
    case 'zone':
      return <ZonePlanSymbol el={el} />;
    case 'infrastructure':
      return <InfrastructurePlanSymbol el={el} />;
    default:
      return null;
  }
}
