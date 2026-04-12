import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/lib/store';
import type { FarmElement } from '@/lib/types';
import farmConfig, { DEFAULT_COLORS } from '@/farm.config';

// Merge default + farm-specific colors
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

// Ground plane — sized from config
function Ground() {
  const shape = useMemo(() => {
    const boundary = farmConfig.boundary;
    if (boundary.length < 3) return null;
    const s = new THREE.Shape();
    s.moveTo(boundary[0].x, boundary[0].y);
    for (let i = 1; i < boundary.length; i++) {
      s.lineTo(boundary[i].x, boundary[i].y);
    }
    s.closePath();
    return s;
  }, []);

  const [gx, gz] = farmConfig.ground.center;
  const [gw, gd] = farmConfig.ground.size;

  return (
    <group>
      {/* Extended ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gx, -0.5, gz]} receiveShadow>
        <planeGeometry args={[gw, gd]} />
        <meshStandardMaterial color="#3a5a2a" />
      </mesh>
      {/* Property boundary fill */}
      {shape && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color="#4a7a3a" />
        </mesh>
      )}
    </group>
  );
}

// Boundary outline
function BoundaryLine() {
  const points = useMemo(() => {
    const boundary = farmConfig.boundary;
    if (boundary.length < 2) return null;
    const pts = boundary.map(p => new THREE.Vector3(p.x, 0.5, -p.y));
    pts.push(pts[0].clone());
    return pts;
  }, []);

  if (!points) return null;
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points!), [points]);

  return (
    <line>
      <bufferGeometry attach="geometry" {...geo} />
      <lineBasicMaterial color="#ffffff" linewidth={2} transparent opacity={0.6} />
    </line>
  );
}

// Overlay lines (clearing edges, fence lines, etc.)
function OverlayLines() {
  const overlays = farmConfig.overlays || [];

  return (
    <>
      {overlays.map((overlay, idx) => {
        if (overlay.points.length < 2) return null;
        const pts = overlay.points.map(p => new THREE.Vector3(p.x, 0.3, -p.y));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <line key={idx}>
            <bufferGeometry attach="geometry" {...geo} />
            <lineBasicMaterial
              color={overlay.color || '#88aa66'}
              linewidth={1}
              transparent
              opacity={overlay.opacity ?? 0.4}
            />
          </line>
        );
      })}
    </>
  );
}

