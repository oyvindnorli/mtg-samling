import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import type { OwnedCard } from "../types";
import Button from "../components/Button";
import { scryfallJson } from "../utils/scryfall";

type ParsedLine =
  | { mode: "name"; name: string }
  | { mode: "exact"; name: string; setCode: string; setName: string; collectorNumber: string; finish: string };

type CheckResult = {
  label: string;
  owned: OwnedCard[];
  totalQty: number;
  parsed: ParsedLine;
  price?: number | null;
  image?: string | null;
};

function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Tab-separert = Excel-format
  if (trimmed.includes("\t")) {
    const parts = trimmed.split("\t").map((s) => s.trim());

    // 5+ kolonner: Name, Set code, Set name, Collector number, Finish
    if (parts.length >= 5) {
      const name = parts[0];
      const setCode = parts[1].toLowerCase();
      const setName = parts[2];
      const collectorNumber = parts[3];
      const finishRaw = parts[4].toLowerCase();
      const finish = finishRaw === "foil"
        ? "foil"
        : "nonfoil";
      return { mode: "exact", name, setCode, setName, collectorNumber, finish };
    }

    // 4 kolonner: Set code, Set name, Collector number, Finish
    if (parts.length >= 4) {
      const setCode = parts[0].toLowerCase();
      const setName = parts[1];
      const collectorNumber = parts[2];
      const finishRaw = parts[3].toLowerCase();
      const finish = finishRaw === "foil"
        ? "foil"
        : "nonfoil";
      return { mode: "exact", name: "", setCode, setName, collectorNumber, finish };
    }
  }

  // Ellers: kortnavn
  return { mode: "name", name: trimmed };
}

