/**
 * FarmscapeOS API Worker
 * Cloudflare Worker with D1 database
 * Static assets served by Cloudflare's asset handler (wrangler.toml assets config)
 * This worker only handles /api/* routes
 */

export interface Env {
  DB: D1Database;
  AUTH_PASSWORD: string;
}

// Simple cookie-based auth
function isAuthenticated(request: Request, env: Env): boolean {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/farm_auth=([^;]+)/);
  if (!match) return false;
  return match[1] === btoa(env.AUTH_PASSWORD + '_farmscapeos');
}

function authCookie(env: Env): string {
  const value = btoa(env.AUTH_PASSWORD + '_farmscapeos');
  return `farm_auth=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 3600}`;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

// --- Changelog helper ---
async function logChange(
  db: D1Database,
  tableName: string,
  rowId: string,
  action: string,
  author: string | null,
  delta: Record<string, unknown> | null
) {
  await db.prepare(
    `INSERT INTO changelog (table_name, row_id, action, author, delta, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(tableName, rowId, action, author || 'system', delta ? JSON.stringify(delta) : null).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Auth endpoints (public)
    if (path === '/api/auth/login' && request.method === 'POST') {
      const body = await request.json() as { password: string };
      if (body.password === env.AUTH_PASSWORD) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': authCookie(env),
            ...corsHeaders(),
          },
        });
      }
      return json({ error: 'Invalid password' }, 401);
    }

    if (path === '/api/auth/check') {
      return json({ authenticated: isAuthenticated(request, env) });
    }

    // All other API routes require auth
    if (path.startsWith('/api/') && !isAuthenticated(request, env)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // =====================
    // DATA EXPLORER ENDPOINTS
    // =====================

    // List all tables with row counts
    if (path === '/api/data/tables' && request.method === 'GET') {
      const tables = ['elements', 'activities', 'observations', 'changelog'];
      const result = [];
      for (const t of tables) {
        try {
          const { results } = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${t}`).all();
          result.push({ name: t, count: (results[0] as any)?.count || 0 });
        } catch {
          result.push({ name: t, count: 0 });
        }
      }
      return json(result);
    }

    // Get table schema (column info)
    if (path === '/api/data/schema' && request.method === 'GET') {
      const table = url.searchParams.get('table');
      if (!table) return json({ error: 'table param required' }, 400);
      // Sanitize table name
      if (!/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table name' }, 400);
      try {
        const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
        return json(results);
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // Query a table with optional filters, sorting, pagination
    if (path === '/api/data/query' && request.method === 'GET') {
      const table = url.searchParams.get('table');
      if (!table || !/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table' }, 400);

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const orderBy = url.searchParams.get('order_by') || 'rowid';
      const orderDir = url.searchParams.get('order_dir') === 'asc' ? 'ASC' : 'DESC';

      // Build WHERE clauses from filter params
      const filters: string[] = [];
      const params: unknown[] = [];
      for (const [key, value] of url.searchParams.entries()) {
        if (['table', 'limit', 'offset', 'order_by', 'order_dir'].includes(key)) continue;
        if (!/^[a-z_]+$/.test(key)) continue;
        if (value === '__null__') {
          filters.push(`${key} IS NULL`);
        } else if (value === '__notnull__') {
          filters.push(`${key} IS NOT NULL`);
        } else {
          filters.push(`${key} = ?`);
          params.push(value);
        }
      }

      const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      try {
        // Get total count
        const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM ${table} ${where}`).bind(...params).all();
        const total = (countResult.results[0] as any)?.total || 0;

        // Get rows
        const { results } = await env.DB.prepare(
          `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all();

        return json({ rows: results, total, limit, offset });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // Get distinct values for a column (for filter dropdowns)
    if (path === '/api/data/distinct' && request.method === 'GET') {
      const table = url.searchParams.get('table');
      const column = url.searchParams.get('column');
      if (!table || !column) return json({ error: 'table and column required' }, 400);
      if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) return json({ error: 'Invalid params' }, 400);

      try {
        const { results } = await env.DB.prepare(
          `SELECT DISTINCT ${column} FROM ${table} WHERE ${column} IS NOT NULL ORDER BY ${column} LIMIT 200`
        ).all();
        return json(results.map((r: any) => r[column]));
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // Raw SQL query (read-only for safety, but allow writes for authenticated users)
    if (path === '/api/data/sql' && request.method === 'POST') {
      const { sql } = await request.json() as { sql: string };
      if (!sql) return json({ error: 'sql required' }, 400);

      try {
        const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(sql);
        if (isWrite) {
          const result = await env.DB.prepare(sql).run();
          await logChange(env.DB, '_raw_sql', '', 'sql', null, { sql });
          return json({ ok: true, changes: result.meta?.changes || 0 });
        } else {
          const { results } = await env.DB.prepare(sql).all();
          return json({ rows: results, total: results.length });
        }
      } catch (e) {
        return json({ error: String(e) }, 400);
      }
    }

    // Export table as JSON (for GitHub sync)
    if (path === '/api/data/export' && request.method === 'GET') {
      const table = url.searchParams.get('table');
      if (!table || !/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table' }, 400);
      try {
        const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
        return json(results);
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // Import table data (bulk upsert for GitHub sync)
    if (path === '/api/data/import' && request.method === 'POST') {
      const { table, rows } = await request.json() as { table: string; rows: Record<string, unknown>[] };
      if (!table || !/^[a-z_]+$/.test(table) || !rows) return json({ error: 'Invalid params' }, 400);

      let imported = 0;
      let errors = 0;
      for (const row of rows) {
        try {
          const cols = Object.keys(row);
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map(c => {
            const v = row[c];
            return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
          });
          await env.DB.prepare(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
          ).bind(...values).run();
          imported++;
        } catch {
          errors++;
        }
      }
      await logChange(env.DB, table, '', 'bulk_import', null, { count: imported, errors });
      return json({ ok: true, imported, errors });
    }

    // Changelog endpoint
    if (path === '/api/data/changelog' && request.method === 'GET') {
      const table = url.searchParams.get('table');
      const rowId = url.searchParams.get('row_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

      let query = 'SELECT * FROM changelog';
      const filters: string[] = [];
      const params: unknown[] = [];
      if (table) { filters.push('table_name = ?'); params.push(table); }
      if (rowId) { filters.push('row_id = ?'); params.push(rowId); }
      if (filters.length) query += ` WHERE ${filters.join(' AND ')}`;
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const { results } = await env.DB.prepare(query).bind(...params).all();
      return json(results);
    }

    // =====================
    // EXISTING CRUD ENDPOINTS (with changelog)
    // =====================

    // --- ELEMENTS ---
    if (path === '/api/elements' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM elements WHERE status != ?').bind('removed').all();
      return json(results);
    }

    if (path === '/api/elements' && request.method === 'POST') {
      const el = await request.json() as Record<string, unknown>;
      await env.DB.prepare(
        `INSERT INTO elements (id, type, subtype, name, x, y, z, width, height, elevation, rotation, metadata, status, planted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type=excluded.type, subtype=excluded.subtype, name=excluded.name,
           x=excluded.x, y=excluded.y, z=excluded.z,
           width=excluded.width, height=excluded.height, elevation=excluded.elevation,
           rotation=excluded.rotation, metadata=excluded.metadata,
           status=excluded.status, planted_at=excluded.planted_at,
           updated_at=excluded.updated_at, synced_at=datetime('now')`
      ).bind(
        el.id, el.type, el.subtype || null, el.name,
        el.x, el.y, el.z || 0,
        el.width || null, el.height || null, el.elevation || null,
        el.rotation || 0, el.metadata ? JSON.stringify(el.metadata) : null,
        el.status || 'active', el.planted_at || null,
        el.created_at || new Date().toISOString(),
        el.updated_at || new Date().toISOString()
      ).run();
      await logChange(env.DB, 'elements', String(el.id), 'upsert', null, el);
      return json({ ok: true, id: el.id });
    }

    if (path.startsWith('/api/elements/') && request.method === 'PUT') {
      const id = path.split('/')[3];
      const updates = await request.json() as Record<string, unknown>;
      const fields = Object.keys(updates).filter(k => k !== 'id');
      if (fields.length === 0) return json({ ok: true });

      const setClauses = fields.map(f => `${f}=?`).join(', ');
      const values = fields.map(f => f === 'metadata' ? JSON.stringify(updates[f]) : updates[f]);
      await env.DB.prepare(
        `UPDATE elements SET ${setClauses}, updated_at=datetime('now'), synced_at=datetime('now') WHERE id=?`
      ).bind(...values, id).run();
      await logChange(env.DB, 'elements', id, 'update', null, updates);
      return json({ ok: true });
    }

    if (path.startsWith('/api/elements/') && request.method === 'DELETE') {
      const id = path.split('/')[3];
      await env.DB.prepare("UPDATE elements SET status='removed', updated_at=datetime('now') WHERE id=?").bind(id).run();
      await logChange(env.DB, 'elements', id, 'delete', null, null);
      return json({ ok: true });
    }

    // --- ACTIVITIES ---
    if (path === '/api/activities' && request.method === 'GET') {
      const elementId = url.searchParams.get('element_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      let query = 'SELECT * FROM activities';
      const params: unknown[] = [];
      if (elementId) {
        query += ' WHERE element_id = ?';
        params.push(elementId);
      }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      const { results } = await env.DB.prepare(query).bind(...params).all();
      return json(results);
    }

    if (path === '/api/activities' && request.method === 'POST') {
      const act = await request.json() as Record<string, unknown>;
      const isTest = act.is_test ? 1 : 0;
      await env.DB.prepare(
        `INSERT INTO activities (id, element_id, type, notes, quantity, unit, gps_lat, gps_lng, gps_accuracy, user_name, duration_minutes, is_test, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           element_id=excluded.element_id, type=excluded.type, notes=excluded.notes,
           quantity=excluded.quantity, unit=excluded.unit,
           gps_lat=excluded.gps_lat, gps_lng=excluded.gps_lng,
           gps_accuracy=excluded.gps_accuracy, user_name=excluded.user_name,
           duration_minutes=excluded.duration_minutes, is_test=excluded.is_test,
           updated_at=excluded.updated_at, synced_at=datetime('now')`
      ).bind(
        act.id, act.element_id || null, act.type, act.notes || null,
        act.quantity || null, act.unit || null,
        act.gps_lat || null, act.gps_lng || null, act.gps_accuracy || null,
        act.user_name || null, act.duration_minutes || null, isTest,
        act.created_at || new Date().toISOString(),
        act.updated_at || new Date().toISOString()
      ).run();
      await logChange(env.DB, 'activities', String(act.id), 'upsert', act.user_name as string || null, act);
      return json({ ok: true, id: act.id });
    }

    // --- OBSERVATIONS ---
    if (path === '/api/observations' && request.method === 'GET') {
      const elementId = url.searchParams.get('element_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      let query = 'SELECT * FROM observations';
      const params: unknown[] = [];
      if (elementId) {
        query += ' WHERE element_id = ?';
        params.push(elementId);
      }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      const { results } = await env.DB.prepare(query).bind(...params).all();
      return json(results);
    }

    if (path === '/api/observations' && request.method === 'POST') {
      const obs = await request.json() as Record<string, unknown>;
      const isTest = obs.is_test ? 1 : 0;
      await env.DB.prepare(
        `INSERT INTO observations (id, element_id, type, title, body, value, unit, photo_url, gps_lat, gps_lng, user_name, is_test, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           element_id=excluded.element_id, type=excluded.type, title=excluded.title,
           body=excluded.body, value=excluded.value, unit=excluded.unit,
           photo_url=excluded.photo_url, gps_lat=excluded.gps_lat,
           gps_lng=excluded.gps_lng, user_name=excluded.user_name, is_test=excluded.is_test,
           updated_at=excluded.updated_at, synced_at=datetime('now')`
      ).bind(
        obs.id, obs.element_id || null, obs.type, obs.title || null,
        obs.body || null, obs.value || null, obs.unit || null,
        obs.photo_url || null, obs.gps_lat || null, obs.gps_lng || null,
        obs.user_name || null, isTest,
        obs.created_at || new Date().toISOString(),
        obs.updated_at || new Date().toISOString()
      ).run();
      await logChange(env.DB, 'observations', String(obs.id), 'upsert', obs.user_name as string || null, obs);
      return json({ ok: true, id: obs.id });
    }

    // --- GPS TRACKS ---
    if (path === '/api/gps-tracks' && request.method === 'POST') {
      const track = await request.json() as Record<string, unknown>;
      await env.DB.prepare(
        `INSERT INTO gps_tracks (id, session_id, lat, lng, accuracy, altitude, speed, heading, user_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      ).bind(
        track.id, track.session_id, track.lat, track.lng,
        track.accuracy || null, track.altitude || null,
        track.speed || null, track.heading || null,
        track.user_name || null, track.created_at || new Date().toISOString()
      ).run();
      return json({ ok: true });
    }

    // --- SYNC ---
    if (path === '/api/sync' && request.method === 'POST') {
      const { changes } = await request.json() as { changes: Array<{ table: string; action: string; data: Record<string, unknown> }> };
      const results = [];
      for (const change of changes) {
        try {
          if (change.table === 'elements') {
            if (change.action === 'delete') {
              await env.DB.prepare("UPDATE elements SET status='removed', updated_at=datetime('now') WHERE id=?")
                .bind(change.data.id).run();
            } else {
              const el = change.data;
              await env.DB.prepare(
                `INSERT INTO elements (id, type, subtype, name, x, y, z, width, height, elevation, rotation, metadata, status, planted_at, created_at, updated_at, synced_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                   type=excluded.type, subtype=excluded.subtype, name=excluded.name,
                   x=excluded.x, y=excluded.y, z=excluded.z,
                   width=excluded.width, height=excluded.height, elevation=excluded.elevation,
                   rotation=excluded.rotation, metadata=excluded.metadata,
                   status=excluded.status, planted_at=excluded.planted_at,
                   updated_at=excluded.updated_at, synced_at=datetime('now')`
              ).bind(
                el.id, el.type, el.subtype || null, el.name,
                el.x, el.y, el.z || 0,
                el.width || null, el.height || null, el.elevation || null,
                el.rotation || 0, el.metadata ? JSON.stringify(el.metadata) : null,
                el.status || 'active', el.planted_at || null,
                el.created_at || new Date().toISOString(),
                el.updated_at || new Date().toISOString()
              ).run();
            }
            await logChange(env.DB, 'elements', String(change.data.id), change.action, null, change.data);
          } else if (change.table === 'activities') {
            const act = change.data;
            await env.DB.prepare(
              `INSERT INTO activities (id, element_id, type, notes, quantity, unit, gps_lat, gps_lng, gps_accuracy, user_name, duration_minutes, is_test, created_at, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(id) DO UPDATE SET synced_at=datetime('now')`
            ).bind(
              act.id, act.element_id || null, act.type, act.notes || null,
              act.quantity || null, act.unit || null,
              act.gps_lat || null, act.gps_lng || null, act.gps_accuracy || null,
              act.user_name || null, act.duration_minutes || null, act.is_test || 0,
              act.created_at || new Date().toISOString()
            ).run();
            await logChange(env.DB, 'activities', String(act.id), change.action, null, act);
          }
          results.push({ id: change.data.id, ok: true });
        } catch (e) {
          results.push({ id: change.data.id, ok: false, error: String(e) });
        }
      }
      const { results: allElements } = await env.DB.prepare('SELECT * FROM elements WHERE status != ?').bind('removed').all();
      return json({ results, elements: allElements });
    }

    // Fallback
    return json({ error: 'Not found' }, 404);
  },
};
