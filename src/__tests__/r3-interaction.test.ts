import { describe, expect, it } from 'vitest';
import { getToolById } from '../registry/tools';
import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  DEFAULT_DOCUMENT_TITLE,
  getDocumentMetadata,
  getWrappedIndex,
  isTextEntryTarget,
} from '../utilities/navigation';

describe('R3 document metadata', () => {
  it('returns stable dashboard metadata', () => {
    expect(getDocumentMetadata()).toEqual({
      title: DEFAULT_DOCUMENT_TITLE,
      description: DEFAULT_DOCUMENT_DESCRIPTION,
    });
  });

  it('uses the active tool name and description for tool routes', () => {
    const tool = getToolById('image-optimizer');
    expect(tool).toBeDefined();

    expect(getDocumentMetadata(tool)).toEqual({
      title: `${tool?.name} — Tiny Tools`,
      description: tool?.description,
    });
  });
});

describe('R3 global shortcut targeting', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('treats %s as a text-entry target', (tagName) => {
    expect(isTextEntryTarget({ tagName })).toBe(true);
  });

  it('treats contenteditable surfaces as text-entry targets', () => {
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it.each(['textbox', 'combobox', 'searchbox'])(
    'treats role=%s as a text-entry target',
    (role) => {
      expect(
        isTextEntryTarget({
          tagName: 'DIV',
          getAttribute: (name) => (name === 'role' ? role : null),
        })
      ).toBe(true);
    }
  );

  it('does not suppress slash shortcuts on ordinary buttons', () => {
    expect(isTextEntryTarget({ tagName: 'BUTTON' })).toBe(false);
  });

  it('handles a missing event target safely', () => {
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe('R3 wrapped keyboard navigation', () => {
  it('moves forward through a result list', () => {
    expect(getWrappedIndex(2, 1, 5)).toBe(3);
  });

  it('wraps forward from the last item to the first', () => {
    expect(getWrappedIndex(4, 1, 5)).toBe(0);
  });

  it('wraps backward from the first item to the last', () => {
    expect(getWrappedIndex(0, -1, 5)).toBe(4);
  });

  it('returns zero for an empty result list', () => {
    expect(getWrappedIndex(8, 1, 0)).toBe(0);
  });
});
