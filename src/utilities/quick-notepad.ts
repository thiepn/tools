/**
 * Quick Notepad / Scratchpad Utility
 * LocalStorage autosaved notes, defensive schema handling, stats calculations, and export
 */

export interface NoteDoc {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPinned?: boolean;
}

export interface NotepadStore {
  version: number;
  activeNoteId: string;
  notes: NoteDoc[];
}

export const NOTEPAD_STORAGE_KEY = 'tiny_tools_notepad_store_v1';

export const defaultNotepadStore: NotepadStore = {
  version: 1,
  activeNoteId: 'note-welcome',
  notes: [
    {
      id: 'note-welcome',
      title: 'Welcome Scratchpad',
      content:
        '# Quick Scratchpad\n\n- Everything here is saved automatically in your browser.\n- Zero cloud servers, zero tracking.\n- Click "New Note" to create additional notes.\n- Use the toolbar below to copy, download TXT/Markdown, or send text directly to other tools.',
      updatedAt: Date.now(),
      isPinned: true,
    },
  ],
};

/**
 * Defensively parses and sanitizes a raw string or object into a NotepadStore
 */
export function sanitizeNotepadStore(raw: unknown): NotepadStore {
  if (!raw || typeof raw !== 'object') return defaultNotepadStore;

  try {
    const candidate = raw as Partial<NotepadStore>;
    if (!Array.isArray(candidate.notes) || candidate.notes.length === 0) {
      return defaultNotepadStore;
    }

    const sanitizedNotes: NoteDoc[] = candidate.notes
      .filter((n): n is NoteDoc => Boolean(n && typeof n === 'object' && typeof n.id === 'string'))
      .map((n) => ({
        id: n.id,
        title: typeof n.title === 'string' && n.title.trim() ? n.title.trim() : 'Untitled Note',
        content: typeof n.content === 'string' ? n.content : '',
        updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
        isPinned: Boolean(n.isPinned),
      }));

    if (sanitizedNotes.length === 0) return defaultNotepadStore;

    const activeNoteId =
      typeof candidate.activeNoteId === 'string' &&
      sanitizedNotes.some((n) => n.id === candidate.activeNoteId)
        ? candidate.activeNoteId
        : sanitizedNotes[0].id;

    return {
      version: 1,
      activeNoteId,
      notes: sanitizedNotes,
    };
  } catch {
    return defaultNotepadStore;
  }
}

/**
 * Retrieves persisted notes from localStorage safely
 */
export function getStoredNotes(): NotepadStore {
  if (typeof window === 'undefined' || !window.localStorage) return defaultNotepadStore;
  try {
    const raw = window.localStorage.getItem(NOTEPAD_STORAGE_KEY);
    if (!raw) return defaultNotepadStore;
    const parsed = JSON.parse(raw);
    return sanitizeNotepadStore(parsed);
  } catch {
    return defaultNotepadStore;
  }
}

/**
 * Saves notes store to localStorage
 */
export function saveNotes(store: NotepadStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Calculates words, characters, and line counts for a note
 */
export function calculateNoteStats(text: string): {
  words: number;
  chars: number;
  lines: number;
} {
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  return { words, chars, lines };
}
