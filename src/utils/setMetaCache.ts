// Cache for Scryfall set metadata (card_count) for completion percentage calculations
// Uses localStorage with 7-day TTL to avoid excessive API calls

import { scryfallJson } from "./scryfall";

type SetMeta = {
  card_count: number;
  name: string;
  fetchedAt: number;
};

const CACHE_KEY = "scryfall_set_meta";
const ALL_SETS_CACHE_KEY = "scryfall_all_sets";
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

// Fetch all sets in one request and cache them
async function fetchAllSets(): Promise<Record<string, SetMeta>> {
  // Check if we have a recent all-sets fetch
  try {
    const cached = localStorage.getItem(ALL_SETS_CACHE_KEY);
    if (cached) {
      const { fetchedAt, data } = JSON.parse(cached);
      if (Date.now() - fetchedAt < TTL_MS) {
        return data;
      }
    }
  } catch {
    // Cache read failed, continue to fetch
  }

  // Fetch all sets from Scryfall (single request)
  const response = await scryfallJson("/sets");
  if (response.object !== "list" || !Array.isArray(response.data)) {
    return {};
  }

  const result: Record<string, SetMeta> = {};
  const now = Date.now();

  for (const set of response.data) {
    result[set.code] = {
      card_count: set.card_count,
      name: set.name,
      fetchedAt: now,
    };
  }

  // Cache the result
  try {
    localStorage.setItem(ALL_SETS_CACHE_KEY, JSON.stringify({
      fetchedAt: now,
      data: result,
    }));
  } catch {
    // localStorage full or unavailable
  }

  // Also update individual cache for backwards compatibility
  setCache({ ...getCache(), ...result });

  return result;
}

export async function getSetMeta(setCode: string): Promise<SetMeta | null> {
  const cache = getCache();
  const cached = cache[setCode];

  // Return cached if still valid
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  // Try fetching all sets (usually from cache)
  const allSets = await fetchAllSets();
  if (allSets[setCode]) {
    return allSets[setCode];
  }

  // Fallback: fetch individual set
  try {
    const data = await scryfallJson(`/sets/${setCode}`);
    if (data.object === "set") {
      const meta: SetMeta = {
        card_count: data.card_count,
        name: data.name,
        fetchedAt: Date.now(),
      };
      const newCache = getCache();
      newCache[setCode] = meta;
      setCache(newCache);
      return meta;
    }
  } catch {
    // API error, return cached even if stale
    if (cached) return cached;
  }

  return null;
}

// Batch fetch multiple sets (for statistics page)
// Now uses single /sets request instead of one request per set
export async function getSetMetaBatch(setCodes: string[]): Promise<Record<string, SetMeta>> {
  const allSets = await fetchAllSets();

  const result: Record<string, SetMeta> = {};
  for (const code of setCodes) {
    if (allSets[code]) {
      result[code] = allSets[code];
    }
  }

  return result;
}