export default function CheckListPage({
  collection,
}: {
  collection: OwnedCard[];
}) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedLine[]>([]);
  const [cardData, setCardData] = useState<Map<string, { price: number | null; image: string | null }>>(new Map());
  const [priceLoading, setPriceLoading] = useState(false);

  // Oppslag: kortnavn (lowercase) → alle eide varianter
  const ownedByName = useMemo(() => {
    const map = new Map<string, OwnedCard[]>();
    for (const card of collection) {
      const key = card.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [collection]);

  // Oppslag: "set::collector_number::finish" → OwnedCard[]
  const ownedByExact = useMemo(() => {
    const map = new Map<string, OwnedCard[]>();
    for (const card of collection) {
      const key = `${card.set}::${card.collector_number}::${card.finish}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
      // Også uten finish for bredere match
      const keyAny = `${card.set}::${card.collector_number}`;
      if (!map.has(keyAny)) map.set(keyAny, []);
      map.get(keyAny)!.push(card);
    }
    return map;
  }, [collection]);

  function handleCheck() {
    const lines = input.split("\n");
    const result: ParsedLine[] = [];
    for (const line of lines) {
      const p = parseLine(line);
      if (p) result.push(p);
    }
    setParsed(result);
    setCardData(new Map());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCheck();
    }
  }

  const results: CheckResult[] = useMemo(() => {
    return parsed.map((p) => {
      if (p.mode === "name") {
        const owned = ownedByName.get(p.name.toLowerCase()) ?? [];
        const totalQty = owned.reduce((sum, c) => sum + c.qty, 0);
        return { label: p.name, owned, totalQty, parsed: p };
      } else {
        // Prøv eksakt match (set + cn + finish)
        const exactKey = `${p.setCode}::${p.collectorNumber}::${p.finish}`;
        let owned = ownedByExact.get(exactKey) ?? [];
        if (owned.length === 0) {
          // Fallback: match uten finish
          const anyKey = `${p.setCode}::${p.collectorNumber}`;
          owned = ownedByExact.get(anyKey) ?? [];
        }
        const totalQty = owned.reduce((sum, c) => sum + c.qty, 0);
        const nameStr = p.name ? `${p.name} - ` : "";
        const label = `${nameStr}${p.setCode.toUpperCase()} #${p.collectorNumber} (${p.finish})`;
        return { label, owned, totalQty, parsed: p };
      }
    });
  }, [parsed, ownedByName, ownedByExact]);

  // Hent priser og bilder for alle kort i lista
  useEffect(() => {
    if (results.length === 0) return;
    setPriceLoading(true);

    let cancelled = false;

    (async () => {
      const newData = new Map<string, { price: number | null; image: string | null }>();
      try {
        for (const r of results) {
          if (cancelled) return;
          try {
            let card: any;
            if (r.parsed.mode === "exact") {
              card = await scryfallJson(`/cards/${r.parsed.setCode}/${r.parsed.collectorNumber}`);
            } else {
              card = await scryfallJson(`/cards/named?exact=${encodeURIComponent(r.parsed.name)}`);
            }
            if (!card || card.object === "error") continue;
            const keyExact = `${card.set}::${card.collector_number}`;
            const keyName = (card.name as string).toLowerCase();
            const eur = parseFloat(card.prices?.eur ?? "") || parseFloat(card.prices?.eur_foil ?? "") || null;
            const image = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
            const entry = { price: eur, image };
            newData.set(keyExact, entry);
            if (!newData.has(keyName)) newData.set(keyName, entry);
          } catch {
            // Kort ikke funnet, hopp over
          }
        }
      } finally {
        if (!cancelled) {
          setCardData(newData);
          setPriceLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [results]);

  // Koble priser og bilder til alle resultater
  const resultsWithPrices = useMemo(() => {
    return results.map((r) => {
      let data: { price: number | null; image: string | null } | undefined;
      if (r.parsed.mode === "exact") {
        data = cardData.get(`${r.parsed.setCode}::${r.parsed.collectorNumber}`);
      } else {
        data = cardData.get(r.parsed.name.toLowerCase());
      }
      return { ...r, price: data?.price ?? null, image: data?.image ?? null };
    });
  }, [results, cardData]);

  const ownedCount = resultsWithPrices.filter((r) => r.totalQty > 0).length;
  const missingCount = resultsWithPrices.filter((r) => r.totalQty === 0).length;
  const totalAll = resultsWithPrices
    .filter((r) => r.price)
    .reduce((sum, r) => sum + (r.price ?? 0), 0);
  const missingTotal = resultsWithPrices
    .filter((r) => r.totalQty === 0 && r.price)
    .reduce((sum, r) => sum + (r.price ?? 0), 0);

  const isExcelMode = parsed.length > 0 && parsed[0].mode === "exact";

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm underline underline-offset-2">
          &larr; Tilbake
        </Link>
      </div>

      <h1 className="text-xl font-bold mb-4">Sjekk kortliste</h1>
      <p className="text-sm text-gray-600 mb-4">
        Lim inn kortnavn (ett per linje) eller kopier fra Excel med kolonnene:{" "}
        <code className="bg-gray-100 px-1 rounded">Name</code>{" "}
        <code className="bg-gray-100 px-1 rounded">Set code</code>{" "}
        <code className="bg-gray-100 px-1 rounded">Set name</code>{" "}
        <code className="bg-gray-100 px-1 rounded">Collector number</code>{" "}
        <code className="bg-gray-100 px-1 rounded">Foil/nonfoil</code>
      </p>

      <textarea
        className="w-full h-48 rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={"Lightning Bolt\nCounterspell\n\nEller fra Excel:\nDOM\tDominaria\t1\tnonfoil\nKHM\tKaldheim\t45\tfoil"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <Button onClick={handleCheck} disabled={!input.trim()}>
          Sjekk
        </Button>
        {parsed.length > 0 && (
          <span className="text-sm text-gray-600">
            {ownedCount} eid / {missingCount} mangler av {resultsWithPrices.length} kort
            {isExcelMode && <span className="ml-1 text-gray-400">(Excel-modus)</span>}
          </span>
        )}
      </div>

      {parsed.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm text-gray-600">Hele lista (Cardmarket)</div>
            <div className="text-2xl font-bold mt-1">
              {priceLoading
                ? "Henter priser..."
                : totalAll > 0
                  ? `€${totalAll.toFixed(2)}`
                  : "Ingen prisdata"}
            </div>
          </div>
          {missingCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
              <div className="text-sm text-gray-600">
                {missingCount} manglende kort
              </div>
              <div className="text-2xl font-bold mt-1 text-red-700">
                {priceLoading
                  ? "Henter priser..."
                  : missingTotal > 0
                    ? `€${missingTotal.toFixed(2)}`
                    : "Ingen prisdata"}
              </div>
            </div>
          )}
        </div>
      )}

      {resultsWithPrices.length > 0 && (() => {
        const missing = resultsWithPrices.filter((r) => r.totalQty === 0);
        const owned = resultsWithPrices.filter((r) => r.totalQty > 0);
        return (
          <>
            {missing.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-red-700">Mangler ({missing.length})</h2>
                  <button
                    className="text-sm underline underline-offset-2 text-gray-600"
                    onClick={() => {
                      const text = missing.map((r) => {
                        return r.parsed.mode === "exact" && r.parsed.name ? r.parsed.name : r.label;
                      }).join("\n");
                      navigator.clipboard.writeText(text);
                    }}
                  >
                    Kopier liste
                  </button>
                </div>
                <div className="space-y-2">
                  {missing.map((r, i) => (
                    <div key={`miss-${i}`} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <div className="flex gap-3">
                        {r.image && (
                          <img src={r.image} alt={r.label} className="w-48 rounded-lg flex-shrink-0" loading="lazy" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{r.label}</span>
                            <div className="flex items-center gap-3">
                              {r.price != null && <span className="text-xs text-gray-500">€{r.price.toFixed(2)}</span>}
                              <span className="text-red-600 text-sm font-semibold">Mangler</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {owned.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-3 text-green-700">Eid ({owned.length})</h2>
                <div className="space-y-2">
                  {owned.map((r, i) => (
                    <div key={`own-${i}`} className="rounded-xl border border-green-300 bg-green-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.label}</span>
                        <div className="flex items-center gap-3">
                          {r.price != null && <span className="text-xs text-gray-500">€{r.price.toFixed(2)}</span>}
                          <span className="text-green-700 text-sm font-semibold">Eid ({r.totalQty})</span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                        {r.owned.map((c) => (
                          <div key={c.key}>
                            {c.set_name} ({c.set.toUpperCase()}) #{c.collector_number}{" "}
                            &middot; {c.finish} &middot; {c.qty}x
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
