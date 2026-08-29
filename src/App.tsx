import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SmartPasteModal } from './components/SmartPasteModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TOOLS_REGISTRY, getToolById } from './registry/tools';
import { consumePendingTransfer } from './storage/transfer';
import { recordRecentTool } from './storage/preferences';
import { getDocumentMetadata, isTextEntryTarget } from './utilities/navigation';

interface ActiveTransfer {
  toolId: string;
  value: string;
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.hash || '#/');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const hasMountedRef = useRef(false);

  const parseRoute = useCallback((hash: string) => {
    const cleanHash = hash.replace(/^#\/?/, '');
    if (!cleanHash) return { view: 'dashboard' as const, toolId: null };

    if (cleanHash.startsWith('tool/')) {
      const toolId = cleanHash.replace('tool/', '').split('?')[0].split('/')[0];
      return { view: 'tool' as const, toolId };
    }

    const directTool = TOOLS_REGISTRY.find((tool) => tool.id === cleanHash);
    if (directTool) return { view: 'tool' as const, toolId: directTool.id };

    return { view: 'dashboard' as const, toolId: null };
  }, []);

  const routeInfo = parseRoute(currentRoute);
  const activeToolDef = routeInfo.toolId ? getToolById(routeInfo.toolId) : undefined;
  const ToolComponent = activeToolDef?.component;

  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash || '#/';
      setCurrentRoute(newHash);
      const parsed = parseRoute(newHash);
      const validTool = parsed.toolId ? getToolById(parsed.toolId) : undefined;

      if (parsed.view === 'tool' && parsed.toolId && validTool) {
        recordRecentTool(parsed.toolId);
        const transferred = consumePendingTransfer(parsed.toolId);
        setActiveTransfer(
          transferred ? { toolId: parsed.toolId, value: transferred } : null
        );
      } else {
        setActiveTransfer(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [parseRoute]);

  useEffect(() => {
    const metadata = getDocumentMetadata(activeToolDef);
    document.title = metadata.title;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', metadata.description);

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
  }, [currentRoute, activeToolDef]);

  const openCommandPalette = useCallback(() => {
    setIsSmartPasteOpen(false);
    setIsCommandPaletteOpen(true);
  }, []);

  const openSmartPaste = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setIsSmartPasteOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        if (isSmartPasteOpen) return;
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
        return;
      }

      if (
        event.key === '/' &&
        !isTextEntryTarget(target) &&
        !isCommandPaletteOpen &&
        !isSmartPasteOpen
      ) {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (
        event.key === 'Escape' &&
        !isCommandPaletteOpen &&
        !isSmartPasteOpen &&
        searchQuery
      ) {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isSmartPasteOpen, openCommandPalette, searchQuery]);

  const handleSelectToolFromPalette = (toolId: string) => {
    window.location.hash = `#/tool/${toolId}`;
  };

  const initialText =
    activeToolDef && activeTransfer?.toolId === activeToolDef.id
      ? activeTransfer.value
      : undefined;

  return (
    <div className="min-h-screen bg-neutral-100/50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white transition-colors">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="fixed left-3 top-2 z-[60] -translate-y-20 focus:translate-y-0 px-3 py-2 rounded-md bg-white dark:bg-neutral-900 text-sm font-semibold border border-neutral-300 dark:border-neutral-700 shadow-lg transition-transform"
      >
        Skip to main content
      </button>

      <Header onOpenSearch={openCommandPalette} onOpenSmartPaste={openSmartPaste} />

      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 focus:outline-none">
        {routeInfo.view === 'dashboard' || !activeToolDef || !ToolComponent ? (
          <Dashboard
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSmartPaste={openSmartPaste}
          />
        ) : (
          <ErrorBoundary key={activeToolDef.id} fallbackToolId={activeToolDef.id}>
            <Suspense
              fallback={
                <div
                  className="w-full max-w-6xl mx-auto px-6 py-20 flex flex-col items-center justify-center gap-3 text-neutral-400"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" aria-hidden="true" />
                  <span className="text-xs font-mono">Loading {activeToolDef.name}…</span>
                </div>
              }
            >
              <ToolComponent initialText={initialText} />
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
