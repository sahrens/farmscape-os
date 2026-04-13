export type UserRole = 'admin' | 'member' | 'read';
export type UserStatus = 'invited' | 'active';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  created_by: string | null;
  created_at: string;
  last_login: string | null;
}

export interface FarmElement {
  id: string;
  type: 'structure' | 'tree' | 'zone' | 'infrastructure';
  subtype: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  x: number;
  y: number;
  z: number;
  width: number | null;
  height: number | null;
  elevation: number | null;
  rotation: number;
  metadata: Record<string, unknown> | null;
  status: 'active' | 'planned' | 'removed';
  planted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  synced_at: string | null;
}

export interface Activity {
  id: string;
  element_id: string | null;
  type: string;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  user_name: string | null;
  duration_minutes: number | null;
  is_test?: number;
  created_at: string;
  created_by: string | null;
  synced_at: string | null;
}

export interface Observation {
  id: string;
  element_id: string | null;
  type: 'photo' | 'health' | 'measurement' | 'note';
  title: string | null;
  body: string | null;
  value: number | null;
  unit: string | null;
  photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  user_name: string | null;
  is_test?: number;
  created_at: string;
  created_by: string | null;
  synced_at: string | null;
}

export interface GpsTrack {
  id: string;
  session_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  user_name: string | null;
  created_at: string;
  created_by: string | null;
  synced_at: string | null;
}
