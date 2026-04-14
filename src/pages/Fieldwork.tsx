import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import * as api from '@/lib/api';
import type { FarmElement, Activity } from '@/lib/types';
import farmConfig from '@/farm.config';
import { formatGps, googleMapsUrl } from '@/lib/geo';

const ACTIVITY_TYPES = [
  { value: 'watering', label: 'Watering', icon: '💧' },
  { value: 'pruning', label: 'Pruning', icon: '✂️' },
  { value: 'planting', label: 'Planting', icon: '🌱' },
  { value: 'harvesting', label: 'Harvesting', icon: '🧺' },
  { value: 'fertilizing', label: 'Fertilizing', icon: '🧪' },
  { value: 'weeding', label: 'Weeding', icon: '🌿' },
  { value: 'mulching', label: 'Mulching', icon: '🍂' },
  { value: 'observation', label: 'Observation', icon: '👁️' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
];

const TYPE_ICONS: Record<string, string> = {
  structure: '🏠',
  tree: '🌳',
  zone: '📐',
  infrastructure: '🛤️',
};

const ELEMENT_TYPES = ['tree', 'structure', 'zone', 'infrastructure'] as const;

function getSubtypeLabel(subtype: string | null): string {
  if (!subtype) return '';
  const labels = farmConfig.subtypeLabels || {};
  if (labels[subtype]) return labels[subtype];
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Relative time display */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Quick-log form for a specific element */
function QuickLogForm({ elementId, onLogged }: { elementId: string; onLogged: () => void }) {
  const [actType, setActType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!actType || saving) return;
    setSaving(true);
    setSuccess(false);
    try {
      const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await api.activities.create({
        id,
        element_id: elementId,
        type: actType,
        notes: notes || undefined,
        is_test: 1,
        created_at: new Date().toISOString(),
      });
      setActType('');
      setNotes('');
      setSuccess(true);
      onLogged();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_TYPES.map(at => (
          <button
            key={at.value}
            type="button"
            onClick={() => setActType(actType === at.value ? '' : at.value)}
            className={`px-2 py-1.5 rounded text-xs transition-colors active:scale-95 select-none ${
              actType === at.value
                ? 'bg-forest-600 text-white ring-1 ring-forest-400'
                : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
            }`}
          >
            <span className="mr-0.5">{at.icon}</span>
            {at.label}
          </button>
        ))}
      </div>
      {actType && (
        <div className="flex gap-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 px-3 py-2 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] select-none shrink-0 ${
              saving
                ? 'bg-earth-600 text-earth-400 cursor-not-allowed'
                : success
                ? 'bg-forest-500 text-white'
                : 'bg-forest-600 hover:bg-forest-500 text-white'
            }`}
          >
            {saving ? '...' : success ? '✓' : 'Log'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Add Element form */
function AddElementForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const createElement = useStore(s => s.createElement);
  const [name, setName] = useState('');
  const [type, setType] = useState<typeof ELEMENT_TYPES[number]>('tree');
  const [subtype, setSubtype] = useState('');
  const [status, setStatus] = useState<'active' | 'planned'>('planned');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Get subtypes for the selected type from farm config
  const subtypeOptions = useMemo(() => {
    const labels = farmConfig.subtypeLabels || {};
    // Filter subtypes that make sense for this type — we can't easily determine this,
    // so show all subtypes and let the user pick
    return Object.entries(labels).map(([key, label]) => ({ key, label: label as string }));
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      // Default position: center of the farm boundary
      const boundary = farmConfig.boundary;
      let cx = 0, cy = 0;
      if (boundary.length > 0) {
        cx = boundary.reduce((s, p) => s + p.x, 0) / boundary.length;
        cy = boundary.reduce((s, p) => s + p.y, 0) / boundary.length;
      }

      const id = await createElement({
        name: name.trim(),
        type,
        subtype: subtype || null,
        status,
        x: cx,
        y: cy,
        z: 0,
        rotation: 0,
        elevation: type === 'tree' ? 10 : type === 'structure' ? 8 : 1,
        width: type === 'zone' ? 20 : type === 'structure' ? 15 : 8,
        height: type === 'zone' ? 20 : type === 'structure' ? 10 : null,
      });

      if (id) {
        onCreated();
      } else {
        setError('Failed to create element');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create element');
    }
    setSaving(false);
  };

  return (
    <div className="bg-earth-800 rounded-xl border border-earth-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-earth-100">New Element</h3>
        <button onClick={onCancel} className="text-earth-400 hover:text-earth-200 text-lg leading-none">×</button>
      </div>

      <div>
        <label className="block text-xs text-earth-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Mango Tree #5"
          className="w-full px-3 py-2 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-earth-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-1">
            {ELEMENT_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-2 py-1.5 rounded text-xs transition-colors active:scale-95 ${
                  type === t
                    ? 'bg-forest-600 text-white'
                    : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
                }`}
              >
                {TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-earth-400 mb-1">Status</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setStatus('planned')}
              className={`px-2.5 py-1.5 rounded text-xs transition-colors active:scale-95 ${
                status === 'planned'
                  ? 'bg-vanilla-600 text-white'
                  : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
              }`}
            >
              Planned
            </button>
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`px-2.5 py-1.5 rounded text-xs transition-colors active:scale-95 ${
                status === 'active'
                  ? 'bg-forest-600 text-white'
                  : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
              }`}
            >
              Active
            </button>
          </div>
        </div>
      </div>

      {subtypeOptions.length > 0 && (
        <div>
          <label className="block text-xs text-earth-400 mb-1">Subtype (optional)</label>
          <select
            value={subtype}
            onChange={e => setSubtype(e.target.value)}
            className="w-full px-3 py-2 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          >
            <option value="">— None —</option>
            {subtypeOptions.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      <p className="text-xs text-earth-500">
        Element will be placed at the center of the farm. Use "Edit in 3D" to position it precisely.
      </p>

      {error && <p className="text-xs text-sunset-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || saving}
        className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] ${
          !name.trim() || saving
            ? 'bg-earth-600 text-earth-400 cursor-not-allowed'
            : 'bg-forest-600 hover:bg-forest-500 text-white'
        }`}
      >
        {saving ? 'Creating...' : 'Create Element'}
      </button>
    </div>
  );
}

/** Single element card showing recent activity and quick-log */
function ElementCard({
  el,
  activities,
  expanded,
  onToggle,
  onRefresh,
  onEditIn3D,
}: {
  el: FarmElement;
  activities: Activity[];
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onEditIn3D: (id: string) => void;
}) {
  const hasGps = el.lat != null && el.lng != null;
  const lastActivity = activities[0];

  return (
    <div className={`bg-earth-800 rounded-xl border transition-colors ${
      expanded ? 'border-forest-600/50' : 'border-earth-700'
    }`}>
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-earth-700/50 rounded-xl transition-colors"
      >
        <span className="text-xl">{TYPE_ICONS[el.type] || '📍'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-earth-100 truncate">{el.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              el.status === 'active' ? 'bg-forest-900/40 text-forest-300' :
              el.status === 'planned' ? 'bg-vanilla-900/40 text-vanilla-300' :
              'bg-earth-700 text-earth-400'
            }`}>
              {el.status}
            </span>
          </div>
          <div className="text-xs text-earth-400 flex items-center gap-2">
            <span>{getSubtypeLabel(el.subtype) || el.type}</span>
            {lastActivity && (
              <>
                <span className="text-earth-600">·</span>
                <span className="capitalize">{lastActivity.type}</span>
                <span className="text-earth-500">{timeAgo(lastActivity.created_at)}</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-earth-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-earth-700/50">
          {/* GPS + Edit in 3D row */}
          <div className="flex items-center justify-between mt-2">
            {hasGps ? (
              <a
                href={googleMapsUrl(el.lat!, el.lng!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-forest-400 hover:text-forest-300"
              >
                📍 {formatGps(el.lat!, el.lng!)}
              </a>
            ) : (
              <span className="text-xs text-earth-500 italic">No GPS</span>
            )}
            <button
              onClick={() => onEditIn3D(el.id)}
              className="text-xs px-2.5 py-1.5 rounded bg-earth-700 text-blue-300 hover:bg-earth-600 hover:text-blue-200 active:scale-95 transition-colors"
            >
              ✏️ Edit in 3D
            </button>
          </div>

          {/* Recent activities */}
          <div>
            <h4 className="text-xs font-semibold text-earth-400 uppercase tracking-wider mb-1.5">
              Recent Activity
            </h4>
            {activities.length === 0 ? (
              <p className="text-xs text-earth-500 italic">No activities logged yet</p>
            ) : (
              <div className="space-y-1">
                {activities.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-earth-900/50 rounded px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="capitalize text-earth-200">{a.type}</span>
                      {a.notes && <span className="text-earth-500 truncate max-w-[200px]">{a.notes}</span>}
                      {a.is_test ? (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-900/40 text-yellow-300">test</span>
                      ) : null}
                    </div>
                    <span className="text-earth-500 shrink-0 ml-2">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick-log form */}
          <div>
            <h4 className="text-xs font-semibold text-earth-400 uppercase tracking-wider mb-1.5">
              Log Activity
            </h4>
            <QuickLogForm elementId={el.id} onLogged={onRefresh} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Main Fieldwork page */
function Fieldwork() {
  const elements = useStore(s => s.elements);
  const fetchElements = useStore(s => s.fetchElements);
  const enterEditMode = useStore(s => s.enterEditMode);
  const focusOn = useStore(s => s.focusOn);
  const [, setLocation] = useLocation();
  const [activitiesByElement, setActivitiesByElement] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load elements if not already loaded
  useEffect(() => {
    if (elements.length === 0) fetchElements();
  }, [elements.length, fetchElements]);

  // Load recent activities for all elements
  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const acts = await api.activities.list(undefined, 500);
      const grouped: Record<string, Activity[]> = {};
      for (const act of acts) {
        const eid = act.element_id || '_none';
        if (!grouped[eid]) grouped[eid] = [];
        grouped[eid].push(act);
      }
      setActivitiesByElement(grouped);
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleEditIn3D = useCallback((elementId: string) => {
    const el = elements.find(e => e.id === elementId);
    if (!el) return;
    enterEditMode(elementId);
    const elHeight = el.elevation || 10;
    focusOn([el.x, elHeight * 0.3, -el.y]);
    // Navigate to map view
    setLocation('/');
  }, [elements, enterEditMode, focusOn, setLocation]);

  const handleElementCreated = useCallback(() => {
    setShowAddForm(false);
    fetchElements();
  }, [fetchElements]);

  // Filter and sort elements
  const filteredElements = useMemo(() => {
    let els = [...elements];
    if (typeFilter) els = els.filter(e => e.type === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      els = els.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.subtype && e.subtype.toLowerCase().includes(q))
      );
    }
    els.sort((a, b) => {
      const aActs = activitiesByElement[a.id] || [];
      const bActs = activitiesByElement[b.id] || [];
      const aLast = aActs[0]?.created_at || '';
      const bLast = bActs[0]?.created_at || '';
      if (aLast && bLast) return bLast.localeCompare(aLast);
      if (aLast) return -1;
      if (bLast) return 1;
      return a.name.localeCompare(b.name);
    });
    return els;
  }, [elements, typeFilter, searchQuery, activitiesByElement]);

  const types = ['tree', 'structure', 'zone', 'infrastructure'];
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of elements) {
      counts[el.type] = (counts[el.type] || 0) + 1;
    }
    return counts;
  }, [elements]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-earth-50">Fieldwork</h1>
            <p className="text-sm text-earth-400 mt-1">
              {elements.length} elements total.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors active:scale-95 ${
              showAddForm
                ? 'bg-earth-700 text-earth-300'
                : 'bg-forest-600 hover:bg-forest-500 text-white'
            }`}
          >
            {showAddForm ? 'Cancel' : '+ Add Element'}
          </button>
        </div>

        {/* Add Element form */}
        {showAddForm && (
          <AddElementForm
            onCreated={handleElementCreated}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Search + type filter */}
        <div className="space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search elements..."
            className="w-full px-3 py-2 bg-earth-800 border border-earth-700 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setTypeFilter(null)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors active:scale-95 ${
                !typeFilter ? 'bg-forest-600 text-white' : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
              }`}
            >
              All ({elements.length})
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors active:scale-95 ${
                  typeFilter === t ? 'bg-forest-600 text-white' : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
                }`}
              >
                {TYPE_ICONS[t]} {typeCounts[t] || 0}
              </button>
            ))}
          </div>
        </div>

        {/* Element cards */}
        {loading && elements.length === 0 ? (
          <div className="text-center py-12 text-earth-500">Loading...</div>
        ) : filteredElements.length === 0 ? (
          <div className="text-center py-12 text-earth-500 italic">
            {searchQuery ? 'No elements match your search' : 'No elements found'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredElements.map(el => (
              <ElementCard
                key={el.id}
                el={el}
                activities={activitiesByElement[el.id] || []}
                expanded={expandedId === el.id}
                onToggle={() => setExpandedId(expandedId === el.id ? null : el.id)}
                onRefresh={loadActivities}
                onEditIn3D={handleEditIn3D}
              />
            ))}
          </div>
        )}

        {/* Footer spacer for mobile */}
        <div className="h-8" />
      </div>
    </div>
  );
}

export default Fieldwork;
