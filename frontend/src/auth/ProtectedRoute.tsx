import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Permission, UserRole } from './users';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: Permission;
  role?: UserRole;
}

export function ProtectedRoute({ children, permission, role }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, hasRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (role && !hasRole(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
