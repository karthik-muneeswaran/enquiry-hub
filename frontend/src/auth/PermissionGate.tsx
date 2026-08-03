import { useAuth } from './AuthContext';
import type { Permission } from './users';
import type { ReactNode } from 'react';

interface PermissionGateProps {
  children: ReactNode;
  permission: Permission;
  fallback?: ReactNode;
}

export function PermissionGate({ children, permission, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
