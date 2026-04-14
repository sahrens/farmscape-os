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
    set({
      editMode: true,
      editingElementId: elementId,
      selectedId: elementId,
      sidebarOpen: false,
    });
  },
  exitEditMode: () => {
    set({ editMode: false, editingElementId: null });
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
}));
