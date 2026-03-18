/**
 * Hook for handling keyboard shortcuts
 */

import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const modifierMatches = shortcut.ctrlOrCmd ? isCtrlOrCmd : !isCtrlOrCmd;

        if (keyMatches && modifierMatches) {
          // Don't trigger if user is typing in an input/textarea
          const target = event.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            continue;
          }

          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
