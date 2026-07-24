import { create } from 'zustand';
import type { FarmElement, Activity, User } from './types';
import * as api from './api';
import { localToGps } from './geo';
import farmConfig from '@/farm.config';

/** Compute GPS from local coords using farm geoReference */
function syncGpsFromLocal(el: { x: number; y: number }): { lat: number; lng: number } | null {
  const ref = farmConfig.geoReference;
  if (!ref) return null;
  return localToGps(el.x, el.y, ref.origin, ref.bearing, ref.metersPerUnit);
}

interface FarmStore {
  // Auth
  authenticated: boolean;
  authChecked: boolean;
  user: User | null;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;

  // Elements
  elements: FarmElement[];
  elementsLoading: boolean;
  fetchElements: () => Promise<void>;

  // Selection
  selectedId: string | null;
  selectElement: (id: string | null) => void;

  // Activities for selected element
  activities: Activity[];
  activitiesLoading: boolean;
  fetchActivities: (elementId?: string) => Promise<void>;
  createActivity: (type: string, notes: string) => Promise<boolean>;

  // View
  view: 'map' | '3d';
  setView: (v: 'map' | '3d') => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sheetHeight: number;
  setSheetHeight: (h: number) => void;

  // Camera
  cameraTarget: { position: [number, number, number]; target: [number, number, number] } | null;
  flyTo: (position: [number, number, number], target: [number, number, number]) => void;
  clearCameraTarget: () => void;
  // New: focus that only moves orbit center
  focusTarget: [number, number, number] | null;
  focusOn: (target: [number, number, number]) => void;
  clearFocusTarget: () => void;

  // Filter
  typeFilter: string | null;
  statusFilter: string | null;
  setTypeFilter: (f: string | null) => void;
  setStatusFilter: (f: string | null) => void;

  // Edit mode
  editMode: boolean;
  editingElementId: string | null;
  enterEditMode: (elementId: string) => void;
  exitEditMode: () => void;

  // Undo stack (per-element position/rotation snapshots)
  undoStack: Array<{ elementId: string; x: number; y: number; rotation: number; timestamp: number }>;
  pushUndo: (elementId: string) => void;
  undoElement: (elementId: string) => Promise<boolean>;

  // Terrain
  terrainEnabled: boolean;
  setTerrainEnabled: (enabled: boolean) => void;
  terrainData: api.TerrainData | null;
  terrainLoading: boolean;
  terrainEditMode: boolean;
  setTerrainEditMode: (active: boolean) => void;
  terrainBrushMode: 'raise' | 'lower' | 'smooth';
  setTerrainBrushMode: (mode: 'raise' | 'lower' | 'smooth') => void;
  terrainBrushSize: number;
  setTerrainBrushSize: (size: number) => void;
  fetchTerrain: () => Promise<void>;
  saveTerrain: (heights: number[]) => Promise<boolean>;

  // Image Layers
  imageLayers: api.ImageLayer[];
  imageLayersLoading: boolean;
  fetchImageLayers: () => Promise<void>;
  createImageLayer: (layer: Partial<api.ImageLayer>) => Promise<string | null>;
  updateImageLayer: (id: string, updates: Partial<api.ImageLayer>) => Promise<boolean>;
  deleteImageLayer: (id: string) => Promise<boolean>;

  // Element CRUD
  createElement: (el: Partial<FarmElement>) => Promise<string | null>;
  updateElement: (id: string, updates: Partial<FarmElement>) => Promise<boolean>;
  deleteElement: (id: string) => Promise<boolean>;
  /** Update element position locally (optimistic) and persist */
  moveElement: (id: string, x: number, y: number) => void;
  rotateElement: (id: string, rotation: number) => void;
  persistElement: (id: string) => Promise<boolean>;
}

