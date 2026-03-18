import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStoredTheme,
  setStoredTheme,
  applyTheme,
  isDark,
  subscribeToSystemChange,
  type Theme,
} from './theme';

const STORAGE_KEY = 'theme';

describe('theme', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', originalLocalStorage);
    vi.stubGlobal('window', originalWindow);
  });

  describe('getStoredTheme', () => {
    it('returns "system" when localStorage is undefined', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(getStoredTheme()).toBe('system');
    });

    it('returns stored theme when valid', () => {
      vi.stubGlobal('localStorage', originalLocalStorage);
      (['light', 'dark', 'system'] as Theme[]).forEach((theme) => {
        originalLocalStorage.setItem(STORAGE_KEY, theme);
        expect(getStoredTheme()).toBe(theme);
      });
    });

    it('returns "system" when stored value is invalid', () => {
      originalLocalStorage.setItem(STORAGE_KEY, 'invalid');
      expect(getStoredTheme()).toBe('system');
    });

    it('returns "system" when key is missing', () => {
      originalLocalStorage.removeItem(STORAGE_KEY);
      expect(getStoredTheme()).toBe('system');
    });
  });

  describe('setStoredTheme', () => {
    it('sets theme in localStorage', () => {
      vi.stubGlobal('localStorage', originalLocalStorage);
      setStoredTheme('dark');
      expect(originalLocalStorage.getItem(STORAGE_KEY)).toBe('dark');
      setStoredTheme('light');
      expect(originalLocalStorage.getItem(STORAGE_KEY)).toBe('light');
    });

    it('does not throw when localStorage is undefined', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(() => setStoredTheme('light')).not.toThrow();
    });
  });

  describe('applyTheme', () => {
    const createMatchMedia = (matches: boolean) => () => ({
      matches,
      addListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    beforeEach(() => {
      if (typeof originalWindow !== 'undefined') {
        (originalWindow as Window & { matchMedia?: (q: string) => MediaQueryList }).matchMedia =
          createMatchMedia(false);
      }
    });

    it('does not throw when document is undefined', () => {
      const doc = globalThis.document;
      vi.stubGlobal('document', undefined);
      setStoredTheme('light');
      expect(() => applyTheme()).not.toThrow();
      vi.stubGlobal('document', doc);
    });

    it('adds .dark class when theme is dark', () => {
      setStoredTheme('dark');
      document.documentElement.classList.remove('dark');
      applyTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes .dark class when theme is light', () => {
      setStoredTheme('light');
      document.documentElement.classList.add('dark');
      applyTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('respects system preference when theme is system', () => {
      const addListener = vi.fn();
      const removeListener = vi.fn();
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addListener: addListener,
        addEventListener: addListener,
        removeEventListener: removeListener,
        dispatchEvent: vi.fn(),
      })));

      setStoredTheme('system');
      document.documentElement.classList.remove('dark');
      applyTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('dispatches themechange event when window exists', () => {
      const listeners: Array<(e: MediaQueryListEvent) => void> = [];
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: false,
        addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => { listeners.push(fn); },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })));

      setStoredTheme('light');
      const spy = vi.fn();
      window.addEventListener('themechange', spy);
      applyTheme();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: { dark: false } }));
      window.removeEventListener('themechange', spy);
    });
  });

  describe('isDark', () => {
    it('returns false when document is undefined', () => {
      const doc = globalThis.document;
      vi.stubGlobal('document', undefined);
      expect(isDark()).toBe(false);
      vi.stubGlobal('document', doc);
    });

    it('returns true when .dark is on documentElement', () => {
      document.documentElement.classList.add('dark');
      expect(isDark()).toBe(true);
      document.documentElement.classList.remove('dark');
    });

    it('returns false when .dark is not on documentElement', () => {
      document.documentElement.classList.remove('dark');
      expect(isDark()).toBe(false);
    });
  });

  describe('subscribeToSystemChange', () => {
    it('returns no-op unsubscribe when window is undefined', () => {
      const win = globalThis.window;
      vi.stubGlobal('window', undefined);
      const unsubscribe = subscribeToSystemChange(() => {});
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
      vi.stubGlobal('window', win);
    });

    it('adds listener and unsubscribe removes it', () => {
      const removeEventListener = vi.fn();
      const addEventListener = vi.fn((_event: string, handler: () => void) => {
        return { removeEventListener: () => removeEventListener(handler) };
      });
      vi.stubGlobal('matchMedia', vi.fn(() => ({
        matches: false,
        addEventListener,
        removeEventListener,
      })));

      setStoredTheme('system');
      const callback = vi.fn();
      const unsubscribe = subscribeToSystemChange(callback);
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      unsubscribe();
      expect(removeEventListener).toHaveBeenCalled();
    });
  });
});
