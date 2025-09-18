import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { OwnedCard, ScryfallCard, SearchResult } from "../types";
import {
  scryfallJson,
  SCRYFALL_BASE,
  normSet,
  normName,
  normCNRaw,
  normCNNumeric,
} from "../utils/scryfall";

// =======================
// Små interne UI-komponenter
// =======================
function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && <div className="text-xs text-gray-600 mb-1">{label}</div>}
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RarityBars(props: {
  common: { owned: number; total: number };
  uncommon: { owned: number; total: number };
  rare: { owned: number; total: number };
  mythic: { owned: number; total: number };
}) {
  const Row = ({ title, b }: { title: string; b: { owned: number; total: number } }) => (
    <div>
      <Progress value={b.owned} max={b.total} label={`${title} ${b.owned}/${b.total}`} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Row title="Common" b={props.common} />
      <Row title="Uncommon" b={props.uncommon} />
      <Row title="Rare" b={props.rare} />
      <Row title="Mythic" b={props.mythic} />
    </div>
  );
}

function SetCard(props: {
  code: string;
  name: string;
  year?: string;
  icon?: string;
  ownedUniqueNumbers: number;
  totalUniqueNumbers: number;
  ownedUniqueNames: number;
  totalUniqueNames: number;
  totalOwnedQty: number;
  rarity: {
    common: { owned: number; total: number };
    uncommon: { owned: number; total: number };
    rare: { owned: number; total: number };
    mythic: { owned: number; total: number };
  };
}) {
  const link = `/set/${props.code}?name=${encodeURIComponent(props.name)}`;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        {props.icon ? (
          <img src={props.icon} alt="" className="h-6 w-6" />
        ) : (
          <div className="h-6 w-6 bg-gray-200 rounded" />
        )}
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold">
            {props.name}{" "}
            <span className="font-mono text-gray-500">({props.code.toUpperCase()})</span>
          </div>
          {props.year && <div className="text-xs text-gray-500">{props.year}</div>}
        </div>
        <Link to={link} className="text-sm underline underline-offset-2">
          Åpne
        </Link>
      </div>

      {/* Unike nummer */}
      <div className="mb-3">
        <Progress
          value={props.ownedUniqueNumbers}
          max={props.totalUniqueNumbers}
          label={`Unike # ${props.ownedUniqueNumbers} / ${props.totalUniqueNumbers} · ${props.totalOwnedQty} stk totalt`}
        />
      </div>

      {/* Unike navn */}
      <div className="mb-4">
        <Progress
          value={props.ownedUniqueNames}
          max={props.totalUniqueNames}
          label={`Unike navn ${props.ownedUniqueNames} / ${props.totalUniqueNames}`}
        />
      </div>

      <RarityBars {...props.rarity} />
    </div>
  );
}

// =======================
// Typer
// =======================
type SetMeta = {
  id: string;
  code: string;
  name: string;
  released_at?: string | null;
  icon_svg_uri?: string | null;
  card_count?: number | null; // NB: Scryfall sin total (kan inkludere diverse)
};

// =======================
// Hjelpere (fetch alt fra Scryfall med paging)
// =======================
async function fetchAll<T = any>(firstUrl: string): Promise<T[]> {
  const out: T[] = [];
  let url = firstUrl;
  /* eslint-disable no-await-in-loop */
  while (url) {
    const page = (await scryfallJson(url)) as {
      data: T[];
      has_more?: boolean;
      next_page?: string;
      object?: string;
    };
    if (Array.isArray(page.data)) out.push(...page.data);
    url = page.has_more && page.next_page ? page.next_page : "";
  }
  /* eslint-enable no-await-in-loop */
  return out;
}


// Hent metadata for ett sett
async function fetchSetMeta(code: string): Promise<SetMeta | null> {
  try {
    const data = await scryfallJson(`${SCRYFALL_BASE}/sets/${code}`);
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      released_at: data.released_at ?? null,
      icon_svg_uri: data.icon_svg_uri ?? null,
      card_count: data.card_count ?? null,
    };
  } catch {
    return null;
  }
}

