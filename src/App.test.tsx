import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock('./components/ChatWindow', () => ({
  ChatWindow: () => <div>Chat Window</div>,
}));

vi.mock('./components/PRViewer', () => ({
  PRViewer: () => <div>PR Viewer</div>,
}));

vi.mock('./components/SettingsDialog', () => ({
  SettingsDialog: () => <div>Settings</div>,
}));

describe('App dark mode behavior', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    };
    vi.stubGlobal('localStorage', localStorageMock);
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('dark');
    vi.unstubAllGlobals();
  });

  it('uses persisted dark mode preference from localStorage', () => {
    storage.set('darkMode', 'true');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

    render(<App />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTitle('Light mode')).toBeInTheDocument();
  });

  it('falls back to system preference when localStorage has no value', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    render(<App />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(storage.get('darkMode')).toBe('true');
  });

  it('persists preference when user toggles dark mode', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

    render(<App />);

    const toggleButton = screen.getByTitle('Dark mode');
    fireEvent.click(toggleButton);

    expect(storage.get('darkMode')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTitle('Light mode')).toBeInTheDocument();
  });
});
