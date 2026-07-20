import { Routes, Route, Navigate } from 'react-router-dom';
import { ApiStatusProvider } from './lib/ApiStatusContext';
import ErrorBoundary from './lib/ErrorBoundary';
import { AuthProvider } from './lib/useAuth';
import PrivateRoute from './lib/PrivateRoute';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ApiStatusProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </ErrorBoundary>
      </ApiStatusProvider>
    </AuthProvider>
  );
}
