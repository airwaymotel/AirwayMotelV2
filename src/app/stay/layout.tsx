'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMotelStore } from '@/lib/store';
import Sidebar, { MobileNav } from '@/components/motel/sidebar';
import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Skeleton from '@/components/ui/skeleton';

export default function StayLayout({ children }: { children: React.ReactNode }) {
  const activeTab = useMotelStore((s) => s.activeTab);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);
  const dataLoaded = useMotelStore((s) => s.dataLoaded);
  const isLoading = useMotelStore((s) => s.isLoading);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const loadFromSupabase = useMotelStore((s) => s.loadFromSupabase);
  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  if (pathname.endsWith('/print')) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  if (!dataLoaded || isLoading) {
    return (
      <AuthGuard>
        <div className="flex h-screen bg-background">
          <div className="hidden lg:flex w-56 border-r border-border bg-card p-4 space-y-4 flex-col">
            <Skeleton className="h-8 w-32" />
            <div className="space-y-2 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="h-14 border-b border-border bg-card flex items-center px-6">
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="grid gap-4 md:grid-cols-3 mt-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <div className="flex flex-1">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-card border-b border-border flex justify-between items-center px-4 lg:px-6 shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="lg:hidden shrink-0">
                  <span className="text-sm font-bold text-foreground">Airway</span>
                  <span className="text-sm font-bold text-amber-600 ml-1">Motel</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">Stay Details</Badge>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-8 w-8 text-muted-foreground"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              {children}
            </main>
          </div>
        </div>

        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </AuthGuard>
  );
}
