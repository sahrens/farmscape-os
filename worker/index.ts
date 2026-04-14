/**
 * FarmscapeOS API Worker
 * Cloudflare Worker with D1 database
 * Auth: email OTP via Resend, session cookies, role-based permissions
 */

export interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  GITHUB_TOKEN?: string; // TODO: set up fine-grained token for issue creation
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

// --- Types ---
type UserRole = 'admin' | 'member' | 'read';
interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

// --- Helpers ---
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

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, '0');
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function sessionCookie(token: string, maxAge = 30 * 24 * 3600): string {
  return `farm_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
  return 'farm_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/farm_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getSessionUser(request: Request, db: D1Database): Promise<SessionUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.status = 'active'`
  ).bind(token).first<{ id: string; email: string; name: string | null; role: string }>();
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as UserRole };
}

async function sendOtpEmail(email: string, code: string, farmName: string, siteUrl: string, apiKey: string): Promise<boolean> {
  const magicLink = `${siteUrl}/auth/verify?email=${encodeURIComponent(email)}&code=${code}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Eva & Spencer <onboarding@resend.dev>`,
        to: [email],
        subject: `${farmName} — Tap to log in`,
        text: `Hi there!\n\nTap this link to log in to ${farmName}:\n\n  ${magicLink}\n\nOr enter this code manually: ${code}\n\nExpires in 10 minutes.\n\n— Eva & Spencer`,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="color: #2d5016; margin: 0 0 8px;">🌿 ${farmName}</h2>
  <p style="color: #666; margin: 0 0 24px;">Tap the button to log in:</p>
  <a href="${magicLink}" style="display: inline-block; background: #2d5016; color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 18px; margin: 0 0 24px;">Log in to ${farmName}</a>
  <p style="color: #999; font-size: 14px; margin: 0 0 8px;">Or enter this code manually:</p>
  <div style="background: #f4f7f0; border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; margin: 0 0 24px;">
    <span style="font-size: 24px; font-weight: 700; letter-spacing: 6px; color: #2d5016; font-family: monospace;">${code}</span>
  </div>
  <p style="color: #999; font-size: 14px; margin: 0;">Expires in 10 minutes. If you didn't request this, just ignore it.</p>
  <p style="color: #999; font-size: 14px; margin: 16px 0 0;">— Eva & Spencer</p>
</div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendInviteEmail(
  email: string,
  role: string,
  inviterName: string,
  farmName: string,
  siteUrl: string,
  apiKey: string
): Promise<boolean> {
  const roleLabel = role === 'admin' ? 'an admin' : role === 'member' ? 'a member' : 'a viewer';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Eva & Spencer <onboarding@resend.dev>`,
        to: [email],
        subject: `${inviterName} invited you to ${farmName}`,
        text: `Hi!\n\n${inviterName} has invited you as ${roleLabel} to ${farmName}.\n\nVisit ${siteUrl} and enter your email to log in.\n\n— Eva & Spencer`,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="color: #2d5016; margin: 0 0 8px;">🌿 ${farmName}</h2>
  <p style="color: #333; margin: 0 0 16px;">${inviterName} has invited you as <strong>${roleLabel}</strong>.</p>
  <a href="${siteUrl}" style="display: inline-block; background: #2d5016; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Open ${farmName}</a>
  <p style="color: #999; font-size: 14px; margin: 24px 0 0;">Enter your email on the login page to get started.</p>
  <p style="color: #999; font-size: 14px; margin: 16px 0 0;">— Eva & Spencer</p>
</div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Permission checks
function canWrite(role: UserRole): boolean {
  return role === 'admin' || role === 'member';
}

function isAdmin(role: UserRole): boolean {
  return role === 'admin';
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

// --- Main handler ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // =====================
    // PUBLIC AUTH ENDPOINTS
    // =====================

    // Request OTP — send code to email if user exists
    if (path === '/api/auth/request-otp' && request.method === 'POST') {
      const { email } = await request.json() as { email: string };
      if (!email) return json({ error: 'Email required' }, 400);

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user exists
      const user = await env.DB.prepare('SELECT id, status FROM users WHERE email = ?')
        .bind(normalizedEmail).first<{ id: string; status: string }>();

      if (!user) {
        return json({ error: 'No account found for this email. Ask Eva & Spencer for an invite.' }, 404);
      }

      // Rate limit: max 1 OTP per 60 seconds per email
      const recent = await env.DB.prepare(
        `SELECT id FROM otp_codes WHERE email = ? AND created_at > datetime('now', '-1 minute') AND used = 0`
      ).bind(normalizedEmail).first();
      if (recent) {
        return json({ error: 'Code already sent. Check your email or wait a minute to resend.' }, 429);
      }

      // Generate and store OTP
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`
      ).bind(normalizedEmail, code, expiresAt).run();

      // Send email
      const farmName = 'Kahiliholo Farm';
      const siteUrl = url.origin;
      const sent = await sendOtpEmail(normalizedEmail, code, farmName, siteUrl, env.RESEND_API_KEY);
      if (!sent) {
        return json({ error: 'Failed to send email. Please try again.' }, 500);
      }

      return json({ ok: true, message: 'Code sent to your email' });
    }

    // Verify OTP — exchange code for session
    if (path === '/api/auth/verify-otp' && request.method === 'POST') {
      const { email, code } = await request.json() as { email: string; code: string };
      if (!email || !code) return json({ error: 'Email and code required' }, 400);

      const normalizedEmail = email.toLowerCase().trim();

      // Find valid OTP
      const otp = await env.DB.prepare(
        `SELECT id FROM otp_codes WHERE email = ? AND code = ? AND expires_at > datetime('now') AND used = 0`
      ).bind(normalizedEmail, code).first<{ id: number }>();

      if (!otp) {
        return json({ error: 'Invalid or expired code' }, 401);
      }

      // Mark OTP as used
      await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();

      // Get user
      const user = await env.DB.prepare('SELECT id, name, role, status FROM users WHERE email = ?')
        .bind(normalizedEmail).first<{ id: string; name: string | null; role: string; status: string }>();

      if (!user) return json({ error: 'User not found' }, 404);

      // Activate user on first login
      if (user.status === 'invited') {
        await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(user.id).run();
      }

      // Update last_login
      await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

      // Create session (30 days)
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
      ).bind(token, user.id, expiresAt).run();

      // Clean up old OTPs for this email
      await env.DB.prepare(
        `DELETE FROM otp_codes WHERE email = ? AND (used = 1 OR expires_at < datetime('now'))`
      ).bind(normalizedEmail).run();

      return new Response(JSON.stringify({
        ok: true,
        user: { id: user.id, email: normalizedEmail, name: user.name, role: user.role },
        needsName: !user.name,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookie(token),
          ...corsHeaders(),
        },
      });
    }

    // Magic link — GET /auth/verify?email=...&code=... → verify OTP, set cookie, redirect
    if (path === '/auth/verify' && request.method === 'GET') {
      const email = url.searchParams.get('email');
      const code = url.searchParams.get('code');
      if (!email || !code) {
        return new Response('Missing email or code', { status: 400 });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Find valid OTP
      const otp = await env.DB.prepare(
        `SELECT id FROM otp_codes WHERE email = ? AND code = ? AND expires_at > datetime('now') AND used = 0`
      ).bind(normalizedEmail, code).first<{ id: number }>();

      if (!otp) {
        // Redirect to login with error — link expired or already used
        return new Response(null, {
          status: 302,
          headers: { Location: '/?error=expired' },
        });
      }

      // Mark OTP as used
      await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();

      // Get user
      const user = await env.DB.prepare('SELECT id, name, role, status FROM users WHERE email = ?')
        .bind(normalizedEmail).first<{ id: string; name: string | null; role: string; status: string }>();

      if (!user) {
        return new Response(null, { status: 302, headers: { Location: '/?error=not_found' } });
      }

      // Activate on first login
      if (user.status === 'invited') {
        await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(user.id).run();
      }

      // Update last_login
      await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
      ).bind(token, user.id, expiresAt).run();

      // Clean up old OTPs
      await env.DB.prepare(
        `DELETE FROM otp_codes WHERE email = ? AND (used = 1 OR expires_at < datetime('now'))`
      ).bind(normalizedEmail).run();

      // Redirect to home (or name setup if first login)
      const redirectTo = user.name ? '/' : '/?setup=name';
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectTo,
          'Set-Cookie': sessionCookie(token),
        },
      });
    }

    // Check session — returns current user info
    if (path === '/api/auth/check') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ authenticated: false });
      return json({ authenticated: true, user });
    }

    // Logout
    if (path === '/api/auth/logout' && request.method === 'POST') {
      const token = getSessionToken(request);
      if (token) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearSessionCookie(),
          ...corsHeaders(),
        },
      });
    }

    // =====================
    // AUTHENTICATED ENDPOINTS
    // =====================

    // All other API routes require a valid session
    if (path.startsWith('/api/') && path !== '/api/auth/check') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      // --- Set display name (first login) ---
      if (path === '/api/auth/set-name' && request.method === 'POST') {
        const { name } = await request.json() as { name: string };
        if (!name || !name.trim()) return json({ error: 'Name required' }, 400);
        await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name.trim(), user.id).run();
        return json({ ok: true, name: name.trim() });
      }

      // =====================
      // MEMBER MANAGEMENT (admin only)
      // =====================

      // List members
      if (path === '/api/members' && request.method === 'GET') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const { results } = await env.DB.prepare(
          'SELECT id, email, name, role, status, created_at, last_login FROM users ORDER BY created_at DESC'
        ).all();
        return json(results);
      }

      // Invite new member
      if (path === '/api/members/invite' && request.method === 'POST') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const { email, role } = await request.json() as { email: string; role: string };
        if (!email) return json({ error: 'Email required' }, 400);
        const normalizedEmail = email.toLowerCase().trim();
        const validRoles = ['admin', 'member', 'read'];
        const memberRole = validRoles.includes(role) ? role : 'member';

        // Check if user already exists
        const existing = await env.DB.prepare('SELECT id, status FROM users WHERE email = ?')
          .bind(normalizedEmail).first<{ id: string; status: string }>();
        if (existing) {
          return json({ error: 'User with this email already exists' }, 409);
        }

        // Create user
        const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await env.DB.prepare(
          `INSERT INTO users (id, email, role, status, created_by) VALUES (?, ?, ?, 'invited', ?)`
        ).bind(id, normalizedEmail, memberRole, user.id).run();

        // Send invite email
        const siteUrl = url.origin;
        const inviterName = user.name || user.email;
        const farmName = 'Kahiliholo Farm';
        await sendInviteEmail(normalizedEmail, memberRole, inviterName, farmName, siteUrl, env.RESEND_API_KEY);

        await logChange(env.DB, 'users', id, 'invite', user.id, { email: normalizedEmail, role: memberRole });
        return json({ ok: true, id });
      }

      // Resend invite email
      if (path === '/api/members/resend-invite' && request.method === 'POST') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const { userId } = await request.json() as { userId: string };
        if (!userId) return json({ error: 'userId required' }, 400);

        const member = await env.DB.prepare('SELECT email, role, status FROM users WHERE id = ?')
          .bind(userId).first<{ email: string; role: string; status: string }>();
        if (!member) return json({ error: 'Member not found' }, 404);
        if (member.status !== 'invited') return json({ error: 'Member has already joined' }, 400);

        const siteUrl = url.origin;
        const inviterName = user.name || user.email;
        const farmName = 'Kahiliholo Farm';
        const sent = await sendInviteEmail(member.email, member.role, inviterName, farmName, siteUrl, env.RESEND_API_KEY);
        if (!sent) return json({ error: 'Failed to send email' }, 500);
        return json({ ok: true });
      }

      // Update member role
      if (path.startsWith('/api/members/') && request.method === 'PUT') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const memberId = path.split('/')[3];
        const { role } = await request.json() as { role: string };
        const validRoles = ['admin', 'member', 'read'];
        if (!validRoles.includes(role)) return json({ error: 'Invalid role' }, 400);

        // Prevent self-demotion
        if (memberId === user.id) return json({ error: 'Cannot change your own role' }, 400);

        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, memberId).run();
        await logChange(env.DB, 'users', memberId, 'role_change', user.id, { role });
        return json({ ok: true });
      }

      // Remove member
      if (path.startsWith('/api/members/') && request.method === 'DELETE') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const memberId = path.split('/')[3];

        // Prevent self-removal
        if (memberId === user.id) return json({ error: 'Cannot remove yourself' }, 400);

        // Delete sessions, then user
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(memberId).run();
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(memberId).run();
        await logChange(env.DB, 'users', memberId, 'remove', user.id, null);
        return json({ ok: true });
      }

      // =====================
      // DATA EXPLORER ENDPOINTS
      // =====================

      if (path === '/api/data/tables' && request.method === 'GET') {
        const tables = ['elements', 'activities', 'observations', 'changelog', 'users', 'sessions'];
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

      if (path === '/api/data/schema' && request.method === 'GET') {
        const table = url.searchParams.get('table');
        if (!table) return json({ error: 'table param required' }, 400);
        if (!/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table name' }, 400);
        try {
          const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
          return json(results);
        } catch (e) {
          return json({ error: String(e) }, 500);
        }
      }

      if (path === '/api/data/query' && request.method === 'GET') {
        const table = url.searchParams.get('table');
        if (!table || !/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table' }, 400);

        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const orderBy = url.searchParams.get('order_by') || 'rowid';
        const orderDir = url.searchParams.get('order_dir') === 'asc' ? 'ASC' : 'DESC';

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
          const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM ${table} ${where}`).bind(...params).all();
          const total = (countResult.results[0] as any)?.total || 0;
          const { results } = await env.DB.prepare(
            `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
          ).bind(...params, limit, offset).all();
          return json({ rows: results, total, limit, offset });
        } catch (e) {
          return json({ error: String(e) }, 500);
        }
      }

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

      // Raw SQL — admin only
      if (path === '/api/data/sql' && request.method === 'POST') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const { sql } = await request.json() as { sql: string };
        if (!sql) return json({ error: 'sql required' }, 400);
        try {
          const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(sql);
          if (isWrite) {
            const result = await env.DB.prepare(sql).run();
            await logChange(env.DB, '_raw_sql', '', 'sql', user.id, { sql });
            return json({ ok: true, changes: result.meta?.changes || 0 });
          } else {
            const { results } = await env.DB.prepare(sql).all();
            return json({ rows: results, total: results.length });
          }
        } catch (e) {
          return json({ error: String(e) }, 400);
        }
      }

      if (path === '/api/data/export' && request.method === 'GET') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const table = url.searchParams.get('table');
        if (!table || !/^[a-z_]+$/.test(table)) return json({ error: 'Invalid table' }, 400);
        try {
          const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
          return json(results);
        } catch (e) {
          return json({ error: String(e) }, 500);
        }
      }

      if (path === '/api/data/import' && request.method === 'POST') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
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
        await logChange(env.DB, table, '', 'bulk_import', user.id, { count: imported, errors });
        return json({ ok: true, imported, errors });
      }

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
      // CRUD ENDPOINTS (with permission checks)
      // =====================

      // --- ELEMENTS ---
      if (path === '/api/elements' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM elements WHERE status != ?').bind('removed').all();
        return json(results);
      }

      if (path === '/api/elements' && request.method === 'POST') {
        if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
        const el = await request.json() as Record<string, unknown>;
        await env.DB.prepare(
          `INSERT INTO elements (id, type, subtype, name, lat, lng, x, y, z, width, height, elevation, rotation, metadata, status, planted_at, created_at, updated_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type=excluded.type, subtype=excluded.subtype, name=excluded.name,
             lat=excluded.lat, lng=excluded.lng,
             x=excluded.x, y=excluded.y, z=excluded.z,
             width=excluded.width, height=excluded.height, elevation=excluded.elevation,
             rotation=excluded.rotation, metadata=excluded.metadata,
             status=excluded.status, planted_at=excluded.planted_at,
             updated_at=excluded.updated_at, synced_at=datetime('now')`
        ).bind(
          el.id, el.type, el.subtype || null, el.name,
          el.lat ?? null, el.lng ?? null,
          el.x, el.y, el.z || 0,
          el.width || null, el.height || null, el.elevation || null,
          el.rotation || 0, el.metadata ? JSON.stringify(el.metadata) : null,
          el.status || 'active', el.planted_at || null,
          el.created_at || new Date().toISOString(),
          el.updated_at || new Date().toISOString(),
          user.id
        ).run();
        await logChange(env.DB, 'elements', String(el.id), 'upsert', user.id, el);
        return json({ ok: true, id: el.id });
      }

      if (path.startsWith('/api/elements/') && request.method === 'PUT') {
        const id = path.split('/')[3];

        // Check ownership: members can edit own, admins can edit all
        if (!isAdmin(user.role)) {
          if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
          const el = await env.DB.prepare('SELECT created_by FROM elements WHERE id = ?').bind(id).first<{ created_by: string | null }>();
          if (el?.created_by && el.created_by !== user.id) {
            return json({ error: 'You can only edit elements you created' }, 403);
          }
        }

        const updates = await request.json() as Record<string, unknown>;
        const fields = Object.keys(updates).filter(k => k !== 'id');
        if (fields.length === 0) return json({ ok: true });
        const setClauses = fields.map(f => `${f}=?`).join(', ');
        const values = fields.map(f => f === 'metadata' ? JSON.stringify(updates[f]) : updates[f]);
        await env.DB.prepare(
          `UPDATE elements SET ${setClauses}, updated_at=datetime('now'), synced_at=datetime('now') WHERE id=?`
        ).bind(...values, id).run();
        await logChange(env.DB, 'elements', id, 'update', user.id, updates);
        return json({ ok: true });
      }

      if (path.startsWith('/api/elements/') && request.method === 'DELETE') {
        if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);
        const id = path.split('/')[3];
        await env.DB.prepare("UPDATE elements SET status='removed', updated_at=datetime('now') WHERE id=?").bind(id).run();
        await logChange(env.DB, 'elements', id, 'delete', user.id, null);
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
        if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
        const act = await request.json() as Record<string, unknown>;
        const isTest = act.is_test ? 1 : 0;
        await env.DB.prepare(
          `INSERT INTO activities (id, element_id, type, notes, quantity, unit, gps_lat, gps_lng, gps_accuracy, user_name, duration_minutes, is_test, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          user.name || user.email, act.duration_minutes || null, isTest,
          user.id,
          act.created_at || new Date().toISOString(),
          act.updated_at || new Date().toISOString()
        ).run();
        await logChange(env.DB, 'activities', String(act.id), 'upsert', user.id, act);
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
        if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
        const obs = await request.json() as Record<string, unknown>;
        const isTest = obs.is_test ? 1 : 0;
        await env.DB.prepare(
          `INSERT INTO observations (id, element_id, type, title, body, value, unit, photo_url, gps_lat, gps_lng, user_name, is_test, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          user.name || user.email, isTest,
          user.id,
          obs.created_at || new Date().toISOString(),
          obs.updated_at || new Date().toISOString()
        ).run();
        await logChange(env.DB, 'observations', String(obs.id), 'upsert', user.id, obs);
        return json({ ok: true, id: obs.id });
      }

      // --- GPS TRACKS ---
      if (path === '/api/gps-tracks' && request.method === 'POST') {
        if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
        const track = await request.json() as Record<string, unknown>;
        await env.DB.prepare(
          `INSERT INTO gps_tracks (id, session_id, lat, lng, accuracy, altitude, speed, heading, user_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`
        ).bind(
          track.id, track.session_id, track.lat, track.lng,
          track.accuracy || null, track.altitude || null,
          track.speed || null, track.heading || null,
          user.name || user.email, track.created_at || new Date().toISOString()
        ).run();
        return json({ ok: true });
      }

      // --- SYNC ---
      if (path === '/api/sync' && request.method === 'POST') {
        if (!canWrite(user.role)) return json({ error: 'Write access required' }, 403);
        const { changes } = await request.json() as { changes: Array<{ table: string; action: string; data: Record<string, unknown> }> };
        const results = [];
        for (const change of changes) {
          try {
            if (change.table === 'elements') {
              if (change.action === 'delete') {
                if (!isAdmin(user.role)) {
                  results.push({ id: change.data.id, ok: false, error: 'Admin required for delete' });
                  continue;
                }
                await env.DB.prepare("UPDATE elements SET status='removed', updated_at=datetime('now') WHERE id=?")
                  .bind(change.data.id).run();
              } else {
                const el = change.data;
                await env.DB.prepare(
                  `INSERT INTO elements (id, type, subtype, name, lat, lng, x, y, z, width, height, elevation, rotation, metadata, status, planted_at, created_at, updated_at, created_by, synced_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                   ON CONFLICT(id) DO UPDATE SET
                     type=excluded.type, subtype=excluded.subtype, name=excluded.name,
                     lat=excluded.lat, lng=excluded.lng,
                     x=excluded.x, y=excluded.y, z=excluded.z,
                     width=excluded.width, height=excluded.height, elevation=excluded.elevation,
                     rotation=excluded.rotation, metadata=excluded.metadata,
                     status=excluded.status, planted_at=excluded.planted_at,
                     updated_at=excluded.updated_at, synced_at=datetime('now')`
                ).bind(
                  el.id, el.type, el.subtype || null, el.name,
                  el.lat ?? null, el.lng ?? null,
                  el.x, el.y, el.z || 0,
                  el.width || null, el.height || null, el.elevation || null,
                  el.rotation || 0, el.metadata ? JSON.stringify(el.metadata) : null,
                  el.status || 'active', el.planted_at || null,
                  el.created_at || new Date().toISOString(),
                  el.updated_at || new Date().toISOString(),
                  user.id
                ).run();
              }
              await logChange(env.DB, 'elements', String(change.data.id), change.action, user.id, change.data);
            } else if (change.table === 'activities') {
              const act = change.data;
              await env.DB.prepare(
                `INSERT INTO activities (id, element_id, type, notes, quantity, unit, gps_lat, gps_lng, gps_accuracy, user_name, duration_minutes, is_test, created_by, created_at, synced_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET synced_at=datetime('now')`
              ).bind(
                act.id, act.element_id || null, act.type, act.notes || null,
                act.quantity || null, act.unit || null,
                act.gps_lat || null, act.gps_lng || null, act.gps_accuracy || null,
                user.name || user.email, act.duration_minutes || null, act.is_test || 0,
                user.id,
                act.created_at || new Date().toISOString()
              ).run();
              await logChange(env.DB, 'activities', String(act.id), change.action, user.id, act);
            }
            results.push({ id: change.data.id, ok: true });
          } catch (e) {
            results.push({ id: change.data.id, ok: false, error: String(e) });
          }
        }
        const { results: allElements } = await env.DB.prepare('SELECT * FROM elements WHERE status != ?').bind('removed').all();
        return json({ results, elements: allElements });
      }
    }

    // =====================
    // BUG REPORTS
    // =====================

    // Submit a bug report — any authenticated user can file
    if (path === '/api/bug-reports' && request.method === 'POST') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await request.json() as Record<string, unknown>;
      const id = crypto.randomUUID();
      const tags = body.tags ? JSON.stringify(body.tags) : null;

      await env.DB.prepare(
        `INSERT INTO bug_reports (id, user_id, title, description, severity, tags, route, screenshot_url, console_logs, user_agent, viewport, config_snapshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id, user.id,
        body.title || 'Untitled bug',
        body.description || null,
        body.severity || 'medium',
        tags,
        body.route || null,
        body.screenshot_url || null,
        body.console_logs || null,
        body.user_agent || null,
        body.viewport || null,
        body.config_snapshot || null
      ).run();

      // Save attachments if provided
      const attachments = (body.attachments || []) as Array<{ url: string; filename: string; mime_type: string; size_bytes: number }>;
      for (const att of attachments) {
        const attId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO bug_report_attachments (id, report_id, url, filename, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(attId, id, att.url, att.filename || null, att.mime_type || null, att.size_bytes || null).run();
      }

      // Email bug report notification (non-blocking)
      try {
        const siteUrl = url.origin;
        const severity = (body.severity as string) || 'medium';
        const severityColors: Record<string, string> = {
          critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2563eb'
        };
        const sevColor = severityColors[severity] || '#ca8a04';
        const tagList = (body.tags as string[] || []).map(
          (t: string) => `<span style="display:inline-block;background:#f0f0f0;color:#555;padding:2px 10px;border-radius:12px;font-size:12px;margin-right:4px;">${t}</span>`
        ).join(' ') || '<span style="color:#999;">none</span>';

        const screenshotHtml = body.screenshot_url
          ? `<div style="margin:16px 0;"><p style="font-weight:600;color:#333;margin:0 0 8px;">Screenshot</p><img src="${body.screenshot_url}" style="max-width:100%;border-radius:8px;border:1px solid #ddd;" /></div>`
          : '';

        // Format console logs nicely
        let consoleHtml = '';
        if (body.console_logs) {
          try {
            const logs = JSON.parse(body.console_logs as string) as Array<{level: string; message: string; timestamp: string}>;
            if (logs.length > 0) {
              const logRows = logs.slice(-20).map((l: {level: string; message: string; timestamp: string}) => {
                const levelColor = l.level === 'error' ? '#dc2626' : l.level === 'warn' ? '#ca8a04' : '#666';
                return `<tr><td style="color:${levelColor};font-weight:600;padding:2px 8px 2px 0;font-size:11px;white-space:nowrap;vertical-align:top;">${l.level.toUpperCase()}</td><td style="color:#333;font-size:11px;padding:2px 0;word-break:break-all;">${l.message}</td></tr>`;
              }).join('');
              consoleHtml = `<div style="margin:16px 0;"><p style="font-weight:600;color:#333;margin:0 0 8px;">Console Logs (last 20)</p><table style="width:100%;border-collapse:collapse;background:#f8f8f8;border-radius:8px;padding:8px;font-family:monospace;">${logRows}</table></div>`;
            }
          } catch { /* ignore parse errors */ }
        }

        const emailHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
    <div style="background:#2d5016;padding:20px 24px;">
      <h1 style="color:white;margin:0;font-size:18px;">🪲 Bug Report — ${body.title || 'Untitled'}</h1>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Reporter</td><td style="padding:6px 0;color:#333;font-size:13px;">${user.name || user.email}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Severity</td><td style="padding:6px 0;"><span style="display:inline-block;background:${sevColor};color:white;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase;">${severity}</span></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Tags</td><td style="padding:6px 0;">${tagList}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Route</td><td style="padding:6px 0;color:#333;font-size:13px;font-family:monospace;">${body.route || 'unknown'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Viewport</td><td style="padding:6px 0;color:#333;font-size:13px;">${body.viewport || 'unknown'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;font-size:13px;white-space:nowrap;vertical-align:top;">Report ID</td><td style="padding:6px 0;color:#333;font-size:13px;font-family:monospace;">${id}</td></tr>
      </table>

      ${body.description ? `<div style="margin:16px 0;"><p style="font-weight:600;color:#333;margin:0 0 8px;">Description</p><p style="color:#555;font-size:14px;line-height:1.5;margin:0;white-space:pre-wrap;">${body.description}</p></div>` : ''}

      ${screenshotHtml}
      ${consoleHtml}

      <div style="margin:24px 0 0;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0 0 4px;font-weight:600;color:#92400e;font-size:13px;">📋 TODO: GitHub Integration</p>
        <p style="margin:0;color:#92400e;font-size:12px;">Set up a fine-grained GitHub token (repo: sahrens/farmscape-os, permission: Issues R/W) to auto-create GitHub issues from bug reports.</p>
      </div>
    </div>
  </div>
</div>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Kahiliholo Farm <onboarding@resend.dev>',
            to: ['spencer.ahrens@gmail.com'],
            subject: `🪲 [${severity.toUpperCase()}] ${body.title || 'Bug report'}`,
            html: emailHtml,
            text: `Bug Report: ${body.title}\nSeverity: ${severity}\nReporter: ${user.name || user.email}\nRoute: ${body.route || 'unknown'}\nDescription: ${body.description || 'none'}\nReport ID: ${id}`,
          }),
        });
      } catch {
        // Email notification failed — non-critical, report is still saved in D1
      }

      // TODO: Create GitHub issue when GITHUB_TOKEN is configured
      let githubIssueUrl: string | null = null;
      let githubIssueNumber: number | null = null;

      return json({ ok: true, id, github_issue_url: githubIssueUrl, github_issue_number: githubIssueNumber });
    }

    // List bug reports — admin only
    if (path === '/api/bug-reports' && request.method === 'GET') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user.role)) return json({ error: 'Admin access required' }, 403);

      const status = url.searchParams.get('status') || 'open';
      const { results } = await env.DB.prepare(
        `SELECT br.*, u.name as reporter_name, u.email as reporter_email
         FROM bug_reports br
         LEFT JOIN users u ON br.user_id = u.id
         WHERE br.status = ?
         ORDER BY br.created_at DESC
         LIMIT 100`
      ).bind(status).all();

      return json({ reports: results });
    }

    // Get single bug report with attachments — admin only
    if (path.startsWith('/api/bug-reports/') && request.method === 'GET') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const reportId = path.replace('/api/bug-reports/', '');
      const report = await env.DB.prepare('SELECT * FROM bug_reports WHERE id = ?').bind(reportId).first();
      if (!report) return json({ error: 'Not found' }, 404);

      // Non-admins can only view their own reports
      if (!isAdmin(user.role) && report.user_id !== user.id) {
        return json({ error: 'Access denied' }, 403);
      }

      const { results: attachments } = await env.DB.prepare(
        'SELECT * FROM bug_report_attachments WHERE report_id = ?'
      ).bind(reportId).all();

      return json({ report, attachments });
    }

    // Upload attachment for a bug report (base64 encoded in JSON body)
    if (path === '/api/bug-reports/upload' && request.method === 'POST') {
      const user = await getSessionUser(request, env.DB);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      // Accept base64 data URL and store it directly
      // In a production setup, this would go to S3/R2, but for now we store the data URL
      const { data, filename, mime_type, report_id } = await request.json() as {
        data: string; filename: string; mime_type: string; report_id: string;
      };

      const attId = crypto.randomUUID();
      const size = Math.round((data.length * 3) / 4); // approximate base64 → bytes

      await env.DB.prepare(
        `INSERT INTO bug_report_attachments (id, report_id, url, filename, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(attId, report_id, data, filename, mime_type, size).run();

      return json({ ok: true, id: attId });
    }

    // Fallback — pass non-API routes to static assets (SPA)
    return env.ASSETS.fetch(request);
  },
};
