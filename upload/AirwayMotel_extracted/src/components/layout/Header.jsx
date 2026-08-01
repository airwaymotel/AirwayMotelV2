import React, { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';

export default function Header() {
  const [now, setNow] = useState(new Date());
  const [isLight, setIsLight] = useState(false);

  // Live clock — tick every minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Restore persisted theme + keep <html> class in sync.
  useEffect(() => {
    const stored = localStorage.getItem('airway_theme');
    if (stored === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle('light', next);
    localStorage.setItem('airway_theme', next ? 'light' : 'dark');
  };

  return (
    <header className="fixed top-0 right-0 left-64 h-14 bg-surface border-b border-rule z-40 flex justify-between items-center px-container-padding">
      {/* Search — subtle bottom-rule input */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full group">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-faint w-4 h-4 group-focus-within:text-gold transition-colors" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search the registry…"
            className="w-full bg-transparent border-0 border-b border-transparent focus:border-gold pl-6 py-1.5 text-body-sm text-on-surface placeholder:text-on-surface-faint outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Mono live clock */}
        <div className="text-right hidden sm:block">
          <p className="text-mono text-[12px] text-on-surface-variant tabular-nums tracking-tight">
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-mono text-[12px] text-gold tabular-nums tracking-tight">
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        {/* Working dark/light toggle */}
        <button
          onClick={toggleTheme}
          className="text-on-surface-variant hover:text-gold transition-colors cursor-pointer"
          title={isLight ? 'Switch to night desk' : 'Switch to day desk'}
        >
          {isLight ? <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <Sun className="w-[18px] h-[18px]" strokeWidth={1.5} />}
        </button>

        <button className="text-on-surface-variant hover:text-gold transition-colors relative cursor-pointer" title="Notifications">
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-clay rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
