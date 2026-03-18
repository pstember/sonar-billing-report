/**
 * Unit tests for ThemeSelector.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSelector from './ThemeSelector';

const getStoredTheme = vi.fn();
const setStoredTheme = vi.fn();
const applyTheme = vi.fn();
const subscribeToSystemChange = vi.fn();

vi.mock('../utils/theme', () => ({
  getStoredTheme: (...args: unknown[]) => getStoredTheme(...args),
  setStoredTheme: (...args: unknown[]) => setStoredTheme(...args),
  applyTheme: (...args: unknown[]) => applyTheme(...args),
  subscribeToSystemChange: (...args: unknown[]) => subscribeToSystemChange(...args),
}));

describe('ThemeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredTheme.mockReturnValue('light');
    subscribeToSystemChange.mockReturnValue(() => {});
  });

  it('renders theme buttons for light, dark, system', () => {
    render(<ThemeSelector />);
    expect(screen.getByLabelText('Light theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Dark theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Use system theme')).toBeInTheDocument();
  });

  it('calls setStoredTheme and applyTheme when selecting a theme', async () => {
    const user = userEvent.setup();
    render(<ThemeSelector />);
    await user.click(screen.getByLabelText('Dark theme'));
    expect(setStoredTheme).toHaveBeenCalledWith('dark');
    expect(applyTheme).toHaveBeenCalled();
  });

  it('unsubscribes from system change on unmount', () => {
    const unsub = vi.fn();
    subscribeToSystemChange.mockReturnValue(unsub);
    const { unmount } = render(<ThemeSelector />);
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