// Gable roof geometry — ridge runs along the longer axis of the building
function GableRoof({ w, d, roofHeight, color }: { w: number; d: number; roofHeight: number; color: string }) {
  const geo = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;
    const rh = roofHeight;
    const vertices = new Float32Array([
      -hw, 0,  hd,
       hw, 0,  hd,
       0,  rh, hd,
      -hw, 0, -hd,
       hw, 0, -hd,
       0,  rh,-hd,
    ]);
    const indices = [
      0, 1, 2,
      4, 3, 5,
      0, 2, 5, 0, 5, 3,
      1, 4, 5, 1, 5, 2,
      0, 3, 4, 0, 4, 1,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [w, d, roofHeight]);

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Structure element (box with gable roof)
function Structure({ el, selected, onClick }: { el: FarmElement; selected: boolean; onClick: () => void }) {
  const w = el.width || 20;
  const d = el.height || 15;
  const h = el.elevation || 12;
  const color = getColor(el);
  const roofColor = (el.metadata as Record<string, unknown>)?.roofColor as string || '#4a4a4a';
  const roofHeight = Math.min(w, d) * 0.3;
  const ridgeAlongX = w >= d;

  return (
    <group
      position={[el.x, h / 2, -el.y]}
      rotation={[0, (el.rotation * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={selected ? '#ffcc00' : color} />
      </mesh>
      <group
        position={[0, h / 2, 0]}
        rotation={ridgeAlongX ? [0, Math.PI / 2, 0] : [0, 0, 0]}
      >
        <GableRoof
          w={ridgeAlongX ? d : w}
          d={ridgeAlongX ? w : d}
          roofHeight={roofHeight}
          color={roofColor}
        />
      </group>
      <mesh position={[0, h / 2 - 0.1, 0]} castShadow>
        <boxGeometry args={[w + 2, 0.3, d + 2]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {selected && (
        <mesh position={[0, -h / 2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(w, d) * 0.6, Math.max(w, d) * 0.7, 32]} />
          <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// Tree element
function Tree({ el, selected, onClick }: { el: FarmElement; selected: boolean; onClick: () => void }) {
  const h = el.elevation || 20;
  const canopy = (el.width || 10) / 2;
  const color = getColor(el);
  const isPlanned = el.status === 'planned';
  const isPalm = el.subtype === 'royal_palm' || el.subtype === 'palm';
  const isPine = el.subtype === 'cook_pine' || el.subtype === 'pine' || el.subtype === 'conifer';

  return (
    <group
      position={[el.x, 0, -el.y]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh position={[0, h * 0.35, 0]} castShadow>
        <cylinderGeometry args={[isPalm ? 0.5 : 1, isPalm ? 0.8 : 1.5, h * 0.7, 8]} />
        <meshStandardMaterial color="#8B6914" transparent opacity={isPlanned ? 0.5 : 1} />
      </mesh>
      {isPine ? (
        <mesh position={[0, h * 0.65, 0]} castShadow>
          <coneGeometry args={[canopy * 0.4, h * 0.6, 8]} />
          <meshStandardMaterial color={color} transparent opacity={isPlanned ? 0.4 : 0.9} />
        </mesh>
      ) : isPalm ? (
        <mesh position={[0, h * 0.85, 0]} castShadow>
          <sphereGeometry args={[canopy * 0.6, 8, 6]} />
          <meshStandardMaterial color={color} transparent opacity={isPlanned ? 0.4 : 0.9} />
        </mesh>
      ) : (
        <mesh position={[0, h * 0.7, 0]} castShadow>
          <sphereGeometry args={[canopy, 12, 8]} />
          <meshStandardMaterial color={color} transparent opacity={isPlanned ? 0.4 : 0.9} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[canopy + 1, canopy + 2, 32]} />
          <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// Zone element (flat area with border)
function Zone({ el, selected, onClick }: { el: FarmElement; selected: boolean; onClick: () => void }) {
  const w = el.width || 30;
  const d = el.height || 30;
  const color = getColor(el);
  const isPlanned = el.status === 'planned';

  return (
    <group
      position={[el.x, 0.2, -el.y]}
      rotation={[0, (el.rotation * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={selected ? '#ffcc00' : color}
          transparent
          opacity={isPlanned ? 0.25 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(w, d)]} />
        <lineBasicMaterial color={selected ? '#ffcc00' : color} transparent opacity={0.8} />
      </lineSegments>
      <Text
        position={[0, 2, 0]}
        fontSize={4}
        color={isPlanned ? '#aaa' : '#fff'}
        anchorX="center"
        anchorY="middle"
      >
        {el.name}
      </Text>
    </group>
  );
}

// Infrastructure (driveways, hedges, markers)
function Infrastructure({ el, selected, onClick }: { el: FarmElement; selected: boolean; onClick: () => void }) {
  const w = el.width || 10;
  const d = el.height || 10;
  const h = el.elevation || 1;

  if (el.subtype === 'boundary_marker' || el.subtype === 'marker') {
    return (
      <group position={[el.x, 0, -el.y]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[0.3, 0.3, h, 8]} />
          <meshStandardMaterial color={selected ? '#ffcc00' : '#ff4444'} />
        </mesh>
      </group>
    );
  }

  const color = getColor(el);

  return (
    <group
      position={[el.x, h / 2, -el.y]}
      rotation={[0, (el.rotation * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={selected ? '#ffcc00' : color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// Camera controller with preset views — reads defaults from config
function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [tx, ty, tz] = farmConfig.camera.target;

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(tx, ty, tz);
    }
  });

  useMemo(() => {
    const [px, py, pz] = farmConfig.camera.position;
    camera.position.set(px, py, pz);
    (camera as THREE.PerspectiveCamera).far = farmConfig.camera.far || 2000;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera]);

  return <OrbitControls ref={controlsRef} maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={1200} />;
}

// Element renderer
function ElementMesh({ el }: { el: FarmElement }) {
  const selectedId = useStore(s => s.selectedId);
  const selectElement = useStore(s => s.selectElement);
  const selected = selectedId === el.id;
  const onClick = useCallback(() => selectElement(el.id), [el.id, selectElement]);

  switch (el.type) {
    case 'structure':
      return <Structure el={el} selected={selected} onClick={onClick} />;
    case 'tree':
      return <Tree el={el} selected={selected} onClick={onClick} />;
    case 'zone':
      return <Zone el={el} selected={selected} onClick={onClick} />;
    case 'infrastructure':
      return <Infrastructure el={el} selected={selected} onClick={onClick} />;
    default:
      return null;
  }
}

// Main scene
function Scene() {
  const elements = useStore(s => s.elements);
  const typeFilter = useStore(s => s.typeFilter);
  const statusFilter = useStore(s => s.statusFilter);
  const selectElement = useStore(s => s.selectElement);

  const filtered = useMemo(() => {
    return elements.filter(el => {
      if (typeFilter && el.type !== typeFilter) return false;
      if (statusFilter && el.status !== statusFilter) return false;
      return true;
    });
  }, [elements, typeFilter, statusFilter]);

  const [gx, gz] = farmConfig.ground.center;
  const [gw, gd] = farmConfig.ground.size;

  return (
    <>
      <CameraController />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[300, 400, 200]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={1500}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
      />
      <hemisphereLight args={['#87CEEB', '#3a5a2a', 0.3]} />

      {/* Sky */}
      <mesh>
        <sphereGeometry args={[1500, 32, 16]} />
        <meshBasicMaterial color="#5a8ab5" side={THREE.BackSide} />
      </mesh>

      {/* Ground & boundaries */}
      <Ground />
      <BoundaryLine />
      <OverlayLines />

      {/* Farm elements */}
      {filtered.map(el => (
        <ElementMesh key={el.id} el={el} />
      ))}

      {/* Click on ground to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[gx, -0.3, gz]}
        onClick={() => selectElement(null)}
        visible={false}
      >
        <planeGeometry args={[gw, gd]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export function FarmScene() {
  const cam = farmConfig.camera;
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ fov: 50, near: 1, far: cam.far || 2000, position: cam.position as [number, number, number] }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
