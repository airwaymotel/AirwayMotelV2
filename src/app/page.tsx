'use client';

import { useState } from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { useMotelStore } from '@/lib/store';
import Sidebar, { MobileNav } from '@/components/motel/sidebar';
import Dashboard from '@/components/motel/dashboard';
import Rooms from '@/components/motel/rooms';
import CheckIn from '@/components/motel/check-in';
import Checkout from '@/components/motel/checkout';
import Guests from '@/components/motel/guests';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { NavTab } from '@/lib/types';

export default function Home() {
  const activeTab = useMotelStore((s) => s.activeTab);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);
  const [isLight, setIsLight] = useState(false);
  const [now, setNow] = useState(new Date());

  // Live clock
  useState(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  });

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle('dark', !next);
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 bg-card border-b border-border flex justify-between items-center px-4 lg:px-6 shrink-0">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Mobile brand */}
              <div className="md:hidden shrink-0">
                <span className="text-sm font-bold text-foreground">Airway</span>
                <span className="text-sm font-bold text-amber-600 ml-1">Motel</span>
              </div>

              {/* Mobile page title */}
              <Badge variant="outline" className="md:hidden text-xs shrink-0">
                {pageTitle[activeTab]}
              </Badge>

              {/* Search */}
              <div className="hidden md:block relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" strokeWidth={1.5} />
                <Input
                  type="text"
                  placeholder="Search the registry..."
                  className="pl-8 h-8 bg-transparent border-0 border-b border-transparent focus:border-primary rounded-none shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Clock */}
              <div className="text-right hidden sm:block">
                <p className="text-[11px] text-muted-foreground font-mono tabular-nums tracking-tight">
                  {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[11px] text-amber-600 font-mono tabular-nums tracking-tight">
                  {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 text-muted-foreground"
                title={isLight ? 'Switch to night desk' : 'Switch to day desk'}
              >
                {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </Button>

              {/* Admin */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                  AD
                </div>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
