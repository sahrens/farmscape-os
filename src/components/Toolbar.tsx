import { useLocation } from 'wouter';
import { useStore } from '@/lib/store';
import farmConfig from '@/farm.config';

/**
 * NavBar — unified top navigation for the Dashboard (3D map view).
 * Combines farm name, sidebar toggle, page links, and status filters
 * into a single bar that sits above the 3D scene.
 */
export function Toolbar() {
  const [, setLocation] = useLocation();
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const statusFilter = useStore(s => s.statusFilter);
  const setStatusFilter = useStore(s => s.setStatusFilter);
  const elements = useStore(s => s.elements);

  const activeCount = elements.filter(e => e.status === 'active').length;
  const plannedCount = elements.filter(e => e.status === 'planned').length;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-earth-800/90 backdrop-blur border-b border-earth-700/50">
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        {/* Left: farm name + elements toggle */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
              sidebarOpen
                ? 'bg-forest-600 text-white'
                : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
            }`}
            title={sidebarOpen ? 'Hide elements panel' : 'Show elements panel'}
          >
            ☰
          </button>
          <h1 className="text-sm font-bold text-forest-300 truncate hidden sm:block">
            {farmConfig.name}
          </h1>
        </div>

        {/* Right: nav links + status filter */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Vision link */}
          <button
            onClick={() => setLocation('/vision')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-earth-300 hover:bg-earth-700 hover:text-earth-100 transition-colors active:scale-95"
          >
            Vision
          </button>

          {/* Data Explorer link */}
          <button
            onClick={() => setLocation('/data')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-earth-300 hover:bg-earth-700 hover:text-earth-100 transition-colors active:scale-95"
          >
            Data
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-earth-600 mx-0.5 hidden sm:block" />

          {/* Status filter */}
          <div className="bg-earth-700/80 rounded-lg flex overflow-hidden">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                !statusFilter ? 'bg-forest-600 text-white' : 'text-earth-300 hover:bg-earth-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'active' ? 'bg-forest-600 text-white' : 'text-earth-300 hover:bg-earth-600'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'planned' ? null : 'planned')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'planned' ? 'bg-vanilla-500 text-earth-900' : 'text-earth-300 hover:bg-earth-600'
              }`}
            >
              Planned ({plannedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
