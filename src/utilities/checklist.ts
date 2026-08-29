/**
 * Checklist & Packing List Utility
 * LocalStorage-persisted checklists, templates, progress calculation, and plain text export
 */

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistDoc {
  id: string;
  title: string;
  updatedAt: number;
  items: ChecklistItem[];
}

export interface ChecklistStore {
  version: number;
  activeListId: string;
  lists: ChecklistDoc[];
}

export const CHECKLIST_STORAGE_KEY = 'tiny_tools_checklist_store_v1';

export const CHECKLIST_TEMPLATES: { id: string; name: string; items: string[] }[] = [
  {
    id: 'travel',
    name: 'Travel & Vacation Packing',
    items: [
      'Passport / ID & Boarding Pass',
      'Phone, Laptop & Multi-port Charger',
      'Power Bank / Portable Battery',
      'Universal Plug Adapter',
      'Travel Insurance documents',
      'Prescription Medications & First Aid',
      'Toothbrush, Toothpaste & Floss',
      'Shampoo, Body Wash & Deodorant',
      'Weather-appropriate Clothing & Jacket',
      'Underwear & Socks (1 pair/day + extra)',
      'Comfortable Walking Shoes',
      'Sunglasses & Sunscreen',
      'Earplugs & Sleep Mask',
      'Headphones / Earbuds',
    ],
  },
  {
    id: 'weekend',
    name: 'Weekend Trip',
    items: [
      'Change of clothes (2-3 days)',
      'Toiletries kit',
      'Phone charger',
      'Water bottle',
      'Snacks for journey',
      'House keys & Wallet',
      'Weather layer / Light jacket',
    ],
  },
  {
    id: 'camping',
    name: 'Camping Essentials',
    items: [
      'Tent, Stakes & Rainfly',
      'Sleeping Bag & Ground Pad',
      'Flashlight / Headlamp + Extra Batteries',
      'Camp Stove, Fuel & Lighter/Matches',
      'Cookware, Utensils & Mug',
      'Water Filter or Purification Tablets',
      'Insect Repellent & Sunscreen',
      'Trash Bags (Leave No Trace)',
      'Multi-tool / Pocket Knife',
      'Warm Fleece & Thermal Base Layers',
    ],
  },
  {
    id: 'moving',
    name: 'Moving Checklist',
    items: [
      'Cardboard boxes & Heavy-duty packing tape',
      'Bubble wrap & packing paper',
      'Permanent markers for labeling rooms',
      'Essentials box for first night (toilet paper, kettle, sheets)',
      'Notify utility companies (Electricity, Gas, Internet)',
      'Change address with Post Office & Bank',
      'Take photos of meter readings',
      'Deep clean old residence',
    ],
  },
  {
    id: 'school',
    name: 'University / School Supplies',
    items: [
      'Laptop & Charger',
      'Notebooks / Binder & Loose leaf paper',
      'Pens, Pencils & Highlighters',
      'Backpack / Bag',
      'Student ID card',
      'Scientific / Graphing Calculator',
      'Planner / Calendar app synced',
      'Reusable Water Bottle',
    ],
  },
  {
    id: 'gym',
    name: 'Gym Bag',
    items: [
      'Workout shirt & shorts/leggings',
      'Athletic sneakers & clean socks',
      'Water bottle / shaker cup',
      'Gym towel',
      'Combination padlock for locker',
      'Wireless earbuds',
      'Post-workout snack / Protein bar',
    ],
  },
  {
    id: 'grocery',
    name: 'Grocery Essentials',
    items: [
      'Fresh Fruit & Vegetables',
      'Milk / Oat Milk',
      'Eggs',
      'Bread / Tortillas',
      'Pasta / Rice / Grains',
      'Olive oil & Cooking spices',
      'Coffee / Tea',
      'Dish soap & Paper towels',
    ],
  },
  {
    id: 'daytrip',
    name: 'Day Trip',
    items: [
      'Small backpack',
      'Water bottle (filled)',
      'Snacks & Lunch',
      'Portable phone charger',
      'Sunscreen & Hat',
      'Small hand sanitizer',
      'Rain poncho / Compact umbrella',
    ],
  },
];

export const defaultChecklistStore: ChecklistStore = {
  version: 1,
  activeListId: 'default-travel',
  lists: [
    {
      id: 'default-travel',
      title: 'Travel & Packing List',
      updatedAt: Date.now(),
      items: CHECKLIST_TEMPLATES[0].items.map((text, idx) => ({
        id: `item-${idx + 1}`,
        text,
        completed: idx < 3,
      })),
    },
  ],
};

/**
 * Defensively parses and sanitizes a raw string or object into a ChecklistStore
 */
export function sanitizeChecklistStore(raw: unknown): ChecklistStore {
  if (!raw || typeof raw !== 'object') return defaultChecklistStore;

  try {
    const candidate = raw as Partial<ChecklistStore>;
    if (!Array.isArray(candidate.lists) || candidate.lists.length === 0) {
      return defaultChecklistStore;
    }

    const sanitizedLists: ChecklistDoc[] = candidate.lists
      .filter((l): l is ChecklistDoc => Boolean(l && typeof l === 'object' && typeof l.id === 'string'))
      .map((l) => ({
        id: l.id,
        title: typeof l.title === 'string' && l.title.trim() ? l.title.trim() : 'Untitled List',
        updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : Date.now(),
        items: Array.isArray(l.items)
          ? l.items
              .filter((it): it is ChecklistItem => Boolean(it && typeof it === 'object' && typeof it.id === 'string'))
              .map((it) => ({
                id: it.id,
                text: typeof it.text === 'string' ? it.text : '',
                completed: Boolean(it.completed),
              }))
          : [],
      }));

    if (sanitizedLists.length === 0) return defaultChecklistStore;

    const activeListId =
      typeof candidate.activeListId === 'string' &&
      sanitizedLists.some((l) => l.id === candidate.activeListId)
        ? candidate.activeListId
        : sanitizedLists[0].id;

    return {
      version: 1,
      activeListId,
      lists: sanitizedLists,
    };
  } catch {
    return defaultChecklistStore;
  }
}

/**
 * Retrieves persisted checklists from localStorage safely
 */
export function getStoredChecklists(): ChecklistStore {
  if (typeof window === 'undefined' || !window.localStorage) return defaultChecklistStore;
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return defaultChecklistStore;
    const parsed = JSON.parse(raw);
    return sanitizeChecklistStore(parsed);
  } catch {
    return defaultChecklistStore;
  }
}

/**
 * Saves checklists to localStorage
 */
export function saveChecklists(store: ChecklistStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Calculates checklist completion stats
 */
export function calculateChecklistStats(items: ChecklistItem[]): {
  total: number;
  completed: number;
  remaining: number;
  percent: number;
} {
  const total = items.length;
  if (total === 0) return { total: 0, completed: 0, remaining: 0, percent: 0 };
  const completed = items.filter((i) => i.completed).length;
  const remaining = total - completed;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, remaining, percent };
}

/**
 * Formats checklist into readable markdown/plain text
 */
export function formatChecklistToText(list: ChecklistDoc): string {
  const lines: string[] = [`# ${list.title}`, ''];
  list.items.forEach((item) => {
    const box = item.completed ? '[x]' : '[ ]';
    lines.push(`${box} ${item.text}`);
  });
  return lines.join('\n');
}
