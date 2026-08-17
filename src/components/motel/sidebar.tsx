'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusSquare,
  Bed,
  LogOut,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import type { NavTab } from '@/lib/types';
import type { Permission } from '@/lib/auth-types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const navItems: { icon: typeof LayoutDashboard; label: string; tab: NavTab; permission?: Permission }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', tab: 'dashboard', permission: 'view_dashboard' },
  { icon: PlusSquare, label: 'New Check-In', tab: 'check-in', permission: 'check_in' },
  { icon: Bed, label: 'Room Status', tab: 'rooms', permission: 'view_rooms' },
  { icon: LogOut, label: 'Checkout', tab: 'checkout' },
  { icon: Users, label: 'Guest History', tab: 'guests', permission: 'view_guests' },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();
  const { isSuperAdmin, hasPermission, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleNav = (tab: NavTab) => {
    onTabChange(tab);
    router.push('/');
  };

  const visibleItems = navItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col bg-card border-r border-border h-full transition-all duration-300 relative',
        collapsed ? 'w-[68px]' : 'w-56 lg:w-64'
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center border-b border-border px-4 shrink-0">
        {!collapsed && (
          <span className="text-sm font-bold">
            <span className="text-foreground">Airway</span>
            <span className="text-amber-600 ml-1">Motel</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map(({ icon: Icon, label, tab }) => (
          <button
            key={tab}
            onClick={() => handleNav(tab)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
              activeTab === tab
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}

        {/* Settings — super admin only */}
        {isSuperAdmin && (
          <button
            onClick={() => handleNav('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
              activeTab === 'settings'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}

// Mobile Bottom Nav
export function MobileNav({ activeTab, onTabChange }: SidebarProps) {
  const { isSuperAdmin, hasPermission, logout } = useAuth();

  const mobileItems = navItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <nav className="flex items-center justify-around h-14">
        {mobileItems.map(({ icon: Icon, label, tab }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer',
              activeTab === tab
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label.split(' ').pop()}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
