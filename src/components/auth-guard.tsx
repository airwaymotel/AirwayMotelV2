'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage for auth flag
    const authFlag = localStorage.getItem('airway_auth');
    
    if (authFlag === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      // Redirect to login, but only if we are not already there 
      // (though AuthGuard shouldn't be used on /login)
      if (pathname !== '/login') {
        router.replace('/login');
      }
    }
  }, [pathname, router]);

  // Show nothing or a loading spinner while checking auth status on client side
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // If not authenticated, the useEffect will redirect. We return null to prevent rendering protected content.
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
