'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Sun, Moon, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMotelStore } from '@/lib/store';
import Sidebar, { MobileNav } from '@/components/motel/sidebar';
import AuthGuard from '@/components/auth-guard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function StayLayout({ children }: { children: React.ReactNode }) {
  const activeTab = useMotelStore((s) => s.activeTab);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);
  const isLoading = useMotelStore((s) => s.isLoading);
  const isUsingSupabase = useMotelStore((s) => s.isUsingSupabase);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  // Load data from Supabase if connected
  const loadFromSupabase = useMotelStore((s) => s.loadFromSupabase);
  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  if (pathname.endsWith('/print')) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  // Show loading spinner while Supabase data is loading
  if (isUsingSupabase && isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex flex-1">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-card border-b border-border flex justify-between items-center px-4 lg:px-6 shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="md:hidden shrink-0">
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

            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
              {children}
            </main>
          </div>
        </div>

        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </AuthGuard>
  );
}
