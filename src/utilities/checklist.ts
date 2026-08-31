/**
 * Checklist & Packing List Utility
 * Defensive local persistence, templates, progress calculation, and text export.
 */

export interface ChecklistItem { id: string; text: string; completed: boolean; }
export interface ChecklistDoc { id: string; title: string; updatedAt: number; items: ChecklistItem[]; }
export interface ChecklistStore { version: number; activeListId: string; lists: ChecklistDoc[]; }
export const CHECKLIST_STORAGE_KEY = 'tiny_tools_checklist_store_v1';

export const CHECKLIST_TEMPLATES: { id: string; name: string; items: string[] }[] = [
  { id: 'travel', name: 'Travel & Vacation Packing', items: ['Passport / ID & Boarding Pass','Phone, Laptop & Multi-port Charger','Power Bank / Portable Battery','Universal Plug Adapter','Travel Insurance documents','Prescription Medications & First Aid','Toothbrush, Toothpaste & Floss','Shampoo, Body Wash & Deodorant','Weather-appropriate Clothing & Jacket','Underwear & Socks (1 pair/day + extra)','Comfortable Walking Shoes','Sunglasses & Sunscreen','Earplugs & Sleep Mask','Headphones / Earbuds'] },
  { id: 'weekend', name: 'Weekend Trip', items: ['Change of clothes (2-3 days)','Toiletries kit','Phone charger','Water bottle','Snacks for journey','House keys & Wallet','Weather layer / Light jacket'] },
  { id: 'camping', name: 'Camping Essentials', items: ['Tent, Stakes & Rainfly','Sleeping Bag & Ground Pad','Flashlight / Headlamp + Extra Batteries','Camp Stove, Fuel & Lighter/Matches','Cookware, Utensils & Mug','Water Filter or Purification Tablets','Insect Repellent & Sunscreen','Trash Bags (Leave No Trace)','Multi-tool / Pocket Knife','Warm Fleece & Thermal Base Layers'] },
  { id: 'moving', name: 'Moving Checklist', items: ['Cardboard boxes & Heavy-duty packing tape','Bubble wrap & packing paper','Permanent markers for labeling rooms','Essentials box for first night (toilet paper, kettle, sheets)','Notify utility companies (Electricity, Gas, Internet)','Change address with Post Office & Bank','Take photos of meter readings','Deep clean old residence'] },
  { id: 'school', name: 'University / School Supplies', items: ['Laptop & Charger','Notebooks / Binder & Loose leaf paper','Pens, Pencils & Highlighters','Backpack / Bag','Student ID card','Scientific / Graphing Calculator','Planner / Calendar app synced','Reusable Water Bottle'] },
  { id: 'gym', name: 'Gym Bag', items: ['Workout shirt & shorts/leggings','Athletic sneakers & clean socks','Water bottle / shaker cup','Gym towel','Combination padlock for locker','Wireless earbuds','Post-workout snack / Protein bar'] },
  { id: 'grocery', name: 'Grocery Essentials', items: ['Fresh Fruit & Vegetables','Milk / Oat Milk','Eggs','Bread / Tortillas','Pasta / Rice / Grains','Olive oil & Cooking spices','Coffee / Tea','Dish soap & Paper towels'] },
  { id: 'daytrip', name: 'Day Trip', items: ['Small backpack','Water bottle (filled)','Snacks & Lunch','Portable phone charger','Sunscreen & Hat','Small hand sanitizer','Rain poncho / Compact umbrella'] },
];

function createDefaultChecklistStore(): ChecklistStore {
  const now = Date.now();
  return {
    version: 1,
    activeListId: 'default-travel',
    lists: [{
      id: 'default-travel', title: 'Travel & Packing List', updatedAt: now,
      items: CHECKLIST_TEMPLATES[0].items.map((text, index) => ({ id: `item-${index + 1}`, text, completed: index < 3 })),
    }],
  };
}

