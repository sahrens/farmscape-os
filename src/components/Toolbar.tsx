import { useLocation } from 'wouter';
import { useStore } from '@/lib/store';

export function Toolbar() {
  const [, setLocation] = useLocation();
  const statusFilter = useStore(s => s.statusFilter);
  const setStatusFilter = useStore(s => s.setStatusFilter);
  const elements = useStore(s => s.elements);

  const activeCount = elements.filter(e => e.status === 'active').length;
  const plannedCount = elements.filter(e => e.status === 'planned').length;

  return (
    <div className="absolute top-4 right-4 z-10 flex gap-2">
      {/* Vision link */}
      <button
        onClick={() => setLocation('/vision')}
        className="bg-earth-800/90 backdrop-blur rounded-lg border border-earth-600 px-3 py-2 text-xs font-medium text-earth-300 hover:bg-earth-700 hover:text-earth-100 transition-colors active:scale-95"
      >
        Vision
      </button>

      {/* Data Explorer link */}
      <button
        onClick={() => setLocation('/data')}
        className="bg-earth-800/90 backdrop-blur rounded-lg border border-earth-600 px-3 py-2 text-xs font-medium text-earth-300 hover:bg-earth-700 hover:text-earth-100 transition-colors active:scale-95"
      >
        Data
      </button>

      {/* Status filter */}
      <div className="bg-earth-800/90 backdrop-blur rounded-lg border border-earth-600 flex overflow-hidden">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            !statusFilter ? 'bg-forest-600 text-white' : 'text-earth-300 hover:bg-earth-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            statusFilter === 'active' ? 'bg-forest-600 text-white' : 'text-earth-300 hover:bg-earth-700'
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'planned' ? null : 'planned')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            statusFilter === 'planned' ? 'bg-vanilla-500 text-earth-900' : 'text-earth-300 hover:bg-earth-700'
          }`}
        >
          Planned ({plannedCount})
        </button>
      </div>
    </div>
  );
}
