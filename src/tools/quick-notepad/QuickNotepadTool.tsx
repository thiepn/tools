import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Pin,
  Sparkles,
  Share2,
  ShieldCheck,
  Files,
  Clock,
  CheckCheck,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  getStoredNotes,
  saveNotes,
  calculateNoteStats,
  NotepadStore,
  NoteDoc,
} from '../../utilities/quick-notepad';
import { copyToClipboard } from '../../utilities/clipboard';
import { getPendingTransfer, clearPendingTransfer, setPendingTransfer } from '../../storage/transfer';

export const QuickNotepadTool: React.FC = () => {
  const [store, setStore] = useState<NotepadStore>(getStoredNotes);
  const [copied, setCopied] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<'mono' | 'sans'>('sans');
  const [saveStatus, setSaveStatus] = useState<string>('Saved locally');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Check incoming pending transfer text
  useEffect(() => {
    const pending = getPendingTransfer('notepad');
    if (pending) {
      const newNote: NoteDoc = {
        id: `note-${Date.now()}`,
        title: `Transferred Note (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        content: pending,
        updatedAt: Date.now(),
      };
      setStore((prev) => ({
        ...prev,
        activeNoteId: newNote.id,
        notes: [newNote, ...prev.notes],
      }));
      clearPendingTransfer('notepad');
    }
  }, []);

  // Persist notes changes
  useEffect(() => {
    saveNotes(store);
    setSaveStatus('Saved locally');
  }, [store]);

  const activeNote =
    store.notes.find((n) => n.id === store.activeNoteId) ||
    store.notes[0] || {
      id: 'default',
      title: 'Quick Scratchpad',
      content: '',
      updatedAt: Date.now(),
    };

  const stats = calculateNoteStats(activeNote.content);

  const handleUpdateActiveNote = (updates: Partial<NoteDoc>) => {
    setSaveStatus('Saving...');
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === activeNote.id ? { ...n, ...updates, updatedAt: Date.now() } : n
      ),
    }));
  };

  const handleCreateNewNote = () => {
    const newNote: NoteDoc = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      updatedAt: Date.now(),
    };
    setStore((prev) => ({
      ...prev,
      activeNoteId: newNote.id,
      notes: [newNote, ...prev.notes],
    }));
  };

  const handleDuplicateNote = () => {
    const duplicated: NoteDoc = {
      id: `note-${Date.now()}`,
      title: `${activeNote.title} (Copy)`,
      content: activeNote.content,
      updatedAt: Date.now(),
      isPinned: false,
    };
    setStore((prev) => ({
      ...prev,
      activeNoteId: duplicated.id,
      notes: [duplicated, ...prev.notes],
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    if (store.notes.length <= 1) {
      handleUpdateActiveNote({ content: '', title: 'Quick Scratchpad' });
      return;
    }
    const remaining = store.notes.filter((n) => n.id !== noteId);
    setStore({
      version: 1,
      activeNoteId: remaining[0].id,
      notes: remaining,
    });
  };

  const handleTogglePin = (noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n)),
    }));
  };

  const handleCopy = async () => {
    if (!activeNote.content) return;
    const ok = await copyToClipboard(activeNote.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (format: 'md' | 'txt') => {
    if (!activeNote.content) return;
    const mimeType = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([activeNote.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeNote.title.toLowerCase().replace(/\s+/g, '-')}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToTool = (targetToolId: string) => {
    if (!activeNote.content) return;
    setPendingTransfer(targetToolId, activeNote.content);
    window.location.hash = `#/tool/${targetToolId}`;
  };

  // Sort notes: pinned first, then updatedAt descending
  const sortedNotes = [...store.notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <ToolShell
      toolId="notepad"
      title="Quick Notepad / Scratchpad"
      description="Autosaving local scratchpad for quick notes, code snippets, drafts, and seamless data transfer across Tiny Tools."
      category="productivity"
      relatedToolIds={['word-counter', 'text-cleaner', 'checklist', 'case-converter', 'text-to-speech']}
      outputToTransfer={activeNote.content}
    >
      <div className="space-y-6">
        {/* Top Actions Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Notes Switcher */}
            <select
              value={activeNote.id}
              onChange={(e) => setStore({ ...store, activeNoteId: e.target.value })}
              className="px-2.5 py-1.5 text-xs font-semibold border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 max-w-[200px]"
            >
              {sortedNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.isPinned ? '📌 ' : ''}
                  {n.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNewNote}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateNote}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
              title="Duplicate current note"
            >
              <Files className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => handleTogglePin(activeNote.id)}
              className={`p-1.5 rounded border text-xs ${
                activeNote.isPinned
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500'
              }`}
              title={activeNote.isPinned ? 'Unpin note' : 'Pin note to top'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            {store.notes.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteNote(activeNote.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs border rounded bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 p-0.5">
              <button
                type="button"
                onClick={() => setFontFamily('sans')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  fontFamily === 'sans' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-500'
                }`}
              >
                Sans
              </button>
              <button
                type="button"
                onClick={() => setFontFamily('mono')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  fontFamily === 'mono' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-500'
                }`}
              >
                Mono
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!activeNote.content}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('txt')}
              disabled={!activeNote.content}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              <span>.txt</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('md')}
              disabled={!activeNote.content}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.md</span>
            </button>
          </div>
        </div>

        {/* Note Editor Area */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={activeNote.title}
              onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
              className="text-base font-bold bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none text-neutral-900 dark:text-neutral-100 px-1 flex-1 min-w-[200px]"
            />
            <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCheck className="w-3.5 h-3.5" />
                {saveStatus}
              </span>
              <span>•</span>
              <span>{stats.words} words</span>
              <span>•</span>
              <span>{stats.chars} chars</span>
              <span>•</span>
              <span>{stats.lines} lines</span>
            </div>
          </div>

          <textarea
            ref={textAreaRef}
            value={activeNote.content}
            onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
            placeholder="Type or paste note content here (saved automatically)..."
            rows={14}
            className={`w-full p-4 text-sm border rounded-xl bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y shadow-2xs ${
              fontFamily === 'mono' ? 'font-mono text-xs sm:text-sm' : 'font-sans'
            }`}
          />
        </div>

        {/* Quick Chaining Ribbon */}
        {activeNote.content && (
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Send Current Note To:
              </span>
              <div className="flex items-center gap-1 text-neutral-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Zero server storage. In-memory local transfer.</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {[
                { id: 'word-counter', label: 'Word Counter' },
                { id: 'text-cleaner', label: 'Text Cleaner' },
                { id: 'case-converter', label: 'Case Converter' },
                { id: 'text-to-speech', label: 'Text-to-Speech' },
                { id: 'base64', label: 'Base64 Tool' },
                { id: 'hash-generator', label: 'Hash Generator' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSendToTool(t.id)}
                  className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-medium shadow-2xs"
                >
                  → {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default QuickNotepadTool;
