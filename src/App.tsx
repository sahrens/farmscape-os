import { useEffect, lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { useStore } from '@/lib/store';
import { Login } from '@/pages/Login';
import { FarmScene } from '@/components/FarmScene';
import { Sidebar } from '@/components/Sidebar';
import { Toolbar } from '@/components/Toolbar';

const DataExplorer = lazy(() => import('@/pages/DataExplorer'));
const Vision = lazy(() => import('@/pages/Vision'));

function Dashboard() {
  const fetchElements = useStore(s => s.fetchElements);
  const elementsLoading = useStore(s => s.elementsLoading);
  const elements = useStore(s => s.elements);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* 3D scene always fills full screen */}
      <div className="absolute inset-0">
        <Toolbar />
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
      </div>

      {/* Sidebar handles its own mobile/desktop layout */}
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

export default function App() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-earth-900">
          <div className="text-earth-400">Loading...</div>
        </div>
      }>
        <Switch>
          <Route path="/data" component={DataExplorer} />
          <Route path="/vision" component={Vision} />
          <Route path="/" component={Dashboard} />
        </Switch>
      </Suspense>
    </AuthGuard>
  );
}