export const defaultChecklistStore: ChecklistStore = createDefaultChecklistStore();
const MAX_LISTS = 200;
const MAX_ITEMS_PER_LIST = 5000;
const MAX_TEXT_LENGTH = 10_000;

function uniqueId(preferred: string, used: Set<string>, prefix: string): string {
  let id = preferred.trim() || prefix;
  if (!used.has(id)) { used.add(id); return id; }
  let counter = 2;
  while (used.has(`${id}-${counter}`)) counter++;
  id = `${id}-${counter}`;
  used.add(id);
  return id;
}

export function sanitizeChecklistStore(raw: unknown): ChecklistStore {
  if (!raw || typeof raw !== 'object') return createDefaultChecklistStore();
  try {
    const candidate = raw as Partial<ChecklistStore>;
    if (!Array.isArray(candidate.lists) || candidate.lists.length === 0) return createDefaultChecklistStore();
    const usedListIds = new Set<string>();
    const sanitizedLists: ChecklistDoc[] = [];

    for (const value of candidate.lists.slice(0, MAX_LISTS)) {
      if (!value || typeof value !== 'object') continue;
      const list = value as Partial<ChecklistDoc>;
      const id = uniqueId(typeof list.id === 'string' ? list.id : '', usedListIds, `list-${sanitizedLists.length + 1}`);
      const usedItemIds = new Set<string>();
      const items: ChecklistItem[] = [];
      for (const rawItem of (Array.isArray(list.items) ? list.items : []).slice(0, MAX_ITEMS_PER_LIST)) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const item = rawItem as Partial<ChecklistItem>;
        const text = typeof item.text === 'string' ? item.text.slice(0, MAX_TEXT_LENGTH) : '';
        const itemId = uniqueId(typeof item.id === 'string' ? item.id : '', usedItemIds, `item-${items.length + 1}`);
        items.push({ id: itemId, text, completed: Boolean(item.completed) });
      }
      sanitizedLists.push({
        id,
        title: typeof list.title === 'string' && list.title.trim() ? list.title.trim().slice(0, 500) : 'Untitled List',
        updatedAt: typeof list.updatedAt === 'number' && Number.isFinite(list.updatedAt) ? list.updatedAt : Date.now(),
        items,
      });
    }
    if (!sanitizedLists.length) return createDefaultChecklistStore();
    const requestedActive = typeof candidate.activeListId === 'string' ? candidate.activeListId : '';
    const activeListId = sanitizedLists.find((list) => list.id === requestedActive)?.id || sanitizedLists[0].id;
    return { version: 1, activeListId, lists: sanitizedLists };
  } catch {
    return createDefaultChecklistStore();
  }
}

export function getStoredChecklists(): ChecklistStore {
  if (typeof window === 'undefined' || !window.localStorage) return createDefaultChecklistStore();
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    return raw ? sanitizeChecklistStore(JSON.parse(raw)) : createDefaultChecklistStore();
  } catch { return createDefaultChecklistStore(); }
}

export function saveChecklists(store: ChecklistStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(sanitizeChecklistStore(store))); } catch { /* storage may be unavailable/full */ }
}

export function calculateChecklistStats(items: ChecklistItem[]): { total: number; completed: number; remaining: number; percent: number } {
  const total = items.length;
  if (!total) return { total: 0, completed: 0, remaining: 0, percent: 0 };
  const completed = items.reduce((count, item) => count + (item.completed ? 1 : 0), 0);
  return { total, completed, remaining: total - completed, percent: Math.round((completed / total) * 100) };
}

export function formatChecklistToText(list: ChecklistDoc): string {
  return [`# ${list.title}`, '', ...list.items.map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.text}`)].join('\n');
}

export function filterChecklistItems(items: ChecklistItem[], query: string): ChecklistItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return items;
  return items.filter((item) => item.text.toLocaleLowerCase().includes(needle));
}
