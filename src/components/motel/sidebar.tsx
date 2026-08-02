'use client';

import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusSquare,
  Bed,
  LogOut,
  Users,
} from 'lucide-react';
import type { NavTab } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const navItems: { icon: typeof LayoutDashboard; label: string; tab: NavTab }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', tab: 'dashboard' },
  { icon: PlusSquare, label: 'New Check-In', tab: 'check-in' },
  { icon: Bed, label: 'Room Status', tab: 'rooms' },
  { icon: LogOut, label: 'Checkout', tab: 'checkout' },
  { icon: Users, label: 'Guest History', tab: 'guests' },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('airway_auth');
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col bg-card border-r border-border h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-border flex items-center gap-3">
        <div className="shrink-0">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#f59e0b" />
            <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 22H25" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-none flex items-center gap-1">
            <span>Airway</span>
            <span className="text-amber-500 dark:text-amber-400">Motel</span>
          </h1>
          <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-widest font-bold">
            Admin
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col">
        <p className="text-[10px] text-muted-foreground px-5 mb-2 uppercase tracking-widest font-semibold">
          Ledger
        </p>
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className={cn(
                'group relative flex items-center gap-3 px-5 py-2.5 transition-colors text-sm cursor-pointer',
                isActive
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <span
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-[2px] transition-opacity',
                  isActive ? 'bg-amber-500 dark:bg-amber-400 opacity-100' : 'opacity-0'
                )}
              />
              <item.icon className="w-4 h-4" strokeWidth={1.5} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom navigation
export function MobileNav({ activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('airway_auth');
    router.push('/login');
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex justify-around items-center h-14 safe-area-bottom">
      {navItems.map((item) => {
        const isActive = activeTab === item.tab;
        return (
          <button
            key={item.tab}
            onClick={() => onTabChange(item.tab)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-colors cursor-pointer min-w-[48px] min-h-[44px]',
              isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}
          >
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[9px] font-medium truncate max-w-[60px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