// Hent alle kort i et sett (unike navn)
async function fetchUniqueNames(code: string): Promise<ScryfallCard[]> {
  const u = new URL(`${SCRYFALL_BASE}/cards/search`, window.location.origin);
  u.searchParams.set("q", `set:${code}`);
  u.searchParams.set("order", "set");
  u.searchParams.set("dir", "asc");
  u.searchParams.set("unique", "cards"); // unike navn
  u.searchParams.set("include_extras", "false");
  u.searchParams.set("include_multilingual", "false");
  u.searchParams.set("include_variations", "false");
  return fetchAll<ScryfallCard>(u.toString());
}

// Hent alle prints i et sett (for å telle unike collector_number)
async function fetchAllPrints(code: string): Promise<ScryfallCard[]> {
  const u = new URL(`${SCRYFALL_BASE}/cards/search`, window.location.origin);
  u.searchParams.set("q", `set:${code}`);
  u.searchParams.set("order", "set");
  u.searchParams.set("dir", "asc");
  u.searchParams.set("unique", "prints"); // alle prints
  u.searchParams.set("include_extras", "false");
  u.searchParams.set("include_multilingual", "false");
  u.searchParams.set("include_variations", "false");
  return fetchAll<ScryfallCard>(u.toString());
}

// =======================
// Hovedkomponent
// =======================
export default function CollectionBySet({ collection }: { collection: OwnedCard[] }) {
  // Normaliser samlingen: gruppe på set-kode
  const setsInCollection = useMemo(() => {
    const codes = new Set<string>();
    for (const it of collection) {
      codes.add(normSet(it.set));
    }
    return Array.from(codes);
  }, [collection]);

  // Metacache: code -> meta
  const [meta, setMeta] = useState<Record<string, SetMeta>>({});
  // Stat-cache per sett
  const [stats, setStats] = useState<{
    [code: string]: {
      // totals
      totalUniqueNames: number;
      totalUniqueNumbers: number;
      rarityTotals: Record<"common" | "uncommon" | "rare" | "mythic", number>;
      // owned
      ownedUniqueNames: number;
      ownedUniqueNumbers: number;
      rarityOwned: Record<"common" | "uncommon" | "rare" | "mythic", number>;
      totalOwnedQty: number;
    };
  }>({});

  // Hjelpe-cache for fetched kort
  const [loadedCodes, setLoadedCodes] = useState<Set<string>>(new Set());

  // Hent meta for alle sett i collection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, SetMeta> = {};
      await Promise.all(
        setsInCollection.map(async (code) => {
          if (meta[code]) {
            next[code] = meta[code];
            return;
          }
          const m = await fetchSetMeta(code);
          if (m) next[code] = m;
        })
      );
      if (!cancelled && Object.keys(next).length) {
        setMeta((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setsInCollection]); // eslint-disable-line react-hooks/exhaustive-deps

  // liten hjelper øverst i fila om du ikke har den fra før
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hent stat for hvert sett (unike navn/nummer + rarity buckets)
useEffect(() => {
  let cancelled = false;

  (async () => {
    for (const code of setsInCollection) {
      if (cancelled) break;
      if (loadedCodes.has(code)) continue;

      try {
        // Eierskap i dette settet
        const owned = collection.filter((it) => normSet(it.set) === code);
        const ownedByName = new Map<string, number>();
        const ownedByNumber = new Map<string, number>();
        const ownedQtySum = owned.reduce((s, it) => s + it.qty, 0);
        for (const it of owned) {
          ownedByName.set(normName(it.name), 1);
          ownedByNumber.set(normCNRaw(it.collector_number), 1);
          ownedByNumber.set(normCNNumeric(it.collector_number), 1);
        }

        // Hent Scryfall-data for settet (hver for seg, med lokal catch)
        const uniqueCards = await fetchUniqueNames(code).catch(() => [] as ScryfallCard[]);
        const prints      = await fetchAllPrints(code).catch(() => [] as ScryfallCard[]);

        // Regn totals
        const totalUniqueNames = uniqueCards.length;

        const allNumbers = new Set<string>();
        for (const p of prints) {
          if (!p.collector_number) continue;
          allNumbers.add(normCNRaw(p.collector_number));
        }
        const totalUniqueNumbers = allNumbers.size;

        // Eide unike
        const ownedUniqueNames = ownedByName.size;
        let ownedUniqueNumbers = 0;
        for (const k of ownedByNumber.keys()) {
          if (allNumbers.has(k)) ownedUniqueNumbers++;
        }

        // Rarity-buckets
        const rarityTotals = { common: 0, uncommon: 0, rare: 0, mythic: 0 } as const;
        const rarityOwned  = { common: 0, uncommon: 0, rare: 0, mythic: 0 } as const;
        const totals: any = { ...rarityTotals };
        const ownedB: any = { ...rarityOwned };
        for (const c of uniqueCards) {
          const r: "common" | "uncommon" | "rare" | "mythic" =
            (c.rarity as any) || "common";
          totals[r] += 1;
          if (ownedByName.has(normName(c.name))) ownedB[r] += 1;
        }

        if (!cancelled) {
          setStats((prev) => ({
            ...prev,
            [code]: {
              totalUniqueNames,
              totalUniqueNumbers,
              rarityTotals: totals,
              ownedUniqueNames,
              ownedUniqueNumbers,
              rarityOwned: ownedB,
              totalOwnedQty: ownedQtySum,
            },
          }));
        }
      } catch (e) {
        // Feil på dette settet – logg, men ikke stopp hele kjeden
        console.warn("Set-stats feilet for", code, e);
      } finally {
        if (!cancelled) {
          setLoadedCodes((prev) => new Set(prev).add(code));
        }
        // Throttle litt for å unngå 429 (juster om du vil)
        await sleep(200);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [setsInCollection, collection, loadedCodes]);


  // Lag en liste med alt som skal vises (meta + stats)
  const view = useMemo(() => {
    const rows = setsInCollection
      .map((code) => {
        const m = meta[code];
        const s = stats[code];
        if (!m || !s) return null;
        const year = m.released_at ? m.released_at.slice(0, 4) : undefined;
        return {
          code,
          name: m.name,
          year,
          icon: m.icon_svg_uri || undefined,
          ...s,
        };
      })
      .filter(Boolean) as Array<{
        code: string;
        name: string;
        year?: string;
        icon?: string;
        totalUniqueNames: number;
        totalUniqueNumbers: number;
        ownedUniqueNames: number;
        ownedUniqueNumbers: number;
        rarityTotals: Record<"common" | "uncommon" | "rare" | "mythic", number>;
        rarityOwned: Record<"common" | "uncommon" | "rare" | "mythic", number>;
        totalOwnedQty: number;
      }>;

    // Sortér etter år (nyeste først), så navn
    rows.sort((a, b) => {
      const ay = a.year ? parseInt(a.year, 10) : 0;
      const by = b.year ? parseInt(b.year, 10) : 0;
      if (by !== ay) return by - ay;
      return a.name.localeCompare(b.name, "no");
    });

    // Gruppér per år
    const byYear = new Map<string, typeof rows>();
    for (const r of rows) {
      const bucket = r.year || "Uten år";
      if (!byYear.has(bucket)) byYear.set(bucket, []);
      byYear.get(bucket)!.push(r);
    }
    return byYear;
  }, [meta, stats, setsInCollection]);

  return (
  <div className="space-y-8">
    {view.size === 0 && setsInCollection.length === 0 ? (
      <div className="text-sm text-gray-600">
        Ingen kort i samlingen enda.
      </div>
    ) : view.size === 0 ? (
      <div className="text-sm text-gray-600">
        Laster sett-data...
      </div>
    ) : (
      [...view.keys()].map((year) => {
        const rows = view.get(year)!;
        return (
          <section key={year}>
            <h2 className="text-lg font-semibold mb-3">{year}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r) => (
                <SetCard
                  key={r.code}
                  code={r.code}
                  name={r.name}
                  year={r.year}
                  icon={r.icon}
                  ownedUniqueNumbers={r.ownedUniqueNumbers}
                  totalUniqueNumbers={r.totalUniqueNumbers}
                  ownedUniqueNames={r.ownedUniqueNames}
                  totalUniqueNames={r.totalUniqueNames}
                  totalOwnedQty={r.totalOwnedQty}
                  rarity={{
                    common:   { owned: r.rarityOwned.common,   total: r.rarityTotals.common },
                    uncommon: { owned: r.rarityOwned.uncommon, total: r.rarityTotals.uncommon },
                    rare:     { owned: r.rarityOwned.rare,     total: r.rarityTotals.rare },
                    mythic:   { owned: r.rarityOwned.mythic,   total: r.rarityTotals.mythic },
                  }}
                />
              ))}
            </div>
          </section>
        );
      })
    )}
  </div>
);

}
