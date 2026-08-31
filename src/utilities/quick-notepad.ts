/** Quick Notepad / Scratchpad Utility */

export interface NoteDoc { id: string; title: string; content: string; updatedAt: number; isPinned?: boolean; }
export interface NotepadStore { version: number; activeNoteId: string; notes: NoteDoc[]; }
export const NOTEPAD_STORAGE_KEY = 'tiny_tools_notepad_store_v1';

function createDefaultNotepadStore(): NotepadStore {
  return {
    version: 1,
    activeNoteId: 'note-welcome',
    notes: [{
      id: 'note-welcome',
      title: 'Welcome Scratchpad',
      content: '# Quick Scratchpad\n\n- Everything here is saved automatically in your browser.\n- Zero cloud servers, zero tracking.\n- Click "New Note" to create additional notes.\n- Use the toolbar below to copy, download TXT/Markdown, or send text directly to other tools.',
      updatedAt: Date.now(),
      isPinned: true,
    }],
  };
}

export const defaultNotepadStore: NotepadStore = createDefaultNotepadStore();
const MAX_NOTES = 1000;
const MAX_NOTE_CHARS = 2_000_000;

function makeUniqueId(preferred: string, used: Set<string>, fallback: string): string {
  let base = preferred.trim() || fallback;
  if (!used.has(base)) { used.add(base); return base; }
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter++;
  base = `${base}-${counter}`;
  used.add(base);
  return base;
}

export function sanitizeNotepadStore(raw: unknown): NotepadStore {
  if (!raw || typeof raw !== 'object') return createDefaultNotepadStore();
  try {
    const candidate = raw as Partial<NotepadStore>;
    if (!Array.isArray(candidate.notes) || candidate.notes.length === 0) return createDefaultNotepadStore();
    const used = new Set<string>();
    const notes: NoteDoc[] = [];
    for (const value of candidate.notes.slice(0, MAX_NOTES)) {
      if (!value || typeof value !== 'object') continue;
      const note = value as Partial<NoteDoc>;
      const id = makeUniqueId(typeof note.id === 'string' ? note.id : '', used, `note-${notes.length + 1}`);
      notes.push({
        id,
        title: typeof note.title === 'string' && note.title.trim() ? note.title.trim().slice(0, 500) : 'Untitled Note',
        content: typeof note.content === 'string' ? note.content.slice(0, MAX_NOTE_CHARS) : '',
        updatedAt: typeof note.updatedAt === 'number' && Number.isFinite(note.updatedAt) ? note.updatedAt : Date.now(),
        isPinned: Boolean(note.isPinned),
      });
    }
    if (!notes.length) return createDefaultNotepadStore();
    const requested = typeof candidate.activeNoteId === 'string' ? candidate.activeNoteId : '';
    const activeNoteId = notes.find((note) => note.id === requested)?.id || notes[0].id;
    return { version: 1, activeNoteId, notes };
  } catch { return createDefaultNotepadStore(); }
}

export function getStoredNotes(): NotepadStore {
  if (typeof window === 'undefined' || !window.localStorage) return createDefaultNotepadStore();
  try {
    const raw = window.localStorage.getItem(NOTEPAD_STORAGE_KEY);
    return raw ? sanitizeNotepadStore(JSON.parse(raw)) : createDefaultNotepadStore();
  } catch { return createDefaultNotepadStore(); }
}

export function saveNotes(store: NotepadStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(sanitizeNotepadStore(store))); } catch { /* unavailable/quota */ }
}

export function calculateNoteStats(text: string): { words: number; chars: number; lines: number; readingSeconds: number } {
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  return { words, chars, lines, readingSeconds: words ? Math.max(1, Math.round((words / 220) * 60)) : 0 };
}

export function searchNotes(notes: NoteDoc[], query: string): NoteDoc[] {
  const needle = query.trim().toLocaleLowerCase();
  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  if (!needle) return sorted;
  return sorted.filter((note) => `${note.title}\n${note.content}`.toLocaleLowerCase().includes(needle));
}
