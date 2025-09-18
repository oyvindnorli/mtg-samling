import type { ScryfallCard } from "../types";

/* ---------- Eksisterende helpers ---------- */
export function getCardImage(card: ScryfallCard): string | undefined {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces && card.card_faces[0]?.image_uris?.normal)
    return card.card_faces[0].image_uris!.normal;
}
export function makeOwnedKey(card: ScryfallCard, finish: string) {
  return `${card.id}::${finish}`;
}
export function parseCN(cn: string) {
  const m = cn.match(/^(\d+)([A-Za-z]*)/);
  if (!m) return { n: Number.MAX_SAFE_INTEGER, s: cn };
  return { n: parseInt(m[1], 10), s: m[2] || "" };
}
export function compareCollector(a: ScryfallCard, b: ScryfallCard) {
  const A = parseCN(a.collector_number);
  const B = parseCN(b.collector_number);
  if (A.n !== B.n) return A.n - B.n;
  return A.s.localeCompare(B.s);
}
export function dedupeById(arr: ScryfallCard[]) {
  const m = new Map<string, ScryfallCard>();
  for (const c of arr) m.set(c.id, c);
  return Array.from(m.values());
}

/* ---------- Base-URL / proxy ---------- */
export const SCRYFALL_BASE = "https://api.scryfall.com";

/* ---------- Rate-limit + backoff + cache ---------- */
const MIN_DELAY_MS = 1000;          // 1 kall/sek for å unngå rate limiting
let chain: Promise<any> = Promise.resolve();
let lastTick = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  chain = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastTick + MIN_DELAY_MS - now);
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastTick = Date.now();
    return task();
  });
  return chain;
}

// Enkel JSON-cache for GET (2 min)
const JSON_TTL = 120_000;
const jsonCache = new Map<string, { t: number; data: any }>();

/**
 * Primærkall (direkte eller via Vite-proxy). Retries ved 429 med Retry-After/exponential backoff.
 * Har nødfallback-proxyer kun for nett/CORS-feil (ikke mot 429).
 */
export async function scryfallFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const apiUrl = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://api.scryfall.com${pathOrUrl}`;

  return schedule(async () => {
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < 3) {
      attempt++;
      try {
        // Prøv corsproxy.io først
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
        const res = await fetch(proxyUrl, init);
        
        if (res.status === 429) {
          const hdr = Number(res.headers.get("retry-after"));
          const base = Number.isFinite(hdr) ? hdr * 1000 : 1200 * attempt;
          await new Promise((r) => setTimeout(r, base));
          continue;
        }
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
        
      } catch (e) {
        lastErr = e;
        if (attempt >= 3) {
          // Fallback til andre proxyer
          try {
            const r2 = await fetch(`https://thingproxy.freeboard.io/fetch/${apiUrl}`, init);
            if (r2.ok) return r2;
          } catch {}
          try {
            const r3 = await fetch(`https://proxy.cors.sh/${apiUrl}`, init);
            if (r3.ok) return r3;
          } catch {}
        }
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr ?? new Error("Scryfall: ukjent feil");
  });
}


/** Robust fetch til Scryfall via Vite proxy */
export async function scryfallJson(url: string) {
  // Bygg riktig API URL
  let apiPath = url;
  if (url.startsWith("https://api.scryfall.com")) {
    apiPath = url.replace("https://api.scryfall.com", "");
  }
  if (!apiPath.startsWith("/")) {
    apiPath = "/" + apiPath;
  }

  return schedule(async () => {
    // Check if we're in development (has Vite proxy) or production
    const isDevelopment = window.location.hostname === 'localhost';
    
    if (isDevelopment) {
      try {
        // Prøv først Vite proxy i development
        const proxyUrl = `/scryfall${apiPath}`;
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });
      
      if (response.status === 429) {
        const hdr = Number(response.headers.get("retry-after"));
        const base = Number.isFinite(hdr) ? hdr * 1000 : 2000;
        await new Promise((r) => setTimeout(r, base));
        // Prøv igjen
        const retryResponse = await fetch(proxyUrl);
        if (!retryResponse.ok) {
          throw new Error(`Scryfall API error: ${retryResponse.status}`);
        }
        return await retryResponse.json();
      }
      
      if (!response.ok) {
        // For 404, sjekk om Scryfall returnerer en "not_found" som betyr tomt søk
        if (response.status === 404) {
          try {
            const errorData = await response.json();
            
            // Hvis dette er en normal "not_found" (ingen kort funnet), returner tomt resultat
            if (errorData.object === 'error' && errorData.code === 'not_found') {
              return {
                object: 'list',
                total_cards: 0,
                has_more: false,
                data: []
              };
            }
            
            // Annen type 404-feil
            throw new Error(errorData.details || `Scryfall API error: ${response.status}`);
          } catch (jsonError) {
            throw new Error(`Scryfall API error: ${response.status}`);
          }
        }
        throw new Error(`Scryfall API error: ${response.status}`);
      }
      
      return await response.json();
      
      } catch (error) {
        console.error('Vite proxy feilet i development:', error);
        // Fall through to production method
      }
    }
    
    // Production: Use external proxies directly
    try {
      console.log('Using production API method for:', apiPath);
      
      // Fallback til externe proxyer hvis Vite proxy feiler
      const apiUrl = `https://api.scryfall.com${apiPath}`;
      
      try {
        // Prøv corsproxy.io først
        const proxyUrl1 = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
        const res1 = await fetch(proxyUrl1);
        
        if (res1.status === 429) {
          const hdr = Number(res1.headers.get("retry-after"));
          const base = Number.isFinite(hdr) ? hdr * 1000 : 1200;
          await new Promise((r) => setTimeout(r, base));
          const retryRes = await fetch(proxyUrl1);
          if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
          return await retryRes.json();
        }
        
        if (!res1.ok) throw new Error(`HTTP ${res1.status}`);
        return await res1.json();
        
      } catch (e1) {
        console.error('corsproxy.io feilet, prøver thingproxy:', e1);
        
        try {
          const proxyUrl2 = `https://thingproxy.freeboard.io/fetch/${apiUrl}`;
          const res2 = await fetch(proxyUrl2);
          if (res2.ok) return await res2.json();
        } catch (e2) {
          console.error('thingproxy feilet:', e2);
        }
        
        throw new Error('Alle proxy-metoder feilet');
      }
    }
  });
}


// Normaliser set-koder: lower, fjern whitespace, × -> x
export const normSet = (s?: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\u00d7/g, "x");

// Normaliser navn: lower, NFKC, trim og klem mellomrom
export const normName = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

// Normaliser collector_number: både "rå" (trim+lower) og "kun tall"
export const normCNRaw = (s?: string) => (s || "").trim().toLowerCase();
export const normCNNumeric = (s?: string) => {
  const m = String(s || "").match(/^0*([0-9]+)/);
  return m ? m[1] : String(s || "").trim();
};
