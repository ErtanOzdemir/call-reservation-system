import { Role } from '@call-reservation/shared-types';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, getRolePath, useAuth } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { AdminHomePage } from '../pages/admin-home-page';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { UserHomePage } from '../pages/user-home-page';

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-status">Restoring your session…</div>;
  }

  return <Navigate to={user ? getRolePath(user.role) : '/login'} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/user"
          element={
            <ProtectedRoute role={Role.USER}>
              <UserHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={Role.ADMIN}>
              <AdminHomePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