export const useStore = create<FarmStore>((set, get) => ({
  // Auth
  authenticated: false,
  authChecked: false,
  user: null,
  checkAuth: async () => {
    try {
      const result = await api.auth.check();
      set({
        authenticated: result.authenticated,
        user: result.user || null,
        authChecked: true,
      });
    } catch {
      set({ authenticated: false, user: null, authChecked: true });
    }
  },
  setUser: (user) => set({ user, authenticated: !!user }),
  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    set({ authenticated: false, user: null });
  },

  // Elements
  elements: [],
  elementsLoading: false,
  fetchElements: async () => {
    set({ elementsLoading: true });
    try {
      const els = await api.elements.list();
      const parsed = els.map(el => ({
        ...el,
        metadata: typeof el.metadata === 'string' ? JSON.parse(el.metadata) : el.metadata,
      }));
      set({ elements: parsed, elementsLoading: false });
    } catch (err) {
      console.error('Failed to fetch elements:', err);
      set({ elementsLoading: false });
    }
  },

  // Selection
  selectedId: null,
  selectElement: (id) => {
    set({ selectedId: id, sidebarOpen: !!id });
    if (id) {
      window.history.replaceState(null, '', `#${id}`);
      get().fetchActivities(id);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  },

  // Activities
  activities: [],
  activitiesLoading: false,
  fetchActivities: async (elementId) => {
    set({ activitiesLoading: true });
    try {
      const acts = await api.activities.list(elementId, 20);
      set({ activities: acts, activitiesLoading: false });
    } catch {
      set({ activitiesLoading: false });
    }
  },
  createActivity: async (type: string, notes: string) => {
    const elementId = get().selectedId;
    if (!elementId) return false;
    try {
      const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await api.activities.create({
        id,
        element_id: elementId,
        type,
        notes: notes || undefined,
        is_test: 1,
        created_at: new Date().toISOString(),
      });
      await get().fetchActivities(elementId);
      return true;
    } catch (err) {
      console.error('Failed to create activity:', err);
      return false;
    }
  },

  // View
  view: '3d',
  setView: (v) => set({ view: v }),

  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sheetHeight: 0,
  setSheetHeight: (h) => set({ sheetHeight: h }),

  // Camera
  cameraTarget: null,
  flyTo: (position, target) => set({ cameraTarget: { position, target } }),
  clearCameraTarget: () => set({ cameraTarget: null }),

  // Focus — only moves orbit center, preserves camera offset
  focusTarget: null,
  focusOn: (target) => set({ focusTarget: target }),
  clearFocusTarget: () => set({ focusTarget: null }),

  // Filter
  typeFilter: null,
  statusFilter: null,
  setTypeFilter: (f) => set({ typeFilter: f }),
  setStatusFilter: (f) => set({ statusFilter: f }),

  // Edit mode
  editMode: false,
  editingElementId: null,
  enterEditMode: (elementId) => {
    // Only close sidebar on mobile (< 768px) — desktop has enough space
    const closeSidebar = typeof window !== 'undefined' && window.innerWidth < 768;
    set({
      editMode: true,
      editingElementId: elementId,
      selectedId: elementId,
      ...(closeSidebar ? { sidebarOpen: false } : {}),
    });
  },
  exitEditMode: () => {
    set({ editMode: false, editingElementId: null });
  },

  // Undo stack
  undoStack: [],
  pushUndo: (elementId) => {
    const el = get().elements.find(e => e.id === elementId);
    if (!el) return;
    set(s => ({
      undoStack: [
        ...s.undoStack.slice(-49), // keep last 50 entries
        { elementId, x: el.x, y: el.y, rotation: el.rotation, timestamp: Date.now() },
      ],
    }));
  },
  undoElement: async (elementId) => {
    const stack = get().undoStack;
    // Find the most recent entry for this element
    const idx = stack.findLastIndex(e => e.elementId === elementId);
    if (idx === -1) return false;
    const entry = stack[idx];
    // Remove it from stack
    set(s => ({ undoStack: s.undoStack.filter((_, i) => i !== idx) }));
    // Apply locally
    set(s => ({
      elements: s.elements.map(el =>
        el.id === elementId ? { ...el, x: entry.x, y: entry.y, rotation: entry.rotation } : el
      ),
    }));
    // Persist to server
    try {
      await api.elements.revert(elementId, { x: entry.x, y: entry.y, rotation: entry.rotation });
      return true;
    } catch (err) {
      console.error('Failed to revert element:', err);
      return false;
    }
  },

  // Element CRUD
  createElement: async (el) => {
    try {
      const id = el.id || `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Compute GPS from local coords if not provided
      let lat = el.lat;
      let lng = el.lng;
      if ((lat == null || lng == null) && el.x != null && el.y != null) {
        const gps = syncGpsFromLocal({ x: el.x, y: el.y });
        if (gps) {
          lat = gps.lat;
          lng = gps.lng;
        }
      }
      const now = new Date().toISOString();
      const full: Partial<FarmElement> = {
        ...el,
        id,
        lat,
        lng,
        created_at: now,
        updated_at: now,
      };
      await api.elements.create(full);
      await get().fetchElements();
      return id;
    } catch (err) {
      console.error('Failed to create element:', err);
      return null;
    }
  },

  updateElement: async (id, updates) => {
    try {
      // Sync GPS if position changed
      let lat = updates.lat;
      let lng = updates.lng;
      if ((lat === undefined || lng === undefined) && (updates.x !== undefined || updates.y !== undefined)) {
        const el = get().elements.find(e => e.id === id);
        if (el) {
          const x = updates.x ?? el.x;
          const y = updates.y ?? el.y;
          const gps = syncGpsFromLocal({ x, y });
          if (gps) {
            lat = gps.lat;
            lng = gps.lng;
          }
        }
      }
      await api.elements.update(id, { ...updates, lat, lng, updated_at: new Date().toISOString() });
      await get().fetchElements();
      return true;
    } catch (err) {
      console.error('Failed to update element:', err);
      return false;
    }
  },

  deleteElement: async (id) => {
    try {
      await api.elements.remove(id);
      set(s => ({
        elements: s.elements.filter(e => e.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        editingElementId: s.editingElementId === id ? null : s.editingElementId,
        editMode: s.editingElementId === id ? false : s.editMode,
      }));
      return true;
    } catch (err) {
      console.error('Failed to delete element:', err);
      return false;
    }
  },

  /** Optimistic local position update (for drag) */
  moveElement: (id, x, y) => {
    set(s => ({
      elements: s.elements.map(el =>
        el.id === id ? { ...el, x, y } : el
      ),
    }));
  },

  /** Optimistic local rotation update */
  rotateElement: (id, rotation) => {
    set(s => ({
      elements: s.elements.map(el =>
        el.id === id ? { ...el, rotation } : el
      ),
    }));
  },

  /** Persist current element state to server (after drag/rotate ends) */
  persistElement: async (id) => {
    const el = get().elements.find(e => e.id === id);
    if (!el) return false;
    const gps = syncGpsFromLocal({ x: el.x, y: el.y });
    try {
      await api.elements.update(id, {
        x: el.x,
        y: el.y,
        rotation: el.rotation,
        lat: gps?.lat ?? el.lat,
        lng: gps?.lng ?? el.lng,
        updated_at: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      console.error('Failed to persist element:', err);
      return false;
    }
  },

  // Terrain
  terrainEnabled: false,
  setTerrainEnabled: (enabled) => set({ terrainEnabled: enabled }),
  terrainData: null,
  terrainLoading: false,
  terrainEditMode: false,
  setTerrainEditMode: (active) => set({ terrainEditMode: active }),
  terrainBrushMode: 'raise' as const,
  setTerrainBrushMode: (mode) => set({ terrainBrushMode: mode }),
  terrainBrushSize: 3,
  setTerrainBrushSize: (size) => set({ terrainBrushSize: size }),
  fetchTerrain: async () => {
    set({ terrainLoading: true });
    try {
      const data = await api.terrain.get();
      set({ terrainData: data, terrainLoading: false });
    } catch (err) {
      console.error('Failed to fetch terrain:', err);
      set({ terrainLoading: false });
    }
  },
  saveTerrain: async (heights) => {
    const current = get().terrainData;
    if (!current) return false;
    try {
      await api.terrain.save({ ...current, heights });
      set({ terrainData: { ...current, heights } });
      return true;
    } catch (err) {
      console.error('Failed to save terrain:', err);
      return false;
    }
  },

  // Image Layers
  imageLayers: [],
  imageLayersLoading: false,
  fetchImageLayers: async () => {
    set({ imageLayersLoading: true });
    try {
      const layers = await api.layers.list();
      set({ imageLayers: layers, imageLayersLoading: false });
    } catch (err) {
      console.error('Failed to fetch image layers:', err);
      set({ imageLayersLoading: false });
    }
  },
  createImageLayer: async (layer) => {
    try {
      const created = await api.layers.create(layer);
      set(s => ({ imageLayers: [...s.imageLayers, created] }));
      return created.id;
    } catch (err) {
      console.error('Failed to create image layer:', err);
      return null;
    }
  },
  updateImageLayer: async (id, updates) => {
    try {
      const updated = await api.layers.update(id, updates);
      set(s => ({
        imageLayers: s.imageLayers.map(l => l.id === id ? updated : l),
      }));
      return true;
    } catch (err) {
      console.error('Failed to update image layer:', err);
      return false;
    }
  },
  deleteImageLayer: async (id) => {
    try {
      await api.layers.remove(id);
      set(s => ({ imageLayers: s.imageLayers.filter(l => l.id !== id) }));
      return true;
    } catch (err) {
      console.error('Failed to delete image layer:', err);
      return false;
    }
  },
}));
