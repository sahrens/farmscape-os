import { create } from 'zustand';
import type { FarmElement, Activity, User } from './types';
import * as api from './api';

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

  // Camera
  cameraTarget: { position: [number, number, number]; target: [number, number, number] } | null;
  flyTo: (position: [number, number, number], target: [number, number, number]) => void;
  clearCameraTarget: () => void;

  // Filter
  typeFilter: string | null;
  statusFilter: string | null;
  setTypeFilter: (f: string | null) => void;
  setStatusFilter: (f: string | null) => void;
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
    set({ selectedId: id });
    if (id) {
      get().fetchActivities(id);
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

  // Camera
  cameraTarget: null,
  flyTo: (position, target) => set({ cameraTarget: { position, target } }),
  clearCameraTarget: () => set({ cameraTarget: null }),

  // Filter
  typeFilter: null,
  statusFilter: null,
  setTypeFilter: (f) => set({ typeFilter: f }),
  setStatusFilter: (f) => set({ statusFilter: f }),
}));
