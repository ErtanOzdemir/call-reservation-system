import { Role } from '@call-reservation/shared-types';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getRolePath, useAuth } from './auth-context';

export function ProtectedRoute({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-status">Restoring your session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={getRolePath(user.role)} replace />;
  }

  return children;
}
