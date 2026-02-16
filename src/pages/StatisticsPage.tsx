import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { OwnedCard, SetStats, CollectionStats } from "../types";
import { getSetMetaBatch } from "../utils/setMetaCache";

export default function StatisticsPage({
  collection,
}: {
  collection: OwnedCard[];
}) {
  const [setMetaLoading, setSetMetaLoading] = useState(false);
  const [setCardCounts, setSetCardCounts] = useState<Record<string, number>>({});
  const [rarityCounts, setRarityCounts] = useState<Record<string, number> | null>(null);
  const [rarityLoading, setRarityLoading] = useState(false);

  // Calculate basic stats from collection
  const stats: CollectionStats = useMemo(() => {
    const setMap = new Map<string, { set_name: string; totalQty: number; uniqueIds: Set<string> }>();

    for (const card of collection) {
      const existing = setMap.get(card.set);
      if (existing) {
        existing.totalQty += card.qty;
        existing.uniqueIds.add(card.id);
      } else {
        setMap.set(card.set, {
          set_name: card.set_name,
          totalQty: card.qty,
          uniqueIds: new Set([card.id]),
        });
      }
    }

    const setStats: SetStats[] = Array.from(setMap.entries()).map(([set, data]) => {
      const cardCount = setCardCounts[set];
      return {
        set,
        set_name: data.set_name,
        totalQty: data.totalQty,
        uniqueCards: data.uniqueIds.size,
        setCardCount: cardCount,
        completionPercent: cardCount ? Math.round((data.uniqueIds.size / cardCount) * 100) : undefined,
      };
    });

    // Sort by total quantity descending
    setStats.sort((a, b) => b.totalQty - a.totalQty);

    const totalQty = collection.reduce((sum, card) => sum + card.qty, 0);
    const totalUniqueCards = new Set(collection.map((c) => c.id)).size;

    return {
      totalQty,
      totalUniqueCards,
      totalSets: setMap.size,
      setStats,
    };
  }, [collection, setCardCounts]);

  // Fetch set metadata for completion percentages
  useEffect(() => {
    if (stats.setStats.length === 0) return;

    const setCodes = stats.setStats.map((s) => s.set);
    setSetMetaLoading(true);

    getSetMetaBatch(setCodes)
      .then((meta) => {
        const counts: Record<string, number> = {};
        for (const [code, data] of Object.entries(meta)) {
          counts[code] = data.card_count;
        }
        setSetCardCounts(counts);
      })
      .finally(() => setSetMetaLoading(false));
  }, [stats.setStats.length]);

  // Fetch rarity data from Scryfall /cards/collection (POST, max 75 per batch)
  useEffect(() => {
    if (collection.length === 0) return;

    const uniqueIds = [...new Set(collection.map((c) => c.id))];
    setRarityLoading(true);

    // qty per card id (summert over finishes)
    const qtyById = new Map<string, number>();
    for (const c of collection) {
      qtyById.set(c.id, (qtyById.get(c.id) || 0) + c.qty);
    }

    const BATCH_SIZE = 75;
    const batches: { id: string }[][] = [];
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      batches.push(uniqueIds.slice(i, i + BATCH_SIZE).map((id) => ({ id })));
    }

    let cancelled = false;

    (async () => {
      const counts: Record<string, number> = {};
      try {
        const isDev = window.location.hostname === "localhost";
        for (const batch of batches) {
          if (cancelled) return;
          const url = isDev
            ? "/scryfall/cards/collection"
            : "/api/scryfall?path=/cards/collection";
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifiers: batch }),
          });
          if (!res.ok) continue;
          const json = await res.json();
          for (const card of json.data ?? []) {
            const rarity: string = card.rarity ?? "unknown";
            const qty = qtyById.get(card.id) || 1;
            counts[rarity] = (counts[rarity] || 0) + qty;
          }
        }
        if (!cancelled) setRarityCounts(counts);
      } catch (e) {
        console.error("Feil ved henting av rarity:", e);
      } finally {
        if (!cancelled) setRarityLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [collection]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Statistikk</h1>
        <Link to="/" className="text-sm underline underline-offset-2">
          Tilbake til forsiden
        </Link>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Totalt antall kort</div>
          <div className="text-3xl font-bold">{stats.totalQty.toLocaleString("nb-NO")}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Unike kort</div>
          <div className="text-3xl font-bold">{stats.totalUniqueCards.toLocaleString("nb-NO")}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Sett representert</div>
          <div className="text-3xl font-bold">{stats.totalSets.toLocaleString("nb-NO")}</div>
        </div>
      </div>

      {/* Rarity breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(
          [
            { key: "mythic", label: "Mythic", color: "text-orange-600" },
            { key: "rare", label: "Rare", color: "text-yellow-600" },
            { key: "uncommon", label: "Uncommon", color: "text-gray-500" },
            { key: "common", label: "Common", color: "text-gray-900" },
          ] as const
        ).map(({ key, label, color }) => (
          <div key={key} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">{label}</div>
            <div className={`text-3xl font-bold ${color}`}>
              {rarityLoading
                ? "..."
                : rarityCounts
                  ? (rarityCounts[key] ?? 0).toLocaleString("nb-NO")
                  : "-"}
            </div>
          </div>
        ))}
      </div>

      {/* Set statistics table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Kort per sett</h2>
          {setMetaLoading && (
            <span className="text-sm text-gray-500 ml-2">(laster fullføringsgrad...)</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Sett</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Antall kort</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Unike</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-600 w-48">Fullføringsgrad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.setStats.map((setStat) => (
                <tr key={setStat.set} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link
                      to={`/set/${setStat.set}?name=${encodeURIComponent(setStat.set_name)}`}
                      className="hover:underline"
                    >
                      <span className="font-medium">{setStat.set_name}</span>
                      <span className="text-gray-500 ml-2 text-sm">({setStat.set.toUpperCase()})</span>
                    </Link>
                  </td>
                  <td className="text-right px-6 py-3 tabular-nums">
                    {setStat.totalQty.toLocaleString("nb-NO")}
                  </td>
                  <td className="text-right px-6 py-3 tabular-nums">
                    {setStat.uniqueCards.toLocaleString("nb-NO")}
                    {setStat.setCardCount && (
                      <span className="text-gray-400 text-sm"> / {setStat.setCardCount}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {setStat.completionPercent !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(setStat.completionPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums w-12 text-right">
                          {setStat.completionPercent}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.setStats.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            Ingen kort i samlingen ennå.
          </div>
        )}
      </div>
    </div>
  );
}
