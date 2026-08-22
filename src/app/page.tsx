'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, User, DoorOpen, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useMotelStore } from '@/lib/store';
import Sidebar, { MobileNav } from '@/components/motel/sidebar';
import Dashboard from '@/components/motel/dashboard';
import Rooms from '@/components/motel/rooms';
import CheckIn from '@/components/motel/check-in';
import Checkout from '@/components/motel/checkout';
import Guests from '@/components/motel/guests';
import Settings from '@/components/motel/settings';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import type { NavTab } from '@/lib/types';
import type { Permission } from '@/lib/auth-types';

const TAB_PERMISSIONS: Record<NavTab, Permission | null> = {
  'dashboard': 'view_dashboard',
  'rooms': 'view_rooms',
  'check-in': 'check_in',
  'checkout': null, // always allowed
  'guests': 'view_guests',
  'settings': null, // super admin only handled separately
};

export default function Home() {
  const router = useRouter();
  const activeTab = useMotelStore((s) => s.activeTab);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);
  const dataLoaded = useMotelStore((s) => s.dataLoaded);
  const isLoading = useMotelStore((s) => s.isLoading);
  const { theme, setTheme } = useTheme();
  const { user, hasPermission, isSuperAdmin } = useAuth();
  const [now, setNow] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const guests = useMotelStore((s) => s.guests);
  const rooms = useMotelStore((s) => s.rooms);
  const getGuestStays = useMotelStore((s) => s.getGuestStays);
  const getActiveStays = useMotelStore((s) => s.getActiveStays);

  // Close search on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeStays = getActiveStays();
  
  const searchResults = (() => {
    if (searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase();
    const results: any[] = [];
    
    for (const g of guests) {
      if (
        g.firstName.toLowerCase().includes(q) || 
        g.lastName.toLowerCase().includes(q) ||
        `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
        g.phone.includes(q)
      ) {
        const stays = getGuestStays(g.id);
        const latestStay = stays.length > 0 ? stays[stays.length - 1] : null;
        results.push({
          type: 'guest',
          id: g.id,
          title: `${g.firstName} ${g.lastName}`,
          subtitle: g.phone,
          stayId: latestStay?.id,
          icon: User,
        });
      }
    }
    
    for (const r of rooms) {
      if (r.roomNumber.toLowerCase().includes(q)) {
        const activeStay = activeStays.find((s) => s.roomId === r.id);
        results.push({
          type: 'room',
          id: r.id,
          title: `Room ${r.roomNumber}`,
          subtitle: `Status: ${r.status}`,
          stayId: activeStay?.id,
          icon: DoorOpen,
        });
      }
    }
    
    return results.slice(0, 8);
  })();

  // Live clock
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data from Supabase if connected
  const loadFromSupabase = useMotelStore((s) => s.loadFromSupabase);
  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  // Filter tabs by permission
  const isTabAllowed = (tab: NavTab): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const required = TAB_PERMISSIONS[tab];
    if (!required) return tab === 'settings' ? isSuperAdmin : true;
    return hasPermission(required);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'rooms':
        return <Rooms />;
      case 'check-in':
        return <CheckIn />;
      case 'checkout':
        return <Checkout />;
      case 'guests':
        return <Guests />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const pageTitle: Record<NavTab, string> = {
    'dashboard': 'Dashboard',
    'rooms': 'Room Status',
    'check-in': 'New Check-In',
    'checkout': 'Checkout',
    'guests': 'Guest History',
    'settings': 'Settings',
  };

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-background">
        <div className="flex flex-1">
          {/* Sidebar */}
          <Sidebar activeTab={activeTab} onTabChange={(tab) => {
            if (isTabAllowed(tab)) setActiveTab(tab);
          }} />

          {/* Main Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-14 bg-card border-b border-border flex justify-between items-center px-4 lg:px-6 shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Mobile brand */}
                <div className="lg:hidden shrink-0">
                  <span className="text-sm font-bold text-foreground">Airway</span>
                  <span className="text-sm font-bold text-amber-600 ml-1">Motel</span>
                </div>

                {/* Mobile page title */}
                <Badge variant="outline" className="lg:hidden text-xs shrink-0">
                  {pageTitle[activeTab]}
                </Badge>

                {/* Search */}
                <div className="hidden lg:block relative w-full max-w-xs" ref={searchRef}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" strokeWidth={1.5} />
                  <Input
                    type="text"
                    placeholder="Search the registry..."
                    className="pl-8 h-8 bg-transparent border-0 border-b border-transparent focus:border-primary rounded-none shadow-none focus-visible:ring-0"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsSearchOpen(false);
                    }}
                  />
                  
                  {/* Search Dropdown */}
                  {isSearchOpen && searchQuery.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                      <div className="max-h-80 overflow-y-auto p-1">
                        {searchResults.length > 0 ? (
                          searchResults.map((res, i) => {
                            const Icon = res.icon;
                            return (
                              <button
                                key={`${res.type}-${res.id}-${i}`}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  if (res.stayId) {
                                    router.push(`/stay/${res.stayId}`);
                                  } else if (res.type === 'room') {
                                    setActiveTab('rooms');
                                  } else {
                                    setActiveTab('guests');
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center gap-3 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{res.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No results found for &quot;{searchQuery}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Clock */}
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] text-muted-foreground font-mono tabular-nums tracking-tight">
                    {now?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) ?? '---'}
                  </p>
                  <p className="text-[11px] text-amber-500 dark:text-amber-400 font-mono tabular-nums tracking-tight">
                    {now?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) ?? '--:--:-- --'}
                  </p>
                </div>

                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-8 w-8 text-muted-foreground"
                  title={isDark ? 'Switch to day desk' : 'Switch to night desk'}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>

                {/* Settings (mobile/tablet only) */}
                {isSuperAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setActiveTab('settings'); router.push('/'); }}
                    className="lg:hidden h-8 w-8 text-muted-foreground"
                    title="Settings"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </Button>
                )}

                {/* Profile — clickable, navigates to /profile */}
                <button
                  onClick={() => router.push('/profile')}
                  className="hidden lg:flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1 transition-colors cursor-pointer"
                >
                  <img
                    src={`https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(user?.full_name || 'user')}`}
                    alt="avatar"
                    className="w-7 h-7 rounded-full bg-muted"
                  />
                  <div className="text-left">
                    <p className="text-xs font-medium leading-none">{user?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
                  </div>
                </button>
              </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              {!dataLoaded || isLoading ? (
                <PageSkeleton />
              ) : (
                renderContent()
              )}
            </main>
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <MobileNav activeTab={activeTab} onTabChange={(tab) => {
          if (isTabAllowed(tab)) setActiveTab(tab);
        }} />
      </div>
    </AuthGuard>
  );
}
