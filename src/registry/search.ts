import type { ToolCategory, ToolDefinition } from '../types';
import { TOOLS_REGISTRY } from './tools';
import { getCategoryPresentation } from './category-presentation';

const SEARCH_STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'to', 'tool', 'tools', 'make', 'create', 'do']);

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTool(tool: ToolDefinition, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const category = getCategoryPresentation(tool.category);
  const id = normalizeSearchText(tool.id);
  const name = normalizeSearchText(tool.name);
  const shortName = normalizeSearchText(tool.shortName);
  const description = normalizeSearchText(tool.description);
  const keywords = tool.keywords.map(normalizeSearchText);
  const categoryLabel = normalizeSearchText(category.label);
  const categoryTerms = category.searchTerms.map(normalizeSearchText);

  const searchableText = [
    id,
    name,
    shortName,
    description,
    categoryLabel,
    ...keywords,
    ...categoryTerms,
  ].join(' ');

  const tokens = normalizedQuery
    .split(' ')
    .filter((token) => token && !SEARCH_STOP_WORDS.has(token));
  if (tokens.length === 0 || !tokens.every((token) => searchableText.includes(token))) {
    return null;
  }

  let score = 0;

  if (name === normalizedQuery) score += 1200;
  if (shortName === normalizedQuery) score += 1150;
  if (id === normalizedQuery) score += 1100;
  if (keywords.includes(normalizedQuery)) score += 950;

  if (name.startsWith(normalizedQuery)) score += 800;
  if (shortName.startsWith(normalizedQuery)) score += 760;
  if (id.startsWith(normalizedQuery)) score += 700;

  if (name.includes(normalizedQuery)) score += 620;
  if (shortName.includes(normalizedQuery)) score += 580;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) score += 500;
  if (categoryLabel.includes(normalizedQuery) || categoryTerms.some((term) => term.includes(normalizedQuery))) {
    score += 300;
  }
  if (description.includes(normalizedQuery)) score += 180;

  // A task phrased in the user's own word order should still favor the tool
  // whose identity contains all intent tokens. For example, "scan document"
  // should rank Document Scanner above OCR even if OCR lists that phrase as a
  // secondary keyword. Substring matching intentionally handles inflections
  // such as scan/scanner and remove/remover.
  const primaryIdentity = `${id} ${name} ${shortName}`;
  if (tokens.every((token) => primaryIdentity.includes(token))) {
    score += 900;
  }

  const nameWords = new Set(name.split(' '));
  const shortNameWords = new Set(shortName.split(' '));

  for (const token of tokens) {
    if (nameWords.has(token)) score += 90;
    else if (name.includes(token)) score += 60;

    if (shortNameWords.has(token)) score += 75;
    else if (shortName.includes(token)) score += 45;

    if (keywords.some((keyword) => keyword === token)) score += 70;
    else if (keywords.some((keyword) => keyword.includes(token))) score += 40;

    if (categoryTerms.some((term) => term === token)) score += 35;
    if (description.includes(token)) score += 20;
  }

  if (tool.featured) score += 5;

  return score;
}

export function searchTools(
  query: string,
  category: ToolCategory | 'all' = 'all'
): ToolDefinition[] {
  const candidates = TOOLS_REGISTRY.filter(
    (tool) => category === 'all' || tool.category === category
  );

  const cleanQuery = query.trim();
  if (!cleanQuery) return candidates;

  return candidates
    .map((tool, index) => ({
      tool,
      index,
      score: scoreTool(tool, cleanQuery),
    }))
    .filter(
      (entry): entry is { tool: ToolDefinition; index: number; score: number } =>
        entry.score !== null
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.tool);
}
