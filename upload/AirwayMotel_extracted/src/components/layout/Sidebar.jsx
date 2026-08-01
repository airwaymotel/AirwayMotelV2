import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Bed, History, Settings } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: PlusSquare, label: 'New Check-In', path: '/check-in' },
  { icon: Bed, label: 'Room Status', path: '/rooms' },
  { icon: History, label: 'Guest History', path: '/guests' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="fixed h-full w-64 left-0 top-0 bg-surface border-r border-rule flex flex-col z-50">
      {/* Brand */}
      <div className="px-6 pt-8 pb-10 border-b border-rule">
        <h1 className="font-display text-title-lg text-on-surface leading-none">
          Airway
        </h1>
        <h1 className="font-display text-title-lg text-gold leading-none mt-0.5">
          Motel
        </h1>
        <p className="text-eyebrow text-on-surface-faint mt-3">Night Registry · Est. Denver</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 flex flex-col">
        <p className="text-eyebrow text-on-surface-faint px-6 mb-3">Ledger</p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-6 py-2.5 transition-colors text-body-sm ${
                isActive
                  ? 'text-gold-bright bg-surface-raised'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Left gold rule for active */}
                <span
                  className={`absolute left-0 top-0 bottom-0 w-[2px] bg-gold transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer mark */}
      <div className="px-6 py-5 border-t border-rule">
        <p className="text-eyebrow text-on-surface-faint">Admin Terminal</p>
        <p className="text-mono text-[11px] text-on-surface-faint mt-1">v1.0 · ◉ live</p>
      </div>
    </aside>
  );
}
