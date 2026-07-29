import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';
import type { OracleResponse } from '@/lib/api';

function formatTime(ts: string | null): string {
  if (!ts) return 'just now';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function priorityTone(priority: OracleResponse['priority']) {
  switch (priority) {
    case 'critical':
      return 'border-sunset-400/60 bg-sunset-500/10';
    case 'high':
      return 'border-vanilla-400/60 bg-vanilla-500/10';
    default:
      return 'border-forest-400/40 bg-forest-500/10';
  }
}

function priorityLabel(priority: OracleResponse['priority']) {
  switch (priority) {
    case 'critical':
      return 'Critical now';
    case 'high':
      return 'High priority';
    default:
      return 'Important next';
  }
}

export default function Oracle() {
  const user = useStore(s => s.user);
  const [oracle, setOracle] = useState<OracleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'admin';

  const loadOracle = useCallback(async (refresh = false) => {
    if (!isAdmin) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await api.oracle.get(refresh);
      setOracle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Oracle guidance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadOracle(false);
  }, [loadOracle]);

  const supportingStats = useMemo(() => {
    if (!oracle) return [];
    return [
      { label: 'Active elements', value: String(oracle.summary.active_elements) },
      { label: 'Planned elements', value: String(oracle.summary.planned_elements) },
      { label: 'Recent activities', value: String(oracle.summary.recent_activities) },
      { label: 'Recent observations', value: String(oracle.summary.recent_observations) },
      { label: 'Planning docs', value: String(oracle.summary.docs_considered) },
    ];
  }, [oracle]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-earth-500">Admin access required to view the Oracle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-16 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-earth-500 mb-2">Oracle</div>
            <h1 className="text-3xl font-bold text-earth-50">What the farm should do next</h1>
            <p className="text-earth-400 mt-2 max-w-2xl leading-relaxed">
              A synthesized recommendation based on historical changes, recent field activity, current inventory,
              and the long-range planning documents.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {oracle && (
              <div className="text-right text-xs text-earth-500">
                <div>Updated {formatTime(oracle.generated_at)}</div>
                {oracle.cached && <div>Loaded from cache</div>}
              </div>
            )}
            <button
              onClick={() => loadOracle(true)}
              disabled={refreshing}
              className="px-3 py-2 rounded-lg bg-forest-600 hover:bg-forest-500 disabled:bg-earth-700 disabled:text-earth-500 text-white text-sm font-medium transition-colors"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-earth-700 bg-earth-800/60 p-8 text-center text-earth-400">
            Reading the farm and preparing a recommendation…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-sunset-400/40 bg-sunset-500/10 p-6 text-sunset-300">
            {error}
          </div>
        ) : oracle ? (
          <>
            <div className={`rounded-3xl border p-6 md:p-8 shadow-lg ${priorityTone(oracle.priority)}`}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-full bg-earth-900/60 text-[11px] uppercase tracking-[0.18em] text-earth-300 border border-earth-700">
                  {priorityLabel(oracle.priority)}
                </span>
                <span className="text-xs text-earth-500">Confidence {Math.round(oracle.confidence * 100)}%</span>
              </div>
              <p className="text-sm text-earth-400 uppercase tracking-[0.18em] mb-2">Top recommendation</p>
              <h2 className="text-2xl md:text-4xl font-bold text-earth-50 leading-tight max-w-3xl">
                {oracle.top_recommendation}
              </h2>
              {oracle.recommendation_summary && (
                <p className="mt-4 text-earth-300 text-base md:text-lg leading-relaxed max-w-3xl">
                  {oracle.recommendation_summary}
                </p>
              )}
            </div>

            {supportingStats.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {supportingStats.map(stat => (
                  <div key={stat.label} className="rounded-xl border border-earth-700 bg-earth-800/80 p-4">
                    <div className="text-2xl font-bold text-earth-50">{stat.value}</div>
                    <div className="text-xs text-earth-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {oracle.next_steps.map((step, index) => (
                <div key={`${index}-${step}`} className="rounded-2xl border border-earth-700 bg-earth-800/70 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-earth-500 mb-2">Step {index + 1}</div>
                  <p className="text-earth-100 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>

            <details className="rounded-2xl border border-earth-700 bg-earth-800/60 overflow-hidden group">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-earth-200 font-medium">
                <span>Why the Oracle is recommending this</span>
                <span className="text-earth-500 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="px-5 pb-5 space-y-4 border-t border-earth-700/80">
                <div className="pt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-earth-500 mb-2">Reasoning</h3>
                  <p className="text-earth-300 leading-relaxed whitespace-pre-wrap">{oracle.reasoning}</p>
                </div>
                {oracle.signals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-earth-500 mb-2">Signals considered</h3>
                    <ul className="space-y-2 text-earth-300">
                      {oracle.signals.map(signal => (
                        <li key={signal} className="flex gap-2">
                          <span className="text-forest-400">•</span>
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
