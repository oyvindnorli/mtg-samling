

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { OwnedCard, ScryfallCard, SearchResult } from "../types";
import Toggle from "../components/Toggle";
import Button from "../components/Button";
import SearchBar from "../components/SearchBar";
import ResultCard from "../components/ResultCard";
import CollectionBySet from "./CollectionBySet";
import { scryfallJson, SCRYFALL_BASE, makeOwnedKey } from "../utils/scryfall";


export default function HomePage({
  addToCollection,
  exportJson,
  onImport,
  updateQty,
  removeOwned,
  decrementOne,
  collection,
}: {
  addToCollection: (c: ScryfallCard, f: string) => void;
  exportJson: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateQty: (k: string, q: number) => void;
  removeOwned: (k: string) => void;
  decrementOne: (k: string) => Promise<void>;
  collection: OwnedCard[];
}) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [groupPrints, setGroupPrints] = useState(false);

  const ctrlRef = useRef<AbortController | null>(null);
  const debRef = useRef<number | null>(null);

  const [showSets, setShowSets] = useState(true);
  const [setSearchQuery, setSetSearchQuery] = useState("");
  const [setSearchResults, setSetSearchResults] = useState<any[]>([]);
  const [setSearchLoading, setSetSearchLoading] = useState(false);

  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
  if (debRef.current) window.clearTimeout(debRef.current);
  setSearchError(null); // Clear error når query endrer seg
  if (!query.trim()) {
    setResults([]);
    setNextPage(null);
    return;
  }
  debRef.current = window.setTimeout(async () => {
    try {
      setIsLoading(true);
      ctrlRef.current?.abort();
      ctrlRef.current = new AbortController();

      // Bygg URL manuelt for å unngå encoding-problemer
      const searchParams = new URLSearchParams();
      searchParams.set("q", `${query} -is:digital`); // Exclude digital cards
      if (!groupPrints) searchParams.set("unique", "prints");
      
      const searchUrl = `/cards/search?${searchParams.toString()}`;
      let data: SearchResult;
      
      try {
        data = await scryfallJson(searchUrl);
      } catch (firstError: any) {
        // Hvis første søk feiler med 404, prøv name-søk
        if (firstError?.message?.includes("404") && !query.includes(":")) {
          const nameSearchParams = new URLSearchParams();
          nameSearchParams.set("q", `name:"${query}" -is:digital`);
          if (!groupPrints) nameSearchParams.set("unique", "prints");
          
          const nameSearchUrl = `/cards/search?${nameSearchParams.toString()}`;
          data = await scryfallJson(nameSearchUrl);
        } else {
          throw firstError;
        }
      }
      if (data.object !== "list") throw new Error("Ugyldig svar fra Scryfall");
      setResults(data.data);
      setNextPage(data.has_more && data.next_page ? data.next_page : null);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        
        // Bedre feilmeldinger basert på feiltype
        let errorMessage = "Klarte ikke å hente fra Scryfall.";
        if (e?.message?.includes("404")) {
          errorMessage = `Ingen kort funnet for "${query}". Prøv et annet søk.`;
        } else if (e?.message?.includes("429")) {
          errorMessage = "For mange forespørsler. Prøv igjen om litt.";
        } else if (e?.message?.includes("503") || e?.message?.includes("502")) {
          errorMessage = "Scryfall er midlertidig utilgjengelig. Prøv igjen senere.";
        }
        
        setSearchError(errorMessage);
        setResults([]);
        setNextPage(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, 350);

  return () => { if (debRef.current) window.clearTimeout(debRef.current); };
}, [query, groupPrints]);

  // Forenklet sett-navigasjon uten API-kall
  const handleSetSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (setSearchQuery.trim()) {
      const code = setSearchQuery.trim().toLowerCase();
      window.location.href = `/set/${code}?name=${encodeURIComponent(code.toUpperCase())}`;
    }
  };

  const loadMore = async () => {
    if (!nextPage || isLoading) return;
    
    try {
      setIsLoading(true);
      const data: SearchResult = await scryfallJson(nextPage);
      if (data.object !== "list") throw new Error("Ugyldig svar fra Scryfall");
      
      setResults(prev => [...prev, ...data.data]);
      setNextPage(data.has_more && data.next_page ? data.next_page : null);
    } catch (e: any) {
      console.error(e);
      setSearchError(e?.message || "Klarte ikke å laste flere kort.");
    } finally {
      setIsLoading(false);
    }
  };

  const grouped = useMemo(() => {
    if (!groupPrints) return null;
    const by: Record<string, ScryfallCard[]> = {};
    for (const c of results) {
      by[c.name] ||= [];
      by[c.name].push(c);
    }
    return by;
  }, [results, groupPrints]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Toggle label="Grupper printings" checked={groupPrints} onChange={setGroupPrints} />
        <Button variant="outline" onClick={exportJson}>Eksporter JSON</Button>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <Button variant="outline">Importer</Button>
          <input type="file" accept="application/json" className="hidden" onChange={onImport} />
        </label>
      </div>

      <SearchBar value={query} onChange={setQuery} isLoading={isLoading} />
      {searchError && (
  <div className="mt-3 text-sm text-red-600">
    {searchError}{" "}
    <button
      className="underline underline-offset-2"
      onClick={() => setQuery((q) => q)} // trigger ny kjøring av effekten
    >
      Prøv igjen
    </button>
  </div>
)}


      {results.length === 0 && !isLoading && (
        <div className="mt-8 text-gray-600">
          Eksempler: <code className="bg-gray-100 px-1 rounded">name:lightning bolt</code>{" "}
          <code className="bg-gray-100 px-1 rounded ml-1">type:dragon</code>{" "}
          <code className="bg-gray-100 px-1 rounded ml-1">set:khm</code>
        </div>
      )}

      {!groupPrints ? (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((card) => {
            // Beregn eierskap for dette kortet
            const ownedCards = collection.filter(item => item.id === card.id);
            const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
            const ownedByFinish: Record<string, number> = {};
            
            ownedCards.forEach(item => {
              ownedByFinish[item.finish] = (ownedByFinish[item.finish] || 0) + item.qty;
            });
            
            return (
              <ResultCard 
                key={card.id} 
                card={card} 
                onAdd={(f) => addToCollection(card, f)}
                onDecrement={(f) => decrementOne(makeOwnedKey(card, f))}
                ownedQty={ownedQty}
                ownedByFinish={ownedByFinish}
                linkToSet 
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped &&
            Object.entries(grouped).map(([name, cards]) => (
              <div key={name} className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-lg font-semibold">{name}</h3>
                  <span className="text-xs text-gray-600">{cards.length} printing(s)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                  {cards.map((card) => {
                    // Beregn eierskap for dette kortet
                    const ownedCards = collection.filter(item => item.id === card.id);
                    const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                    const ownedByFinish: Record<string, number> = {};
                    
                    ownedCards.forEach(item => {
                      ownedByFinish[item.finish] = (ownedByFinish[item.finish] || 0) + item.qty;
                    });
                    
                    return (
                      <ResultCard 
                        key={card.id} 
                        card={card} 
                        onAdd={(f) => addToCollection(card, f)}
                        onDecrement={(f) => decrementOne(makeOwnedKey(card, f))}
                        ownedQty={ownedQty}
                        ownedByFinish={ownedByFinish}
                        linkToSet 
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {nextPage && (
        <div className="flex justify-center mt-8">
          <Button onClick={loadMore}>Last inn flere</Button>
        </div>
      )}

      <hr className="my-10" />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Søk etter MTG-sett</h2>
        <button
          className="text-sm underline underline-offset-2"
          onClick={() => setShowSets((v) => !v)}
        >
          {showSets ? "Skjul" : "Vis"}
        </button>
      </div>

      {showSets && (
        <div className="space-y-4">
          <form onSubmit={handleSetSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Skriv inn sett-kode (f.eks. dom, khm, neo)..."
              value={setSearchQuery}
              onChange={(e) => setSetSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button type="submit" disabled={!setSearchQuery.trim()}>
              Gå til sett
            </Button>
          </form>

          <div className="text-sm text-gray-600">
            Skriv inn en sett-kode og trykk "Gå til sett" for å se alle kort i settet.
            <br />
            Eksempler: <code className="bg-gray-100 px-1 rounded">dom</code> (Dominaria), 
            <code className="bg-gray-100 px-1 rounded ml-1">khm</code> (Kaldheim), 
            <code className="bg-gray-100 px-1 rounded ml-1">neo</code> (Kamigawa)
          </div>
        </div>
      )}


    </div>
  );
}
