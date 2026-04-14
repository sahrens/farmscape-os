import { useRef, useState, useMemo, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/lib/store';
import type { FarmElement } from '@/lib/types';
import farmConfig, { DEFAULT_COLORS } from '@/farm.config';

// ─── Error boundary ───────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: string }
class CanvasErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FarmScene crash]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-earth-900 gap-4 p-6">
          <div className="text-earth-400 text-sm text-center">3D view encountered an error</div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-4 py-2 bg-forest-600 hover:bg-forest-500 text-white text-sm rounded-lg"
          >
            Tap to reload
          </button>
          <div className="text-earth-600 text-xs max-w-xs text-center">{this.state.error}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// Gable roof geometry
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

// ─── Edit mode handles ─────────────────────────────────────────────
// Rendered at Scene level (not inside ElementMesh) to avoid remount during drag.
// Design: pinhead sphere on a tall stick (drag to move), flat ring at ground (drag to rotate).
// Uses global window pointerup/pointermove for robust touch handling.

function EditGizmo() {
  const editingElementId = useStore(s => s.editingElementId);
  if (!editingElementId) return null;
  return <EditGizmoInner key={editingElementId} elementId={editingElementId} />;
}

function EditGizmoInner({ elementId }: { elementId: string }) {
  const { camera, raycaster, gl } = useThree();
  const modeRef = useRef<'idle' | 'drag' | 'rotate'>('idle');
  const poleRef = useRef<THREE.Group>(null);
  const pinRef = useRef<THREE.Mesh>(null);
  const pinMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringGroupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const dirRef = useRef<THREE.Mesh>(null);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const intersectPoint = useMemo(() => new THREE.Vector3(), []);
  const pointerNDC = useMemo(() => new THREE.Vector2(), []);

  // Element sizing
  const initEl = useStore(s => s.elements.find(e => e.id === elementId));
  const elHeight = initEl?.elevation || 20;
  const pinHeight = elHeight + 25; // tall stick above element
  const pinRadius = 5; // large sphere at top — easy to grab
  const ringRadius = Math.max(initEl?.width || 10, initEl?.height || 10, 10) * 0.5 + 5;
  const ringThickness = 3;

  // Convert DOM event coords to NDC for raycasting
  const toNDC = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }, [gl, pointerNDC]);

  // Global pointer move — runs outside R3F event system
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (modeRef.current === 'idle') return;
      const el = useStore.getState().elements.find(e2 => e2.id === elementId);
      if (!el) return;
      toNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, intersectPoint)) return;

      if (modeRef.current === 'drag') {
        useStore.getState().moveElement(elementId, intersectPoint.x, -intersectPoint.z);
      } else if (modeRef.current === 'rotate') {
        const dx = intersectPoint.x - el.x;
        const dz = intersectPoint.z - (-el.y);
        const degrees = (Math.atan2(dx, dz) * 180) / Math.PI;
        useStore.getState().rotateElement(elementId, degrees);
      }
    };

    const onUp = () => {
      if (modeRef.current === 'idle') return;
      const wasDrag = modeRef.current === 'drag';
      modeRef.current = 'idle';
      // Reset visuals
      if (wasDrag && pinMatRef.current) {
        pinMatRef.current.color.set('#4488ff');
        pinMatRef.current.opacity = 0.8;
      }
      if (!wasDrag && ringMatRef.current) {
        ringMatRef.current.color.set('#ff6622');
        ringMatRef.current.opacity = 0.5;
      }
      useStore.getState().persistElement(elementId);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [elementId, camera, raycaster, groundPlane, intersectPoint, pointerNDC, toNDC, gl]);

  // Imperative frame updates — position pole, ring, direction indicator
  useFrame(() => {
    const el = useStore.getState().elements.find(e => e.id === elementId);
    if (!el) return;
    // Pole group at element position
    if (poleRef.current) poleRef.current.position.set(el.x, 0, -el.y);
    // Ring group at ground level
    if (ringGroupRef.current) ringGroupRef.current.position.set(el.x, 0.5, -el.y);
    // Direction indicator on ring
    if (dirRef.current) {
      const rad = (el.rotation * Math.PI) / 180;
      dirRef.current.position.set(
        el.x + ringRadius * Math.sin(rad),
        2,
        -el.y + ringRadius * Math.cos(rad),
      );
    }
  });

  const onPinDown = useCallback((e: any) => {
    e.stopPropagation();
    modeRef.current = 'drag';
    if (pinMatRef.current) { pinMatRef.current.color.set('#66aaff'); pinMatRef.current.opacity = 1; }
  }, []);

  const onRingDown = useCallback((e: any) => {
    e.stopPropagation();
    modeRef.current = 'rotate';
    if (ringMatRef.current) { ringMatRef.current.color.set('#ff8844'); ringMatRef.current.opacity = 0.8; }
  }, []);

  const ix = initEl?.x || 0;
  const iy = initEl?.y || 0;

  return (
    <>
      {/* ── Move handle: tall pole with pinhead sphere ── */}
      <group ref={poleRef} position={[ix, 0, -iy]}>
        {/* Pole */}
        <mesh position={[0, pinHeight / 2, 0]}>
          <cylinderGeometry args={[0.4, 0.4, pinHeight, 8]} />
          <meshBasicMaterial color="#4488ff" transparent opacity={0.5} depthTest={false} />
        </mesh>
        {/* Pinhead sphere — large, easy to grab */}
        <mesh
          ref={pinRef}
          position={[0, pinHeight, 0]}
          onPointerDown={onPinDown}
        >
          <sphereGeometry args={[pinRadius, 16, 12]} />
          <meshBasicMaterial ref={pinMatRef} color="#4488ff" transparent opacity={0.8} depthTest={false} />
        </mesh>
        {/* Cross icon on pinhead */}
        <mesh position={[0, pinHeight + pinRadius + 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 1.5, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} />
        </mesh>
      </group>

      {/* ── Rotate handle: flat ring at ground level ── */}
      <group ref={ringGroupRef} position={[ix, 0.5, -iy]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={onRingDown}
        >
          <ringGeometry args={[ringRadius - ringThickness / 2, ringRadius + ringThickness / 2, 48]} />
          <meshBasicMaterial ref={ringMatRef} color="#ff6622" transparent opacity={0.5} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      </group>

      {/* Direction indicator on ring */}
      <mesh ref={dirRef} position={[ix + ringRadius, 2, -iy]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshBasicMaterial color="#ff6622" depthTest={false} />
      </mesh>
    </>
  );
}

// ─── Camera controller ─────────────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const cameraTarget = useStore(s => s.cameraTarget);
  const clearCameraTarget = useStore(s => s.clearCameraTarget);
  const focusTarget = useStore(s => s.focusTarget);
  const clearFocusTarget = useStore(s => s.clearFocusTarget);
  const editMode = useStore(s => s.editMode);

  // Animation state for flyTo
  const animRef = useRef({
    animating: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
  });

  // Animation state for focusOn (orbit center only)
  const focusAnimRef = useRef({
    animating: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
  });

  const [tx, ty, tz] = farmConfig.camera.target;
  const initRef = useRef(false);

  // Initialize camera position
  useMemo(() => {
    const [px, py, pz] = farmConfig.camera.position;
    camera.position.set(px, py, pz);
    (camera as THREE.PerspectiveCamera).far = farmConfig.camera.far || 2000;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera]);

  // Start flyTo animation
  useEffect(() => {
    if (!cameraTarget || !controlsRef.current) return;
    const anim = animRef.current;
    anim.startPos.copy(camera.position);
    anim.endPos.set(...cameraTarget.position);
    anim.startTarget.copy(controlsRef.current.target);
    anim.endTarget.set(...cameraTarget.target);
    anim.progress = 0;
    anim.animating = true;
  }, [cameraTarget, camera]);

  // Start focusOn animation — only moves orbit center, camera follows to maintain offset
  useEffect(() => {
    if (!focusTarget || !controlsRef.current) return;
    const anim = focusAnimRef.current;
    const controls = controlsRef.current;

    // Current offset from target to camera
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);

    anim.startPos.copy(camera.position);
    anim.startTarget.copy(controls.target);
    anim.endTarget.set(...focusTarget);
    // Camera end = new target + same offset (preserves zoom, bearing, pitch)
    anim.endPos.copy(anim.endTarget).add(offset);
    anim.progress = 0;
    anim.animating = true;
  }, [focusTarget, camera]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // flyTo animation
    const anim = animRef.current;
    if (anim.animating) {
      anim.progress = Math.min(1, anim.progress + delta * 1.5);
      const t = anim.progress < 0.5
        ? 2 * anim.progress * anim.progress
        : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;

      camera.position.lerpVectors(anim.startPos, anim.endPos, t);
      controlsRef.current.target.lerpVectors(anim.startTarget, anim.endTarget, t);

      if (anim.progress >= 1) {
        anim.animating = false;
        camera.position.copy(anim.endPos);
        controlsRef.current.target.copy(anim.endTarget);
        clearCameraTarget();
      }
    }

    // focusOn animation (orbit center only, preserves offset)
    const focus = focusAnimRef.current;
    if (focus.animating) {
      focus.progress = Math.min(1, focus.progress + delta * 2);
      const t = focus.progress < 0.5
        ? 2 * focus.progress * focus.progress
        : 1 - Math.pow(-2 * focus.progress + 2, 2) / 2;

      camera.position.lerpVectors(focus.startPos, focus.endPos, t);
      controlsRef.current.target.lerpVectors(focus.startTarget, focus.endTarget, t);

      if (focus.progress >= 1) {
        focus.animating = false;
        camera.position.copy(focus.endPos);
        controlsRef.current.target.copy(focus.endTarget);
        clearFocusTarget();
      }
    }

    // Set initial target once after controls mount
    if (!initRef.current) {
      controlsRef.current.target.set(tx, ty, tz);
      initRef.current = true;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={20}
      maxDistance={1200}
      enabled={!editMode || !useStore.getState().editingElementId}
      enableRotate={!editMode}
    />
  );
}

// Element renderer
function ElementMesh({ el }: { el: FarmElement }) {
  const selectedId = useStore(s => s.selectedId);
  const selectElement = useStore(s => s.selectElement);
  const editMode = useStore(s => s.editMode);
  const editingElementId = useStore(s => s.editingElementId);
  const enterEditMode = useStore(s => s.enterEditMode);
  const selected = selectedId === el.id;

  const onClick = useCallback(() => {
    if (editMode) {
      // In edit mode, clicking an element switches editing to it
      enterEditMode(el.id);
    } else {
      selectElement(el.id);
    }
  }, [el.id, editMode, selectElement, enterEditMode]);

  const isEditing = editMode && editingElementId === el.id;

  return (
    <>
      {(() => {
        switch (el.type) {
          case 'structure':
            return <Structure el={el} selected={selected || isEditing} onClick={onClick} />;
          case 'tree':
            return <Tree el={el} selected={selected || isEditing} onClick={onClick} />;
          case 'zone':
            return <Zone el={el} selected={selected || isEditing} onClick={onClick} />;
          case 'infrastructure':
            return <Infrastructure el={el} selected={selected || isEditing} onClick={onClick} />;
          default:
            return null;
        }
      })()}
      {/* Edit handles rendered at Scene level, not here */}
    </>
  );
}

// Main scene
function Scene() {
  const elements = useStore(s => s.elements);
  const typeFilter = useStore(s => s.typeFilter);
  const statusFilter = useStore(s => s.statusFilter);
  const selectElement = useStore(s => s.selectElement);
  const editMode = useStore(s => s.editMode);
  const editingElementId = useStore(s => s.editingElementId);
  const exitEditMode = useStore(s => s.exitEditMode);

  const filtered = useMemo(() => {
    return elements.filter(el => {
      if (typeFilter && el.type !== typeFilter) return false;
      if (statusFilter && el.status !== statusFilter) return false;
      return true;
    });
  }, [elements, typeFilter, statusFilter]);

  const [gx, gz] = farmConfig.ground.center;
  const [gw, gd] = farmConfig.ground.size;

  const handleGroundClick = useCallback(() => {
    if (editMode) {
      exitEditMode();
    } else {
      selectElement(null);
    }
  }, [editMode, exitEditMode, selectElement]);

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

      {/* Edit gizmo — rendered at scene level, decoupled from element re-renders */}
      {editMode && <EditGizmo />}

      {/* Click on ground to deselect / exit edit mode */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[gx, -0.3, gz]}
        onClick={handleGroundClick}
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
  const [ready, setReady] = useState(false);

  return (
    <div className="w-full h-full relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-earth-900 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-earth-600 border-t-forest-400 rounded-full animate-spin" />
            <span className="text-earth-400 text-sm">Loading 3D view...</span>
          </div>
        </div>
      )}
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ fov: 50, near: 1, far: cam.far || 2000, position: cam.position as [number, number, number] }}
          gl={{ antialias: true }}
          onCreated={() => setReady(true)}
        >
          <Scene />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
