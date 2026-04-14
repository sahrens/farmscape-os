import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { FarmElement } from '@/lib/types';
import farmConfig from '@/farm.config';
import { formatGps, googleMapsUrl } from '@/lib/geo';

const ACTIVITY_TYPES = [
  { value: 'watering', label: 'Watering', icon: '💧' },
  { value: 'pruning', label: 'Pruning', icon: '✂️' },
  { value: 'planting', label: 'Planting', icon: '🌱' },
  { value: 'harvesting', label: 'Harvesting', icon: '🧺' },
  { value: 'fertilizing', label: 'Fertilizing', icon: '🧪' },
  { value: 'weeding', label: 'Weeding', icon: '🌿' },
  { value: 'mulching', label: 'Mulching', icon: '🍂' },
  { value: 'observation', label: 'Observation', icon: '👁️' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
];

const TYPE_ICONS: Record<string, string> = {
  structure: '🏠',
  tree: '🌳',
  zone: '📐',
  infrastructure: '🛤️',
};

// Read subtype labels from config, with sensible fallback formatting
function getSubtypeLabel(subtype: string | null): string {
  if (!subtype) return '';
  const labels = farmConfig.subtypeLabels || {};
  if (labels[subtype]) return labels[subtype];
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

/** GPS coordinate display helper — reads lat/lng directly from element */
function GpsDisplay({ el }: { el: FarmElement }) {
  if (el.lat == null || el.lng == null) return null;

  const url = googleMapsUrl(el.lat, el.lng);

  return (
    <div>
      <span className="text-earth-400">GPS</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-forest-400 hover:text-forest-300 text-xs font-mono underline"
      >
        {formatGps(el.lat, el.lng)}
      </a>
    </div>
  );
}

function ElementRow({ el }: { el: FarmElement }) {
  const selectedId = useStore(s => s.selectedId);
  const selectElement = useStore(s => s.selectElement);
  const selected = selectedId === el.id;

  return (
    <button
      onClick={() => selectElement(el.id)}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm active:scale-[0.98] ${
        selected
          ? 'bg-forest-700 text-white'
          : 'hover:bg-earth-700 text-earth-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{TYPE_ICONS[el.type] || '📍'}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{el.name}</div>
          <div className="text-xs text-earth-400">
            {getSubtypeLabel(el.subtype) || el.type}
            {el.status === 'planned' && (
              <span className="ml-1 text-vanilla-500">(planned)</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ActivityForm() {
  const [actType, setActType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const createActivity = useStore(s => s.createActivity);

  const handleSubmit = async () => {
    if (!actType || saving) return;
    setSaving(true);
    setSuccess(false);
    const ok = await createActivity(actType, notes);
    setSaving(false);
    if (ok) {
      setActType('');
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  return (
    <div className="bg-earth-800 rounded-lg p-3 space-y-2">
      <h3 className="text-sm font-semibold text-earth-300">Log Activity</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {ACTIVITY_TYPES.map(at => (
          <button
            key={at.value}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActType(actType === at.value ? '' : at.value);
            }}
            className={`px-1.5 py-2 rounded text-xs transition-colors text-center active:scale-95 select-none ${
              actType === at.value
                ? 'bg-forest-600 text-white ring-2 ring-forest-400'
                : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
            }`}
          >
            <span className="block text-lg leading-none mb-0.5">{at.icon}</span>
            {at.label}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 resize-none"
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSubmit();
        }}
        disabled={!actType || saving}
        className={`w-full py-3 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] select-none ${
          !actType || saving
            ? 'bg-earth-600 text-earth-400 cursor-not-allowed'
            : success
            ? 'bg-forest-500 text-white'
            : 'bg-forest-600 hover:bg-forest-500 text-white'
        }`}
      >
        {saving ? 'Saving...' : success ? '✓ Saved!' : 'Log Activity'}
      </button>
    </div>
  );
}

function ElementDetail({ el }: { el: FarmElement }) {
  const activities = useStore(s => s.activities);
  const activitiesLoading = useStore(s => s.activitiesLoading);
  const flyTo = useStore(s => s.flyTo);
  // Clear selection without closing sidebar — returns to element list
  const clearSelection = () => useStore.setState({ selectedId: null });
  const u = farmConfig.unitLabel;

  const handleFlyTo = () => {
    // Preserve current bearing/yaw — only change distance and pitch.
    // We read the current camera position from the Three.js canvas to
    // compute the current horizontal angle, then position the camera at
    // that same angle around the element.
    const elHeight = el.elevation || 10;
    const span = Math.max(el.width || 30, el.height || 30, 60);
    const dist = span * 2.2;
    const targetPos: [number, number, number] = [el.x, elHeight * 0.3, -el.y];

    // Try to read current camera bearing from the Three.js canvas
    const canvas = document.querySelector('canvas');
    let bearing = Math.PI / 4; // default 45° if we can't read it
    if (canvas && (canvas as any).__r3f) {
      const cam = (canvas as any).__r3f.store?.getState()?.camera;
      if (cam) {
        // Horizontal angle from current camera to element target
        const dx = cam.position.x - targetPos[0];
        const dz = cam.position.z - targetPos[2];
        bearing = Math.atan2(dx, dz);
      }
    }

    // Fixed pitch angle (~30° above horizon)
    const pitch = Math.PI / 6;
    const camX = targetPos[0] + dist * Math.sin(bearing) * Math.cos(pitch);
    const camY = targetPos[1] + dist * Math.sin(pitch);
    const camZ = targetPos[2] + dist * Math.cos(bearing) * Math.cos(pitch);

    flyTo([camX, camY, camZ], targetPos);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-earth-50">{el.name}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFlyTo}
            className="text-earth-400 hover:text-forest-300 text-sm px-2 py-1 rounded bg-earth-700 hover:bg-earth-600 active:scale-95 transition-colors"
            title="Fly camera to element"
          >
            📍 Focus
          </button>
          <button
            onClick={clearSelection}
            className="text-earth-400 hover:text-earth-200 text-2xl leading-none p-1 active:scale-90"
          >
            ×
          </button>
        </div>
      </div>

      <div className="bg-earth-800 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-earth-400">Type</span>
            <div className="text-earth-100 capitalize">{el.type}</div>
          </div>
          <div>
            <span className="text-earth-400">Subtype</span>
            <div className="text-earth-100">{getSubtypeLabel(el.subtype) || '—'}</div>
          </div>
          <div>
            <span className="text-earth-400">Status</span>
            <div className={`capitalize ${el.status === 'planned' ? 'text-vanilla-500' : 'text-forest-400'}`}>
              {el.status}
            </div>
          </div>
          <div>
            <span className="text-earth-400">Position</span>
            <div className="text-earth-100 text-xs">
              {el.x.toFixed(0)}{u} E, {el.y.toFixed(0)}{u} N
            </div>
          </div>
          {el.width && (
            <div>
              <span className="text-earth-400">Size</span>
              <div className="text-earth-100 text-xs">
                {el.width.toFixed(0)} × {(el.height || 0).toFixed(0)} {u}
              </div>
            </div>
          )}
          {el.elevation && (
            <div>
              <span className="text-earth-400">Height</span>
              <div className="text-earth-100">{el.elevation} {u}</div>
            </div>
          )}
          <GpsDisplay el={el} />
        </div>
      </div>

      {/* Activity logging form */}
      <ActivityForm />

      {/* Recent Activities */}
      <div>
        <h3 className="text-sm font-semibold text-earth-300 mb-2">Recent Activity</h3>
        {activitiesLoading ? (
          <div className="text-earth-500 text-sm">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="text-earth-500 text-sm italic">No activities logged yet</div>
        ) : (
          <div className="space-y-1">
            {activities.slice(0, 5).map(a => (
              <div key={a.id} className="bg-earth-800 rounded p-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-earth-200 capitalize">{a.type}</span>
                  <span className="text-earth-500">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                {a.notes && <div className="text-earth-400 mt-1">{a.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarContent() {
  const elements = useStore(s => s.elements);
  const selectedId = useStore(s => s.selectedId);
  const typeFilter = useStore(s => s.typeFilter);
  const setTypeFilter = useStore(s => s.setTypeFilter);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);

  const selectedElement = useMemo(
    () => elements.find(e => e.id === selectedId) || null,
    [elements, selectedId]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, FarmElement[]> = {};
    for (const el of elements) {
      if (typeFilter && el.type !== typeFilter) continue;
      if (!groups[el.type]) groups[el.type] = [];
      groups[el.type].push(el);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [elements, typeFilter]);

  const types = ['structure', 'tree', 'zone', 'infrastructure'];
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of elements) {
      counts[el.type] = (counts[el.type] || 0) + 1;
    }
    return counts;
  }, [elements]);

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-earth-700 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-forest-300">{farmConfig.name}</h1>
        <button
          onClick={() => setSidebarOpen(false)}
          className="text-earth-400 hover:text-earth-200 text-xl p-1 active:scale-90"
        >
          ✕
        </button>
      </div>

      {/* Type filter */}
      <div className="px-3 py-2 border-b border-earth-700 flex gap-1.5 flex-wrap shrink-0">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors active:scale-95 ${
            !typeFilter ? 'bg-forest-600 text-white' : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
          }`}
        >
          All ({elements.length})
        </button>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors active:scale-95 ${
              typeFilter === t ? 'bg-forest-600 text-white' : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
            }`}
          >
            {TYPE_ICONS[t]} {typeCounts[t] || 0}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedElement ? (
          <ElementDetail el={selectedElement} />
        ) : (
          <div className="p-2 space-y-3 pb-8">
            {types.map(type => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-3 py-1 text-xs font-semibold text-earth-400 uppercase tracking-wider">
                    {type}s ({group.length})
                  </div>
                  <div className="space-y-0.5">
                    {group.map(el => (
                      <ElementRow key={el.id} el={el} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** Mobile bottom sheet with drag-to-dismiss */
function MobileSheet({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, currentY: 0, dragging: false });
  const [translateY, setTranslateY] = useState(0);
  const setSheetHeight = useStore(s => s.setSheetHeight);

  // Report sheet height to store so Canvas can resize
  useEffect(() => {
    const measure = () => {
      if (sheetRef.current) {
        const visible = sheetRef.current.offsetHeight - translateY;
        setSheetHeight(Math.max(0, visible));
      }
    };
    measure();
    return () => setSheetHeight(0);
  }, [translateY, setSheetHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current.startY = e.touches[0].clientY;
    dragRef.current.dragging = true;
    setTranslateY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    const dy = e.touches[0].clientY - dragRef.current.startY;
    if (dy > 0) {
      setTranslateY(dy);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragRef.current.dragging = false;
    if (translateY > 80) {
      setSheetHeight(0);
      onClose();
    } else {
      setTranslateY(0);
    }
  }, [translateY, onClose]);

  return (
    <>
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 z-50 bg-earth-800 border-t border-earth-700 rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          maxHeight: '45vh',
          transform: `translateY(${translateY}px)`,
          transition: translateY === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-earth-600 rounded-full" />
        </div>
        <SidebarContent />
      </div>
    </>
  );
}

/**
 * Sidebar — renders as a desktop side panel or mobile bottom sheet.
 * The toggle button is now in the NavBar (Toolbar), so this component
 * only renders when sidebarOpen is true.
 */
export function Sidebar() {
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const isMobile = useIsMobile();

  const handleClose = useCallback(() => {
    setSidebarOpen(false);
    // Trigger resize so Three.js canvas recalculates its dimensions
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }, [setSidebarOpen]);

  if (!sidebarOpen) return null;

  if (isMobile) {
    return <MobileSheet onClose={handleClose} />;
  }

  return (
    <div className="absolute top-0 left-0 bottom-0 w-80 z-40 bg-earth-800/95 backdrop-blur border-r border-earth-700 flex flex-col overflow-hidden">
      <SidebarContent />
    </div>
  );
}
