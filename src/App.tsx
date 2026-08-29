import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SmartPasteModal } from './components/SmartPasteModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TOOLS_REGISTRY, getToolById } from './registry/tools';
import { consumePendingTransfer } from './storage/transfer';
import { recordRecentTool } from './storage/preferences';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.hash || '#/');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [transferData, setTransferData] = useState<Record<string, string>>({});

  // Route parser
  const parseRoute = useCallback((hash: string) => {
    const cleanHash = hash.replace(/^#\/?/, '');
    if (!cleanHash) {
      return { view: 'dashboard' as const, toolId: null };
    }
    if (cleanHash.startsWith('tool/')) {
      const toolId = cleanHash.replace('tool/', '').split('?')[0].split('/')[0];
      return { view: 'tool' as const, toolId };
    }
    // Direct tool route matching (e.g. #/text-cleaner)
    const directTool = TOOLS_REGISTRY.find((t) => t.id === cleanHash);
    if (directTool) {
      return { view: 'tool' as const, toolId: directTool.id };
    }
    return { view: 'dashboard' as const, toolId: null };
  }, []);

  const routeInfo = parseRoute(currentRoute);

  // Sync hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash || '#/';
      setCurrentRoute(newHash);
      const parsed = parseRoute(newHash);

      if (parsed.view === 'tool' && parsed.toolId) {
        // Record recent usage
        recordRecentTool(parsed.toolId);

        // Check if there is pending transferred data for this tool
        const transferred = consumePendingTransfer(parsed.toolId);
        if (transferred) {
          setTransferData((prev) => ({
            ...prev,
            [parsed.toolId!]: transferred,
          }));
        }
      }
    };

    // Initial check on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [parseRoute]);

  // Global Keyboard Shortcuts (⌘K, Ctrl+K, /, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is actively typing in an input/textarea unless it's a Cmd+K / Ctrl+K shortcut
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === '/' && !isInput && !isCommandPaletteOpen && !isSmartPasteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isSmartPasteOpen) {
          setIsSmartPasteOpen(false);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isSmartPasteOpen, searchQuery]);

  const activeToolDef = routeInfo.toolId ? getToolById(routeInfo.toolId) : undefined;
  const ToolComponent = activeToolDef?.component;

  const handleSelectToolFromPalette = (toolId: string) => {
    window.location.hash = `#/tool/${toolId}`;
  };

  return (
    <div className="min-h-screen bg-neutral-100/50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white transition-colors">
      <Header
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onOpenSmartPaste={() => setIsSmartPasteOpen(true)}
      />

      <main className="flex-1">
        {routeInfo.view === 'dashboard' || !activeToolDef || !ToolComponent ? (
          <Dashboard
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSmartPaste={() => setIsSmartPasteOpen(true)}
          />
        ) : (
          <ErrorBoundary fallbackToolId={activeToolDef.id}>
            <Suspense
              fallback={
                <div className="w-full max-w-6xl mx-auto px-6 py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-mono">Loading {activeToolDef.name}...</span>
                </div>
              }
            >
              <ToolComponent initialText={transferData[activeToolDef.id]} />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTool={handleSelectToolFromPalette}
      />

      <SmartPasteModal
        isOpen={isSmartPasteOpen}
        onClose={() => setIsSmartPasteOpen(false)}
      />
    </div>
  );
}
