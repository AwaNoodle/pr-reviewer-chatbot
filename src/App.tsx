import { useState, useEffect } from 'react';
import { Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { PRViewer } from './components/PRViewer';
import { SettingsDialog } from './components/SettingsDialog';
import { cn } from './lib/utils';

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedPreference = window.localStorage.getItem('darkMode');
    if (storedPreference === 'true') {
      return true;
    }
    if (storedPreference === 'false') {
      return false;
    }
  } catch {
    // Ignore storage errors and fall back to OS preference.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function App() {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prViewerOpen, setPrViewerOpen] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('darkMode', String(darkMode));
    } catch {
      // Ignore storage errors.
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((previousValue) => !previousValue);
  };

  return (
    <div className={cn('flex flex-col h-screen bg-background text-foreground', darkMode && 'dark')}>
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 active:scale-95"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <span className="text-sm font-semibold text-foreground">PR Review Chatbot</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPrViewerOpen(!prViewerOpen)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 active:scale-95',
              prViewerOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {prViewerOpen ? 'Hide PR' : 'Show PR'}
          </button>
          <SettingsDialog />
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 active:scale-95"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex-shrink-0 bg-background overflow-hidden transition-[width,opacity,transform,border-color] duration-300 ease-out',
            sidebarOpen
              ? 'w-64 opacity-100 translate-x-0 border-r border-border'
              : 'w-0 opacity-0 -translate-x-2 border-r border-transparent pointer-events-none'
          )}
          aria-hidden={!sidebarOpen}
        >
          <div className="h-full w-64">
            <Sidebar />
          </div>
        </aside>

        {/* Chat Window */}
        <main className="flex-1 overflow-hidden">
          <ChatWindow />
        </main>

        {/* PR Viewer */}
        <aside
          className={cn(
            'flex-shrink-0 bg-background overflow-hidden transition-[width,opacity,transform,border-color] duration-300 ease-out',
            prViewerOpen
              ? 'w-96 opacity-100 translate-x-0 border-l border-border'
              : 'w-0 opacity-0 translate-x-2 border-l border-transparent pointer-events-none'
          )}
          aria-hidden={!prViewerOpen}
        >
          <div className="h-full w-96">
            <PRViewer />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
