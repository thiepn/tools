/**
 * Random Picker & Team Generator Utility
 * 100% Cryptographically secure randomness via Web Crypto (crypto.getRandomValues)
 */

export type RandomPickerMode = 'pick-one' | 'pick-n' | 'wheel' | 'shuffle' | 'teams' | 'pairs' | 'secret-santa';

export interface RandomPreset {
  id: string;
  name: string;
  items: string[];
}

export const SAMPLE_RANDOM_PRESETS: RandomPreset[] = [
  {
    id: 'lunch',
    name: 'Lunch Options',
    items: ['Sushi', 'Tacos', 'Thai Curry', 'Italian Pasta', 'Salad & Grain Bowl', 'Burgers', 'Ramen', 'Mediterranean', 'Pho'],
  },
  {
    id: 'icebreaker',
    name: 'Icebreaker Team List',
    items: ['Alex M.', 'Taylor S.', 'Jordan K.', 'Morgan B.', 'Casey L.', 'Sam P.', 'Riley N.', 'Chris D.', 'Jamie W.', 'Avery H.'],
  },
  {
    id: 'decisions',
    name: 'Coin & Dice Options',
    items: ['Option A', 'Option B', 'Option C', 'Option D'],
  },
  {
    id: 'board-games',
    name: 'Board Game Night',
    items: ['Catan', 'Ticket to Ride', 'Codenames', 'Wingspan', 'Azul', 'Pandemic', 'Splendor', '7 Wonders'],
  },
];

/**
 * Returns a cryptographically secure random integer in [0, maxExclusive)
 */
export function getCryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;

  const maxValid = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : window.crypto;

  while (true) {
    cryptoObj.getRandomValues(buffer);
    const val = buffer[0];
    if (val < maxValid) {
      return val % maxExclusive;
    }
  }
}

/**
 * Cryptographically secure Fisher-Yates shuffle
 */
export function shuffleArraySecure<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getCryptoRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function cryptoShuffle<T>(array: T[]): T[] {
  return shuffleArraySecure(array);
}

/**
 * Pick 1 random item
 */
export function pickRandomOne(items: string[]): { winner: string; remaining: string[] } | null {
  if (!items || items.length === 0) return null;
  const idx = getCryptoRandomInt(items.length);
  const winner = items[idx];
  const remaining = items.filter((_, i) => i !== idx);
  return { winner, remaining };
}

/**
 * Pick N random winners
 */
export function pickRandomItems(
  items: string[],
  count: number,
  allowDuplicates = false
): string[] {
  if (!items || items.length === 0 || count <= 0) return [];

  if (allowDuplicates) {
    const picked: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = getCryptoRandomInt(items.length);
      picked.push(items[idx]);
    }
    return picked;
  }

  const shuffled = shuffleArraySecure(items);
  return shuffled.slice(0, Math.min(count, items.length));
}

export const pickRandomN = pickRandomItems;

/**
 * Splits items into N balanced teams
 */
export function splitIntoTeams(
  items: string[],
  teamSpec: number,
  mode: 'by-count' | 'by-size' = 'by-count'
): { name: string; members: string[] }[] {
  if (!items || items.length === 0 || teamSpec <= 0) return [];

  const shuffled = shuffleArraySecure(items);
  const total = items.length;

  let numTeams: number;
  if (mode === 'by-size') {
    const targetSize = Math.max(1, teamSpec);
    numTeams = Math.max(1, Math.round(total / targetSize));
  } else {
    numTeams = Math.min(teamSpec, total);
  }

  numTeams = Math.max(1, numTeams);

  const teams: { name: string; members: string[] }[] = Array.from({ length: numTeams }, (_, i) => ({
    name: `Team ${i + 1}`,
    members: [],
  }));

  shuffled.forEach((item, index) => {
    teams[index % numTeams].members.push(item);
  });

  return teams;
}

export const generateTeams = splitIntoTeams;

export interface PairResult {
  groupName: string;
  members: string[];
  isOddTrio?: boolean;
}

/**
 * Generates random 2-person pairs with clean odd-person handling
 */
export function generateRandomPairs(
  items: string[],
  oddHandling: 'trio' | 'bystander' = 'trio'
): { pairs: PairResult[]; bystander?: string } {
  if (!items || items.length < 2) {
    if (items.length === 1) {
      return { pairs: [{ groupName: 'Pair 1', members: [items[0]] }] };
    }
    return { pairs: [] };
  }

  const shuffled = shuffleArraySecure(items);
  const pairs: PairResult[] = [];
  let bystander: string | undefined;

  if (shuffled.length % 2 !== 0 && oddHandling === 'bystander') {
    bystander = shuffled.pop();
  }

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairs.push({
        groupName: `Pair ${Math.floor(i / 2) + 1}`,
        members: [shuffled[i], shuffled[i + 1]],
      });
    } else {
      // Last odd person in trio mode: add to the last pair
      if (pairs.length > 0) {
        const lastPair = pairs[pairs.length - 1];
        lastPair.members.push(shuffled[i]);
        lastPair.groupName = `${lastPair.groupName} (Trio)`;
        lastPair.isOddTrio = true;
      } else {
        pairs.push({
          groupName: 'Single',
          members: [shuffled[i]],
        });
      }
    }
  }

  return { pairs, bystander };
}

/**
 * Generates Secret Santa / Gift Exchange circular derangement ({ giver, receiver })
 */
export function generateSecretSanta(
  items: string[]
): { giver: string; receiver: string }[] {
  if (!items || items.length < 2) return [];

  const shuffled = shuffleArraySecure(items);
  return shuffled.map((giver, idx) => ({
    giver,
    receiver: shuffled[(idx + 1) % shuffled.length],
  }));
}

/**
 * Backward-compatible generatePairs alias for Secret Santa
 */
export function generatePairs(
  items: string[],
  allowSelfPair = false
): { giver: string; receiver: string }[] {
  if (!items || items.length < 2) {
    if (items.length === 1 && allowSelfPair) {
      return [{ giver: items[0], receiver: items[0] }];
    }
    return [];
  }

  const givers = [...items];

  if (allowSelfPair) {
    const receivers = shuffleArraySecure(givers);
    return givers.map((giver, idx) => ({ giver, receiver: receivers[idx] }));
  }

  // True cycle derangement
  const shuffled = shuffleArraySecure(givers);
  return shuffled.map((giver, idx) => ({
    giver,
    receiver: shuffled[(idx + 1) % shuffled.length],
  }));
}

/**
 * Parses multiline string into trimmed items
 */
export function parseItemsList(raw: string, deduplicate = false): string[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (deduplicate) {
    return Array.from(new Set(lines));
  }
  return lines;
}

export const parseInputList = parseItemsList;
