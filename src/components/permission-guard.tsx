'use client';

import { useAuth } from './auth-provider';
import type { Permission } from '@/lib/auth-types';
import { AlertTriangle } from 'lucide-react';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { hasPermission } = useAuth();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        You don&apos;t have permission to access this section.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Contact your administrator to request access.
      </p>
    </div>
  );
}
