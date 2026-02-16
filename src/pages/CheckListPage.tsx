import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { OwnedCard } from "../types";
import Button from "../components/Button";

export default function CheckListPage({
  collection,
}: {
  collection: OwnedCard[];
}) {
  const [input, setInput] = useState("");
  const [checkedNames, setCheckedNames] = useState<string[]>([]);

  // Bygg oppslag: kortnavn (lowercase) → alle eide varianter
  const ownedByName = useMemo(() => {
    const map = new Map<string, OwnedCard[]>();
    for (const card of collection) {
      const key = card.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [collection]);

  function handleCheck() {
    const names = input
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setCheckedNames(names);
  }

  // Også sjekk med Enter i textarea (Ctrl+Enter)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCheck();
    }
  }

  const results = useMemo(() => {
    return checkedNames.map((name) => {
      const owned = ownedByName.get(name.toLowerCase()) ?? [];
      const totalQty = owned.reduce((sum, c) => sum + c.qty, 0);
      return { name, owned, totalQty };
    });
  }, [checkedNames, ownedByName]);

  const ownedCount = results.filter((r) => r.totalQty > 0).length;
  const missingCount = results.filter((r) => r.totalQty === 0).length;

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm underline underline-offset-2">
          &larr; Tilbake
        </Link>
      </div>

      <h1 className="text-xl font-bold mb-4">Sjekk kortliste</h1>
      <p className="text-sm text-gray-600 mb-4">
        Lim inn kortnavn, ett per linje. Trykk <strong>Sjekk</strong> for å se
        om du eier dem.
      </p>

      <textarea
        className="w-full h-48 rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={"Lightning Bolt\nCounterspell\nSwords to Plowshares"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center gap-3 mt-3">
        <Button onClick={handleCheck} disabled={!input.trim()}>
          Sjekk
        </Button>
        {checkedNames.length > 0 && (
          <span className="text-sm text-gray-600">
            {ownedCount} eid / {missingCount} mangler av {results.length} kort
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          {results.map((r, i) => (
            <div
              key={`${r.name}-${i}`}
              className={`rounded-xl border px-4 py-3 ${
                r.totalQty > 0
                  ? "border-green-300 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                {r.totalQty > 0 ? (
                  <span className="text-green-700 text-sm font-semibold">
                    Eid ({r.totalQty})
                  </span>
                ) : (
                  <span className="text-red-600 text-sm font-semibold">
                    Mangler
                  </span>
                )}
              </div>

              {r.owned.length > 0 && (
                <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                  {r.owned.map((c) => (
                    <div key={c.key}>
                      {c.set_name} ({c.set.toUpperCase()}) #{c.collector_number}{" "}
                      &middot; {c.finish} &middot; {c.qty}x
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
