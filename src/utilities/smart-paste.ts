import { parseColor } from './color-converter';
import type { SmartPasteSuggestion } from '../types';

export function detectSmartPaste(input: string): SmartPasteSuggestion[] {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const suggestions: SmartPasteSuggestion[] = [];

  // 1. JSON Detection
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      suggestions.push({
        toolId: 'json-formatter',
        toolName: 'JSON Formatter',
        actionTitle: 'Format & Validate JSON',
        description: 'Prettify, validate, or minify structured JSON data',
        initialValue: trimmed,
      });
    } catch {
      // If it looks like JSON but has syntax error, still offer JSON tool to fix it
      suggestions.push({
        toolId: 'json-formatter',
        toolName: 'JSON Formatter',
        actionTitle: 'Inspect & Fix JSON Syntax',
        description: 'Detect errors, line numbers, and invalid JSON tokens',
        initialValue: trimmed,
      });
    }
  }

  // 2. Color Detection
  const parsedColor = parseColor(trimmed);
  if (parsedColor && (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl') || /^[0-9a-f]{6}$/i.test(trimmed))) {
    suggestions.push({
      toolId: 'color-converter',
      toolName: 'Color Converter',
      actionTitle: 'Convert Color & Check Contrast',
      description: 'Switch between HEX, RGB, HSL and test WCAG contrast',
      initialValue: trimmed,
    });
  }

  // 3. URL or Query String Detection
  const isQueryString = /^([^&=?#\s]+=[^&=?#\s]*)(&[^&=?#\s]+=[^&=?#\s]*)+$/.test(trimmed);
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/|\?)/i.test(trimmed) ||
    (trimmed.includes('?') && trimmed.includes('=')) ||
    isQueryString ||
    (trimmed.includes('%20') || trimmed.includes('%3A'))
  ) {
    suggestions.push({
      toolId: 'encoding-tools',
      toolName: 'URL & Base64 Tools',
      actionTitle: 'Parse URL & Query Parameters',
      description: 'Inspect URL components, decode parameters, or edit values',
      initialValue: trimmed,
    });
  }

  // 4. Numeric Dimensions Detection (e.g. 1920x1080, 1920 × 1080, 1920:1080, 1920*1080)
  const dimMatch = trimmed.match(/^(\d{2,5})\s*(?:x|×|\*|:|\/)\s*(\d{2,5})$/i);
  if (dimMatch) {
    suggestions.push({
      toolId: 'aspect-ratio-calculator',
      toolName: 'Aspect Ratio Calculator',
      actionTitle: `Simplify Ratio for ${dimMatch[1]} × ${dimMatch[2]}`,
      description: 'Find reduced aspect ratio and scale resolutions',
      initialValue: trimmed,
    });
  }

  // 5. Multiline text detection
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length > 2) {
      if (suggestions.length < 3) {
        suggestions.push({
          toolId: 'text-cleaner',
          toolName: 'Text Cleaner',
          actionTitle: `Clean Multiline Text (${lines.length} lines)`,
          description: 'Remove empty lines, trailing spaces, and normalize quotes',
          initialValue: trimmed,
        });
      }
      if (suggestions.length < 3) {
        suggestions.push({
          toolId: 'list-processor',
          toolName: 'List Processor',
          actionTitle: `Process List (${lines.length} items)`,
          description: 'Sort, deduplicate, prefix, or number list items',
          initialValue: trimmed,
        });
      }
    }
  }

  return suggestions.slice(0, 3);
}

export const detectSmartPasteSuggestions = detectSmartPaste;

