import type { ToolDefinition } from '../types';

export const DEFAULT_DOCUMENT_TITLE = 'Tiny Tools — Small tools. Zero friction.';
export const DEFAULT_DOCUMENT_DESCRIPTION =
  '50 privacy-first browser utilities for text, images, files, media, time, and everyday tasks.';

export function getDocumentMetadata(
  tool?: Pick<ToolDefinition, 'name' | 'description'>
): { title: string; description: string } {
  if (!tool) {
    return {
      title: DEFAULT_DOCUMENT_TITLE,
      description: DEFAULT_DOCUMENT_DESCRIPTION,
    };
  }

  return {
    title: `${tool.name} — Tiny Tools`,
    description: tool.description,
  };
}

interface ShortcutTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

export function isTextEntryTarget(target: ShortcutTargetLike | null | undefined): boolean {
  if (!target) return false;

  const tagName = target.tagName?.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (target.isContentEditable) return true;

  const role = target.getAttribute?.('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox';
}

export function getWrappedIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return ((current + delta) % length + length) % length;
}
