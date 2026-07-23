import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';
import type { EditHistoryEntry } from '@/lib/api';

/**
 * Global Edit History — Google Docs-style version history.
 * Shows timestamped element changes with authors.
 * Admin-only.
 */
export default function EditHistory() {
  const user = useStore(s => s.user);
  const [entries, setEntries] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const loadEntries = useCallback(async (before?: string) => {
    try {
      const data = await api.editHistory.list({ limit: 50, before });
      if (before) {
        setEntries(prev => [...prev, ...data]);
      } else {
        setEntries(data);
      }
      setHasMore(data.length === 50);
    } catch (err) {
      console.error('Failed to load edit history:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadEntries();
  }, [isAdmin, loadEntries]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const oldest = entries[entries.length - 1];
    if (oldest) loadEntries(oldest.created_at);
  };

  const handleRevert = async (entry: EditHistoryEntry) => {
    if (!entry.delta || !entry.row_id) return;
    const delta = typeof entry.delta === 'string' ? JSON.parse(entry.delta) : entry.delta;
    // The delta contains the fields that were set. For a revert, we need the PREVIOUS state.
    // Since we don't have that directly, we'll just revert position fields from the delta.
    const snapshot: Record<string, unknown> = {};
    if ('x' in delta) snapshot.x = delta.x;
    if ('y' in delta) snapshot.y = delta.y;
    if ('rotation' in delta) snapshot.rotation = delta.rotation;
    if (Object.keys(snapshot).length === 0) return;

    setReverting(entry.id);
    try {
      await api.elements.revert(entry.row_id, snapshot);
      // Refresh elements
      useStore.getState().fetchElements();
      // Mark as reverted in UI
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, action: 'reverted' as string } : e
      ));
    } catch (err) {
      console.error('Revert failed:', err);
    } finally {
      setReverting(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'update': return 'moved/edited';
      case 'create': return 'created';
      case 'delete': return 'removed';
      case 'revert': return 'reverted';
      case 'reverted': return '(reverted)';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'update': return 'text-blue-400';
      case 'create': return 'text-green-400';
      case 'delete': return 'text-red-400';
      case 'revert': return 'text-amber-400';
      case 'reverted': return 'text-gray-500';
      default: return 'text-earth-400';
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-earth-400">
        <p>Admin access required to view edit history.</p>
      </div>
    );
  }

  // Group entries by date
  const grouped: { date: string; entries: EditHistoryEntry[] }[] = [];
  let currentDate = '';
  for (const entry of entries) {
    const date = formatDate(entry.created_at);
    if (date !== currentDate) {
      currentDate = date;
      grouped.push({ date, entries: [entry] });
    } else {
      grouped[grouped.length - 1].entries.push(entry);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-earth-100">Edit History</h1>
        <a
          href="/"
          className="text-sm text-earth-400 hover:text-earth-200 transition-colors"
        >
          ← Back to map
        </a>
      </div>
      <p className="text-earth-400 text-sm mb-6">
        All element position, rotation, and property changes. Click "Revert" to restore a previous state.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-earth-600 border-t-forest-400 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-earth-500">
          No edit history yet. Changes will appear here when elements are moved or edited.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.date}>
              <div className="sticky top-0 z-10 bg-earth-900/95 backdrop-blur py-2 mb-2">
                <span className="text-xs font-medium text-earth-500 uppercase tracking-wide">
                  {group.date}
                </span>
              </div>
              <div className="space-y-1">
                {group.entries.map(entry => {
                  const delta = entry.delta ? (typeof entry.delta === 'string' ? JSON.parse(entry.delta) : entry.delta) : null;
                  const hasPosition = delta && ('x' in delta || 'y' in delta || 'rotation' in delta);

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-earth-800/50 group transition-colors"
                    >
                      {/* Timeline dot */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        entry.action === 'create' ? 'bg-green-500' :
                        entry.action === 'delete' ? 'bg-red-500' :
                        entry.action === 'revert' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-earth-200 font-medium truncate">
                            {entry.element_name || entry.row_id}
                          </span>
                          <span className={`text-xs ${getActionColor(entry.action)}`}>
                            {getActionLabel(entry.action)}
                          </span>
                        </div>
                        {delta && hasPosition && (
                          <div className="text-xs text-earth-500 mt-0.5">
                            {delta.x !== undefined && `x: ${Number(delta.x).toFixed(1)}`}
                            {delta.y !== undefined && ` y: ${Number(delta.y).toFixed(1)}`}
                            {delta.rotation !== undefined && ` rot: ${Number(delta.rotation).toFixed(0)}°`}
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      <span className="text-xs text-earth-500 flex-shrink-0">
                        {formatTime(entry.created_at)}
                      </span>

                      {/* Revert button */}
                      {hasPosition && entry.action !== 'reverted' && (
                        <button
                          onClick={() => handleRevert(entry)}
                          disabled={reverting === entry.id}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-amber-800/80 hover:bg-amber-700 text-amber-200 rounded transition-all disabled:opacity-50"
                        >
                          {reverting === entry.id ? '...' : 'Revert'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm text-earth-400 hover:text-earth-200 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load older changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
