-- FarmscapeOS Database Schema
-- D1 (SQLite at edge) on Cloudflare

-- Farm elements: every tree, bed, structure, zone on the property
CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'structure', 'tree', 'mandala', 'bed', 'zone', 'infrastructure'
  subtype TEXT,                -- species or sub-category
  name TEXT NOT NULL,
  lat REAL,                    -- GPS latitude (source of truth)
  lng REAL,                    -- GPS longitude (source of truth)
  x REAL NOT NULL,             -- local coordinate (east), derived from lat/lng + geoReference
  y REAL NOT NULL,             -- local coordinate (north), derived from lat/lng + geoReference
  z REAL DEFAULT 0,            -- elevation offset
  width REAL,                  -- footprint width
  height REAL,                 -- footprint depth
  elevation REAL,              -- vertical height
  rotation REAL DEFAULT 0,     -- degrees
  metadata TEXT,               -- JSON blob for type-specific data
  status TEXT DEFAULT 'active', -- 'active', 'planned', 'removed'
  planted_at TEXT,             -- ISO date
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,               -- last sync timestamp
  created_by TEXT               -- user_id of creator
);

-- Activities: watering, pruning, harvesting, etc.
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  element_id TEXT,             -- nullable for general activities
  type TEXT NOT NULL,          -- 'water', 'plant', 'prune', 'harvest', 'fertilize', 'observe', 'other'
  notes TEXT,
  quantity REAL,               -- amount (gallons, lbs, etc.)
  unit TEXT,                   -- 'gallons', 'lbs', 'kg', 'count'
  gps_lat REAL,
  gps_lng REAL,
  gps_accuracy REAL,
  user_name TEXT,
  duration_minutes INTEGER,
  is_test INTEGER DEFAULT 0,   -- 1 = test entry, 0 = real
  created_by TEXT,              -- user_id of creator
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  synced_at TEXT,
  FOREIGN KEY (element_id) REFERENCES elements(id)
);

-- Observations: photos, health notes, measurements
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  element_id TEXT,
  type TEXT NOT NULL,          -- 'photo', 'health', 'measurement', 'note'
  title TEXT,
  body TEXT,
  value REAL,                  -- for measurements
  unit TEXT,
  photo_url TEXT,
  gps_lat REAL,
  gps_lng REAL,
  user_name TEXT,
  is_test INTEGER DEFAULT 0,   -- 1 = test entry, 0 = real
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  synced_at TEXT,
  FOREIGN KEY (element_id) REFERENCES elements(id)
);

-- Changelog: automatic audit trail for all mutations
CREATE TABLE IF NOT EXISTS changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,    -- which table was modified
  row_id TEXT NOT NULL,        -- id of the affected row
  action TEXT NOT NULL,        -- 'upsert', 'update', 'delete', 'bulk_import', 'sql'
  author TEXT,                 -- who made the change
  delta TEXT,                  -- JSON diff of what changed
  created_at TEXT DEFAULT (datetime('now'))
);

-- GPS tracks: continuous position logging while in the field
CREATE TABLE IF NOT EXISTS gps_tracks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,    -- groups points into a walk/session
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  altitude REAL,
  speed REAL,
  heading REAL,
  user_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Sync queue: pending changes to push to server
-- (Used by IndexedDB on client side, mirrored here for reference)
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,        -- 'create', 'update', 'delete'
  data TEXT NOT NULL,          -- JSON of the record
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Users: individual accounts with role-based permissions
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,                    -- display name, set on first login
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin', 'member', 'read'
  status TEXT NOT NULL DEFAULT 'invited', -- 'invited', 'active'
  created_by TEXT,              -- user_id of admin who invited
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

-- Sessions: auth tokens tied to users
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- OTP codes: short-lived email verification codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);
CREATE INDEX IF NOT EXISTS idx_elements_status ON elements(status);
CREATE INDEX IF NOT EXISTS idx_activities_element ON activities(element_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_observations_element ON observations(element_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracks_session ON gps_tracks(session_id);
CREATE INDEX IF NOT EXISTS idx_changelog_table ON changelog(table_name);
CREATE INDEX IF NOT EXISTS idx_changelog_row ON changelog(row_id);
CREATE INDEX IF NOT EXISTS idx_changelog_created ON changelog(created_at);
