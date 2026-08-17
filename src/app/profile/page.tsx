'use client';

import { useAuth } from '@/components/auth-provider';
import AuthGuard from '@/components/auth-guard';
import SuperAdminProfile from '@/components/motel/super-admin-profile';
import OperatorProfile from '@/components/motel/operator-profile';

export default function ProfilePage() {
  const { isSuperAdmin } = useAuth();

  return (
    <AuthGuard>
      {isSuperAdmin ? <SuperAdminProfile /> : <OperatorProfile />}
    </AuthGuard>
  );
}
