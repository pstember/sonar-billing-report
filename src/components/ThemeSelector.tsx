import { useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  subscribeToSystemChange,
  type Theme,
} from '../utils/theme';

const THEMES: { value: Theme; label: string; title: string; description: string }[] = [
  { value: 'light', label: 'Light', title: 'Light theme', description: 'Always use a light background' },
  { value: 'dark', label: 'Dark', title: 'Dark theme', description: 'Always use a dark background' },
  { value: 'system', label: 'System', title: 'Use system theme', description: 'Follow your device setting' },
];

function SunIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function ComputerIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="14" height="8" x="5" y="2" rx="1" />
      <path d="M15 22v-4a2 2 0 0 0-2-2H11a2 2 0 0 0-2 2v4" />
      <path d="M2 15h20" />
    </svg>
  );
}

function ThemeIcon({ theme, className }: Readonly<{ theme: Theme; className?: string }>) {
  switch (theme) {
    case 'light':
      return <SunIcon className={className} />;
    case 'dark':
      return <MoonIcon className={className} />;
    case 'system':
      return <ComputerIcon className={className} />;
  }
}

export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [hoveredTheme, setHoveredTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const unsub = subscribeToSystemChange(() => setTheme(getStoredTheme()));
    return unsub;
  }, []);

  const handleSelect = (value: Theme) => {
    setStoredTheme(value);
    applyTheme();
    setTheme(value);
  };

  return (
    <div className="relative flex items-center gap-1">
      <fieldset className="flex items-center gap-0.5 border-0 p-0 m-0" aria-label="Theme">
        {THEMES.map(({ value, title, label, description }) => {
          const isActive = theme === value;
          const showPopover = hoveredTheme === value;
          return (
            <div key={value} className="relative">
              <button
                type="button"
                onClick={() => handleSelect(value)}
                onMouseEnter={() => setHoveredTheme(value)}
                onMouseLeave={() => setHoveredTheme(null)}
                onFocus={() => setHoveredTheme(value)}
                onBlur={() => setHoveredTheme(null)}
                title={title}
                aria-label={title}
                aria-pressed={isActive}
                aria-describedby={showPopover ? `theme-popover-${value}` : undefined}
                className={`p-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-sonar-blue focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 ${
                  isActive
                    ? 'bg-sonar-blue/15 dark:bg-sonar-blue/25 text-sonar-blue dark:text-sonar-blue border-sonar-blue/40'
                    : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <ThemeIcon theme={value} />
              </button>
              {showPopover && (
                <div
                  id={`theme-popover-${value}`}
                  role="tooltip"
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-2 px-3 pointer-events-none"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm font-body">{label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-body mt-0.5">{description}</p>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}
