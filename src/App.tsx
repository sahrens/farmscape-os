import { useEffect, lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { useStore } from '@/lib/store';
import { Login } from '@/pages/Login';
import { FarmScene } from '@/components/FarmScene';
import { Sidebar } from '@/components/Sidebar';
import { NavBar } from '@/components/Toolbar';

const DataExplorer = lazy(() => import('@/pages/DataExplorer'));
const Vision = lazy(() => import('@/pages/Vision'));

/**
 * Dashboard — 3D map view. NavBar is rendered by the app shell above,
 * so this only contains the 3D scene + sidebar.
 */
function Dashboard() {
  const fetchElements = useStore(s => s.fetchElements);
  const elementsLoading = useStore(s => s.elementsLoading);
  const elements = useStore(s => s.elements);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      {elementsLoading && elements.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-earth-400 text-lg">Loading elements...</div>
        </div>
      ) : (
        <FarmScene />
      )}
      {/* Element count badge */}
      <div className="absolute bottom-4 right-4 bg-earth-800/80 backdrop-blur text-earth-400 text-xs px-3 py-1.5 rounded-lg border border-earth-700">
        {elements.length} elements
      </div>
      {/* Sidebar — handles its own mobile/desktop layout */}
      <Sidebar />
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const authenticated = useStore(s => s.authenticated);
  const authChecked = useStore(s => s.authChecked);
  const checkAuth = useStore(s => s.checkAuth);

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

  return <>{children}</>;
}

/**
 * App shell — NavBar is always visible, routes fill the remaining space.
 * The outer div is a flex column filling the viewport (100dvh via CSS).
 * Dashboard uses flex-1 to fill remaining space; Data/Vision scroll internally.
 */
export default function App() {
  return (
    <AuthGuard>
      <div className="h-full flex flex-col bg-earth-900">
        <NavBar />
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-earth-900">
            <div className="text-earth-400">Loading...</div>
          </div>
        }>
          <Switch>
            <Route path="/data" component={DataExplorer} />
            <Route path="/vision" component={Vision} />
            <Route path="/" component={Dashboard} />
          </Switch>
        </Suspense>
      </div>
    </AuthGuard>
  );
}
