import { useState, useEffect } from 'react';
import { Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { PRViewer } from './components/PRViewer';
import { SettingsDialog } from './components/SettingsDialog';
import { cn } from './lib/utils';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prViewerOpen, setPrViewerOpen] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={cn('flex flex-col h-screen bg-background text-foreground', darkMode && 'dark')}>
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
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
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 flex-shrink-0 border-r border-border bg-background overflow-hidden">
            <Sidebar />
          </aside>
        )}

        {/* Chat Window */}
        <main className="flex-1 overflow-hidden">
          <ChatWindow />
        </main>

        {/* PR Viewer */}
        {prViewerOpen && (
          <aside className="w-96 flex-shrink-0 border-l border-border bg-background overflow-hidden">
            <PRViewer />
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;
