// Cache for Scryfall set metadata (card_count) for completion percentage calculations
// Uses localStorage with 7-day TTL to avoid excessive API calls

import { scryfallJson } from "./scryfall";

type SetMeta = {
  card_count: number;
  name: string;
  fetchedAt: number;
};

const CACHE_KEY = "scryfall_set_meta";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCache(): Record<string, SetMeta> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, SetMeta>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

export async function getSetMeta(setCode: string): Promise<SetMeta | null> {
  const cache = getCache();
  const cached = cache[setCode];

  // Return cached if still valid
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  // Fetch from Scryfall
  try {
    const data = await scryfallJson(`/sets/${setCode}`);
    if (data.object === "set") {
      const meta: SetMeta = {
        card_count: data.card_count,
        name: data.name,
        fetchedAt: Date.now(),
      };
      cache[setCode] = meta;
      setCache(cache);
      return meta;
    }
  } catch {
    // API error, return cached even if stale
    if (cached) return cached;
  }

  return null;
}

// Batch fetch multiple sets (for statistics page)
export async function getSetMetaBatch(setCodes: string[]): Promise<Record<string, SetMeta>> {
  const cache = getCache();
  const result: Record<string, SetMeta> = {};
  const toFetch: string[] = [];

  // Check cache first
  for (const code of setCodes) {
    const cached = cache[code];
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      result[code] = cached;
    } else {
      toFetch.push(code);
    }
  }

  // Fetch missing ones (with rate limiting)
  for (const code of toFetch) {
    const meta = await getSetMeta(code);
    if (meta) {
      result[code] = meta;
    }
  }

  return result;
}
