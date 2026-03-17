/**
 * Theme (light/dark/system) persistence and application.
 * Uses class .dark on <html> so Tailwind's dark: variant applies.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

export function getStoredTheme(): Theme {
  if (typeof globalThis.localStorage === 'undefined') return 'system';
  const t = globalThis.localStorage.getItem(STORAGE_KEY);
  if (t === 'light' || t === 'dark' || t === 'system') return t;
  return 'system';
}

export function setStoredTheme(theme: Theme): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(STORAGE_KEY, theme);
}

function isSystemDark(): boolean {
  return (
    typeof globalThis.window !== 'undefined' &&
    globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Apply theme to document: add or remove .dark on <html> */
export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const theme = getStoredTheme();
  const dark =
    theme === 'dark' || (theme === 'system' && isSystemDark());
  document.documentElement.classList.toggle('dark', dark);
}

/** Whether the UI should currently show dark styles */
export function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

/** Subscribe to system preference changes when theme is 'system'. Returns unsubscribe. */
export function subscribeToSystemChange(callback: () => void): () => void {
  if (typeof globalThis.window === 'undefined') return () => {};
  const mq = globalThis.window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getStoredTheme() === 'system') {
      applyTheme();
      callback();
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
