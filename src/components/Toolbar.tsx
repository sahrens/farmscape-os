import { useLocation } from 'wouter';
import { useStore } from '@/lib/store';
import farmConfig from '@/farm.config';

/**
 * NavBar — shared top navigation rendered once in App.tsx above all routes.
 * Shows farm name, route links, status filters (map view), camera bookmarks (map view),
 * and user menu with logout.
 */
export function NavBar() {
  const [location, setLocation] = useLocation();
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const statusFilter = useStore(s => s.statusFilter);
  const setStatusFilter = useStore(s => s.setStatusFilter);
  const flyTo = useStore(s => s.flyTo);
  const elements = useStore(s => s.elements);
  const user = useStore(s => s.user);
  const logout = useStore(s => s.logout);

  const isMap = location === '/';
  const isVision = location === '/vision';
  const isData = location === '/data';
  const isFieldwork = location === '/fieldwork';
  const isMembers = location === '/members';
  const isAdmin = user?.role === 'admin';

  const activeCount = elements.filter(e => e.status === 'active').length;
  const plannedCount = elements.filter(e => e.status === 'planned').length;
  const bookmarks = farmConfig.camera.bookmarks || [];

  const linkClass = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
      active
        ? 'bg-forest-600 text-white'
        : 'text-earth-300 hover:bg-earth-700 hover:text-earth-100'
    }`;

  return (
    <div className="bg-earth-800 border-b border-earth-700/50 shrink-0 z-50 relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        {/* Left: sidebar toggle (map only) + farm name */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {isMap && (
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
          )}
          <h1
            className="text-sm font-bold text-forest-300 truncate cursor-pointer"
            onClick={() => setLocation('/')}
          >
            {farmConfig.name}
          </h1>
        </div>

        {/* Right: route links + user menu */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Route links */}
          <button onClick={() => setLocation('/')} className={linkClass(isMap)}>
            Map
          </button>
          <button onClick={() => setLocation('/vision')} className={linkClass(isVision)}>
            Vision
          </button>
          <button onClick={() => setLocation('/data')} className={linkClass(isData)}>
            Data
          </button>
          <button onClick={() => setLocation('/fieldwork')} className={linkClass(isFieldwork)}>
            Fieldwork
          </button>
          {isAdmin && (
            <button onClick={() => setLocation('/members')} className={linkClass(isMembers)}>
              Members
            </button>
          )}

          {/* User menu */}
          {user && (
            <>
              <div className="w-px h-5 bg-earth-600 mx-0.5 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-earth-500 hidden sm:inline truncate max-w-[100px]">
                  {user.name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-earth-500 hover:text-earth-200 hover:bg-earth-700 transition-colors"
                  title="Log out"
                >
                  Log out
                </button>
              </div>
            </>
          )}

          {/* Status filters — only on map view */}
          {isMap && (
            <>
              <div className="w-px h-5 bg-earth-600 mx-0.5 hidden sm:block" />
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
            </>
          )}
        </div>
      </div>

      {/* Camera bookmarks — only on map view, below the main nav */}
      {isMap && bookmarks.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 pb-2 -mt-0.5">
          <span className="text-[10px] text-earth-500 uppercase tracking-wider mr-1">View:</span>
          {bookmarks.map((bm) => (
            <button
              key={bm.name}
              onClick={() => flyTo(bm.position as [number, number, number], bm.target as [number, number, number])}
              className="px-2 py-1 rounded text-[10px] font-medium bg-earth-700/60 text-earth-400 hover:bg-earth-600 hover:text-earth-200 transition-colors active:scale-95"
            >
              {bm.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
