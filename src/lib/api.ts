import type { FarmElement, Activity, Observation, User } from './types';

const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Auth
export const auth = {
  requestOtp: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email: string, code: string) =>
    request<{ ok: boolean; user: User; needsName: boolean }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  check: () =>
    request<{ authenticated: boolean; user?: User }>('/api/auth/check'),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  setName: (name: string) =>
    request<{ ok: boolean; name: string }>('/api/auth/set-name', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};

// Members (admin)
export const members = {
  list: () =>
    request<User[]>('/api/members'),
  invite: (email: string, role: string) =>
    request<{ ok: boolean; id: string }>('/api/members/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  updateRole: (id: string, role: string) =>
    request<{ ok: boolean }>(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/members/${id}`, {
      method: 'DELETE',
    }),
  resendInvite: (userId: string) =>
    request<{ ok: boolean }>('/api/members/resend-invite', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

// Elements
export const elements = {
  list: () =>
    request<FarmElement[]>('/api/elements'),
  create: (el: Partial<FarmElement>) =>
    request<{ ok: boolean; id: string }>('/api/elements', {
      method: 'POST',
      body: JSON.stringify(el),
    }),
  update: (id: string, updates: Partial<FarmElement>) =>
    request<{ ok: boolean }>(`/api/elements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/elements/${id}`, {
      method: 'DELETE',
    }),
};

// Activities
export const activities = {
  list: (elementId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (elementId) params.set('element_id', elementId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return request<Activity[]>(`/api/activities${qs ? `?${qs}` : ''}`);
  },
  create: (act: Partial<Activity>) =>
    request<{ ok: boolean; id: string }>('/api/activities', {
      method: 'POST',
      body: JSON.stringify(act),
    }),
};

// Observations
export const observations = {
  list: (elementId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (elementId) params.set('element_id', elementId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return request<Observation[]>(`/api/observations${qs ? `?${qs}` : ''}`);
  },
  create: (obs: Partial<Observation>) =>
    request<{ ok: boolean; id: string }>('/api/observations', {
      method: 'POST',
      body: JSON.stringify(obs),
    }),
};

// Sync
export const sync = {
  push: (changes: Array<{ table: string; action: string; data: Record<string, unknown> }>) =>
    request<{ results: Array<{ id: string; ok: boolean }>; elements: FarmElement[] }>(
      '/api/sync',
      { method: 'POST', body: JSON.stringify({ changes }) }
    ),
};

// Bug Reports
export interface BugReport {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  severity: string;
  tags: string | null;
  route: string | null;
  screenshot_url: string | null;
  console_logs: string | null;
  user_agent: string | null;
  viewport: string | null;
  config_snapshot: string | null;
  github_issue_url: string | null;
  github_issue_number: number | null;
  status: string;
  created_at: string;
  reporter_name?: string;
  reporter_email?: string;
}

export const bugReports = {
  submit: (report: {
    title: string;
    description?: string;
    severity?: string;
    tags?: string[];
    route?: string;
    screenshot_url?: string;
    console_logs?: string;
    user_agent?: string;
    viewport?: string;
    config_snapshot?: string;
    attachments?: Array<{ url: string; filename: string; mime_type: string; size_bytes: number }>;
  }) =>
    request<{ ok: boolean; id: string; github_issue_url: string | null; github_issue_number: number | null }>(
      '/api/bug-reports',
      { method: 'POST', body: JSON.stringify(report) }
    ),

  list: (status = 'open') =>
    request<{ reports: BugReport[] }>(`/api/bug-reports?status=${status}`),

  get: (id: string) =>
    request<{ report: BugReport; attachments: Array<{ id: string; url: string; filename: string; mime_type: string }> }>(
      `/api/bug-reports/${id}`
    ),

  upload: (data: string, filename: string, mimeType: string, reportId: string) =>
    request<{ ok: boolean; id: string }>('/api/bug-reports/upload', {
      method: 'POST',
      body: JSON.stringify({ data, filename, mime_type: mimeType, report_id: reportId }),
    }),
};

// Data Explorer
export interface TableInfo {
  name: string;
  count: number;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface SqlWriteResult {
  ok: boolean;
  changes: number;
}

export interface ChangelogEntry {
  id: number;
  table_name: string;
  row_id: string;
  action: string;
  author: string;
  delta: string | null;
  created_at: string;
}

export const data = {
  tables: () =>
    request<TableInfo[]>('/api/data/tables'),

  schema: (table: string) =>
    request<ColumnInfo[]>(`/api/data/schema?table=${table}`),

  query: (table: string, params?: Record<string, string>) => {
    const qs = new URLSearchParams({ table, ...params });
    return request<QueryResult>(`/api/data/query?${qs}`);
  },

  distinct: (table: string, column: string) =>
    request<string[]>(`/api/data/distinct?table=${table}&column=${column}`),

  sql: (sql: string) =>
    request<QueryResult | SqlWriteResult>('/api/data/sql', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),

  exportTable: (table: string) =>
    request<Record<string, unknown>[]>(`/api/data/export?table=${table}`),

  importTable: (table: string, rows: Record<string, unknown>[]) =>
    request<{ ok: boolean; imported: number; errors: number }>('/api/data/import', {
      method: 'POST',
      body: JSON.stringify({ table, rows }),
    }),

  changelog: (params?: { table?: string; row_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.table) qs.set('table', params.table);
    if (params?.row_id) qs.set('row_id', params.row_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ChangelogEntry[]>(`/api/data/changelog${q ? `?${q}` : ''}`);
  },
};
