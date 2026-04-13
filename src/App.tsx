import { useState, useEffect, lazy, Suspense } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';
import farmConfig from '@/farm.config';
import { Login } from '@/pages/Login';
import { FarmScene } from '@/components/FarmScene';
import { Sidebar } from '@/components/Sidebar';
import { NavBar } from '@/components/Toolbar';

const DataExplorer = lazy(() => import('@/pages/DataExplorer'));
const Vision = lazy(() => import('@/pages/Vision'));
const Fieldwork = lazy(() => import('@/pages/Fieldwork'));
const Members = lazy(() => import('@/pages/Members'));

/**
 * Dashboard — 3D map view. Always mounted to avoid Canvas remount/black screen.
 * Hidden via CSS when on other routes.
 */
function Dashboard({ visible }: { visible: boolean }) {
  const fetchElements = useStore(s => s.fetchElements);
  const elementsLoading = useStore(s => s.elementsLoading);
  const elements = useStore(s => s.elements);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const sheetHeight = useStore(s => s.sheetHeight);
  const selectElement = useStore(s => s.selectElement);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  // Restore selected element from URL hash on initial load
  useEffect(() => {
    if (elements.length === 0) return;
    const hash = window.location.hash.slice(1); // remove #
    if (hash && elements.some(e => e.id === hash)) {
      selectElement(hash);
    }
  }, [elements]); // only on first element load

  return (
    <div
      className="relative flex-1 min-h-0 overflow-hidden"
      style={{ display: visible ? 'flex' : 'none', flexDirection: 'column' }}
    >
      <div
        className="relative flex-1 min-h-0"
        style={{
          transform: sheetHeight > 0 ? `translateY(${-sheetHeight / 2}px)` : 'none',
          transition: 'transform 0.15s ease-out',
        }}
      >
        {elementsLoading && elements.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-earth-400 text-lg">Loading elements...</div>
          </div>
        ) : (
          <FarmScene />
        )}
      </div>
      {/* Floating sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`absolute top-3 left-3 z-20 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors active:scale-95 shadow-lg ${
          sidebarOpen
            ? 'bg-forest-600 text-white'
            : 'bg-earth-800/90 backdrop-blur text-earth-300 border border-earth-700 hover:bg-earth-700'
        }`}
        title={sidebarOpen ? 'Hide elements panel' : 'Show elements panel'}
      >
        ☰
      </button>
      {/* Element count badge */}
      <div className="absolute bottom-4 right-4 bg-earth-800/80 backdrop-blur text-earth-400 text-xs px-3 py-1.5 rounded-lg border border-earth-700 z-10">
        {elements.length} elements
      </div>
      {/* Sidebar — handles its own mobile/desktop layout */}
      <Sidebar />
    </div>
  );
}

function NameSetup() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useStore(s => s.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await api.auth.setName(name.trim());
      const check = await api.auth.check();
      if (check.user) setUser(check.user);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set name');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-earth-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-forest-300 mb-2">{farmConfig.name}</h1>
        </div>
        <div className="bg-earth-800 rounded-xl p-6 shadow-lg border border-earth-700">
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-earth-400 mb-4">Welcome! What should we call you?</p>
            <label className="block text-sm font-medium text-earth-300 mb-2">Your name</label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
              placeholder="e.g. Spencer"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-sunset-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="mt-4 w-full py-3 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const authenticated = useStore(s => s.authenticated);
  const authChecked = useStore(s => s.authChecked);
  const checkAuth = useStore(s => s.checkAuth);
  const user = useStore(s => s.user);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-earth-900">
        <div className="text-earth-400">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  // After magic link login, user may need to set their name
  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === 'name' || (authenticated && user && !user.name)) {
    return <NameSetup />;
  }

  return <>{children}</>;
}

/**
 * App shell — NavBar is always visible, routes fill the remaining space.
 * Dashboard (3D Canvas) is always mounted but hidden when on other routes
 * to prevent the black screen on route switch.
 */
export default function App() {
  const [location] = useLocation();
  const isMapRoute = location === '/';

  return (
    <AuthGuard>
      <div className="h-full flex flex-col bg-earth-900">
        <NavBar />
        {/* Dashboard always mounted, hidden when not on map route */}
        <Dashboard visible={isMapRoute} />
        {/* Other routes render on top when active */}
        {!isMapRoute && (
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-earth-900">
              <div className="text-earth-400">Loading...</div>
            </div>
          }>
            <Switch>
              <Route path="/data" component={DataExplorer} />
              <Route path="/vision" component={Vision} />
              <Route path="/fieldwork" component={Fieldwork} />
              <Route path="/members" component={Members} />
            </Switch>
          </Suspense>
        )}
      </div>
    </AuthGuard>
  );
}
