import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { OwnedCard, ScryfallCard, SearchResult } from "../types";
import Button from "../components/Button";
import ResultCard from "../components/ResultCard";
import Toggle from "../components/Toggle";
import {
  compareCollector,
  dedupeById,
  parseCN,
  scryfallJson,
} from "../utils/scryfall";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchList(url: URL | string): Promise<SearchResult> {
  const u = typeof url === "string" ? url : url.toString();
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const data = (await scryfallJson(u)) as any;
      if (data?.object === "error") {
        throw new Error(data.details || "Scryfall: object=error");
      }
      return data as SearchResult;
    } catch (err) {
      if (attempt < 2) {
        await sleep(1200);
        continue;
      }
      throw err;
    }
  }
}

export default function SetPage({
  addToCollection,
  collection,
  decrementOne,
}: {
  addToCollection: (c: ScryfallCard, f: string) => void;
  collection: OwnedCard[];
  decrementOne: (k: string) => Promise<void>;
}) {
  const { code: setCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { search } = useLocation();
  const name = decodeURIComponent(new URLSearchParams(search).get("name") || "");

  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [setName, setSetName] = useState<string>("");
  const [eurToNok, setEurToNok] = useState<number | null>(null);
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [showAllVariations, setShowAllVariations] = useState(true);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [showListView, setShowListView] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'collector_number' | 'rarity' | 'owned'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=NOK");
        const data = await res.json();
        if (!cancelled && data?.rates?.NOK) {
          setEurToNok(Number(data.rates.NOK));
          setFxDate(data.date || null);
        }
      } catch {
        // ignorer – vi viser bare EUR hvis FX feiler
      }
    })();
    return () => { cancelled = true; };
  }, []);






  useEffect(() => {
  if (!setCode) return;
  let cancelled = false;

  (async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        q: `set:${setCode} -is:digital`,
        order: "set",
        dir: "asc",
        unique: showAllVariations ? "prints" : "cards",
        include_extras: showAllVariations ? "true" : "false",
        include_multilingual: "false",
        include_variations: showAllVariations ? "true" : "false",
      });

      const data: SearchResult = await scryfallJson(`/cards/search?${params}`);
      if (cancelled) return;
      if (data.object !== "list") throw new Error("Ugyldig svar fra Scryfall");

      setCards(data.data);
      setNext(data.has_more && data.next_page ? data.next_page : null);
      
      // Sett serienavnet fra det første kortet
      if (data.data && data.data.length > 0 && data.data[0].set_name) {
        setSetName(data.data[0].set_name);
      }
    } catch (e: any) {
      if (!cancelled) setErrorMsg(e?.message || "Klarte ikke å hente fra Scryfall.");
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [setCode, showAllVariations]);


  async function loadPage(url: URL | string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchList(url);
      setCards((prev) => {
        const merged = dedupeById([...prev, ...data.data]);
        merged.sort(compareCollector);
        return merged;
      });
      setNext(data.has_more && data.next_page ? data.next_page : null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Klarte ikke å hente flere kort.");
      setNext(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Tilbake</Button>
          <h2 className="text-xl font-semibold">
            {setName || name || "Set"}{" "}
            <span className="font-mono text-gray-500">({(setCode || "").toUpperCase()})</span>
          </h2>
        </div>
        <Link to="/" className="text-sm underline underline-offset-2">Til forsiden</Link>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm text-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">
                {showAllVariations ? "Alle variasjoner" : "Unike kortnavn"}
              </span>
              {showOnlyMissing && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  Kun mangler
                </span>
              )}
            </div>
            
            {eurToNok && fxDate && (
              <div className="text-xs text-gray-500 mb-1">
                Kurs: EUR→NOK {eurToNok.toFixed(3)} (ECB {fxDate})
              </div>
            )}
            
            {(() => {
              if (!eurToNok || cards.length === 0) return null;
              
              // Filtrer kort basert på "kun mangler" innstilling
              const filteredCards = showOnlyMissing
                ? cards.filter(card => {
                    if (showAllVariations) {
                      // Når vi viser alle variasjoner: sjekk kun denne spesifikke ID-en
                      const ownedCards = collection.filter(item => item.id === card.id);
                      const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                      return ownedQty === 0;
                    } else {
                      // Når vi viser unike navn: sjekk om vi eier NOEN variant av kortet
                      const ownedAnyVariant = collection.some(item =>
                        item.name === card.name && item.set === card.set
                      );
                      return !ownedAnyVariant;
                    }
                  })
                : cards;
              
              // Beregn totalpris for filtrerte kort
              const totalSetEur = filteredCards.reduce((sum, card) => {
                const cardPrice = parseFloat(card.prices?.eur || card.prices?.eur_foil || "0");
                return sum + cardPrice;
              }, 0);
              
              // Beregn verdien av kortene du eier - kun fra de som vises (filtrerte)
              const ownedCardsInView = filteredCards.filter(card => {
                const ownedCards = collection.filter(item => item.id === card.id);
                return ownedCards.length > 0;
              });
              
              const ownedTotalEur = ownedCardsInView.reduce((sum, card) => {
                const ownedCards = collection.filter(item => item.id === card.id);
                const cardQty = ownedCards.reduce((qtySum, item) => qtySum + item.qty, 0);
                const cardPrice = parseFloat(card.prices?.eur || card.prices?.eur_foil || "0");
                return sum + (cardPrice * cardQty);
              }, 0);
              
              // Beregn verdien av kortene du mangler - kun fra de som vises (filtrerte)
              const missingCardsInView = filteredCards.filter(card => {
                const ownedCards = collection.filter(item => item.id === card.id);
                const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                return ownedQty === 0;
              });
              
              const missingTotalEur = missingCardsInView.reduce((sum, card) => {
                const cardPrice = parseFloat(card.prices?.eur || card.prices?.eur_foil || "0");
                return sum + cardPrice;
              }, 0);
              
              const totalSetNok = totalSetEur * eurToNok;
              const ownedTotalNok = ownedTotalEur * eurToNok;
              const missingTotalNok = missingTotalEur * eurToNok;
              
              return (
                <div className="flex items-center gap-4 text-xs">
                  {totalSetEur > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Totalt:</span>
                      <span className="font-medium text-gray-900">
                        €{totalSetEur.toFixed(2)} / {totalSetNok.toFixed(0)} NOK
                      </span>
                    </div>
                  )}
                  {ownedTotalEur > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Eier:</span>
                      <span className="font-medium text-green-700">
                        €{ownedTotalEur.toFixed(2)} / {ownedTotalNok.toFixed(0)} NOK
                      </span>
                    </div>
                  )}
                  {missingTotalEur > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Mangler:</span>
                      <span className="font-medium text-red-600">
                        €{missingTotalEur.toFixed(2)} / {missingTotalNok.toFixed(0)} NOK
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          
          {errorMsg && (
            <span className="text-xs text-red-600">
              {errorMsg} <Button variant="outline" onClick={() => window.location.reload()}>Prøv igjen</Button>
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Toggle
            checked={showAllVariations}
            onChange={setShowAllVariations}
            label={showAllVariations ? "Alle variasjoner" : "Unike navn"}
          />
          <Toggle
            checked={showOnlyMissing}
            onChange={setShowOnlyMissing}
            label={showOnlyMissing ? "Kun mangler" : "Alle kort"}
          />
          <Toggle
            checked={showListView}
            onChange={setShowListView}
            label={showListView ? "Liste" : "Bilder"}
          />
        </div>
      </div>

      {loading && cards.length === 0 && (
        <div className="text-sm text-gray-600">Laster kort …</div>
      )}

      {!loading && cards.length === 0 && !errorMsg && (
        <div className="text-sm text-gray-600">Ingen kort funnet.</div>
      )}

      {showListView ? (
        // Liste-visning
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === 'name') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('name');
                      setSortDirection('asc');
                    }
                  }}
                >
                  Kort {sortBy === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === 'collector_number') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('collector_number');
                      setSortDirection('asc');
                    }
                  }}
                >
                  CN {sortBy === 'collector_number' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === 'rarity') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('rarity');
                      setSortDirection('asc');
                    }
                  }}
                >
                  Raritet {sortBy === 'rarity' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === 'price') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('price');
                      setSortDirection('desc'); // Start med høyest pris
                    }
                  }}
                >
                  Pris {sortBy === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === 'owned') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('owned');
                      setSortDirection('desc'); // Start med høyest antall eid
                    }
                  }}
                >
                  Eier {sortBy === 'owned' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handlinger</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cards.filter((c) => {
                // Hvis "Kun mangler" er aktivert, vis bare kort som ikke er i samlingen
                if (showOnlyMissing) {
                  if (showAllVariations) {
                    // Når vi viser alle variasjoner: sjekk kun denne spesifikke ID-en
                    const ownedCards = collection.filter(item => item.id === c.id);
                    const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                    return ownedQty === 0; // Vis bare kort som ikke eies
                  } else {
                    // Når vi viser unike navn: sjekk om vi eier NOEN variant av kortet
                    const ownedAnyVariant = collection.some(item => {
                      const matches = item.name === c.name && item.set === c.set;
                      if (c.name === "Haliya, Guided by Light") {
                        console.log(`Checking ${c.name} #${c.collector_number}:`, {
                          card: { name: c.name, set: c.set, cn: c.collector_number },
                          collectionItem: { name: item.name, set: item.set, cn: item.collector_number },
                          matches
                        });
                      }
                      return matches;
                    });
                    return !ownedAnyVariant; // Vis bare kort der vi ikke eier noen variant
                  }
                }
                return true; // Vis alle kort
              })
              .sort((a, b) => {
                if (sortBy === 'name') {
                  const comparison = a.name.localeCompare(b.name);
                  return sortDirection === 'asc' ? comparison : -comparison;
                } else if (sortBy === 'price') {
                  const priceA = parseFloat(a.prices?.eur || a.prices?.eur_foil || "0");
                  const priceB = parseFloat(b.prices?.eur || b.prices?.eur_foil || "0");
                  return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
                } else if (sortBy === 'collector_number') {
                  const cnA = parseCN(a.collector_number);
                  const cnB = parseCN(b.collector_number);
                  if (cnA.n !== cnB.n) {
                    return sortDirection === 'asc' ? cnA.n - cnB.n : cnB.n - cnA.n;
                  }
                  const strComparison = cnA.s.localeCompare(cnB.s);
                  return sortDirection === 'asc' ? strComparison : -strComparison;
                } else if (sortBy === 'rarity') {
                  const rarityOrder = { common: 1, uncommon: 2, rare: 3, mythic: 4, special: 5, bonus: 5 };
                  const rarityA = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
                  const rarityB = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
                  return sortDirection === 'asc' ? rarityA - rarityB : rarityB - rarityA;
                } else if (sortBy === 'owned') {
                  const ownedA = collection.filter(item => item.id === a.id).reduce((sum, item) => sum + item.qty, 0);
                  const ownedB = collection.filter(item => item.id === b.id).reduce((sum, item) => sum + item.qty, 0);
                  return sortDirection === 'asc' ? ownedA - ownedB : ownedB - ownedA;
                }
                return 0;
              })
              .map((c) => {
                const ownedCards = collection.filter(item => item.id === c.id);
                const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                const cardPrice = parseFloat(c.prices?.eur || c.prices?.eur_foil || "0");
                const priceNok = eurToNok ? cardPrice * eurToNok : 0;

                return (
                  <tr key={`list-${c.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.type_line}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">#{c.collector_number}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        c.rarity === 'mythic' ? 'bg-red-100 text-red-800' :
                        c.rarity === 'rare' ? 'bg-yellow-100 text-yellow-800' :
                        c.rarity === 'uncommon' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {c.rarity}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cardPrice > 0 ? (
                        <div>
                          <div>€{cardPrice.toFixed(2)}</div>
                          {eurToNok && <div className="text-xs text-gray-500">{priceNok.toFixed(0)} NOK</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ownedQty > 0 ? (
                        <span className="text-green-600 font-medium">{ownedQty}x</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => addToCollection(c, 'nonfoil')}
                        className="text-blue-600 hover:text-blue-900 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                      >
                        +Normal
                      </button>
                      <button
                        onClick={() => addToCollection(c, 'foil')}
                        className="text-purple-600 hover:text-purple-900 text-xs bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded"
                      >
                        +Foil
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Bild-visning (eksisterende)
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.filter((c) => {
            // Hvis "Kun mangler" er aktivert, vis bare kort som ikke er i samlingen
            if (showOnlyMissing) {
              if (showAllVariations) {
                // Når vi viser alle variasjoner: sjekk kun denne spesifikke ID-en
                const ownedCards = collection.filter(item => item.id === c.id);
                const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
                return ownedQty === 0; // Vis bare kort som ikke eies
              } else {
                // Når vi viser unike navn: sjekk om vi eier NOEN variant av kortet
                const ownedAnyVariant = collection.some(item => {
                  const matches = item.name === c.name && item.set === c.set;
                  if (c.name === "Haliya, Guided by Light") {
                    console.log(`[IMG] Checking ${c.name} #${c.collector_number}:`, {
                      card: { name: c.name, set: c.set, cn: c.collector_number },
                      collectionItem: { name: item.name, set: item.set, cn: item.collector_number },
                      matches
                    });
                  }
                  return matches;
                });
                return !ownedAnyVariant; // Vis bare kort der vi ikke eier noen variant
              }
            }
            return true; // Vis alle kort
          }).map((c) => {
    const finishes = (c.finishes as string[] | undefined) ?? ["nonfoil", "foil"];

    // Enkel matching på Scryfall ID
    const ownedCards = collection.filter(item => item.id === c.id);
    const ownedQty = ownedCards.reduce((sum, item) => sum + item.qty, 0);
    
    // Regn ut antall per finish
    const ownedByFinish: Record<string, number> = {};
    for (const finish of finishes) {
      ownedByFinish[finish] = ownedCards
        .filter(item => item.finish === finish)
        .reduce((sum, item) => sum + item.qty, 0);
    }


    return (
      <ResultCard
        key={`set-${c.id}`}
        card={c}
        onAdd={(f) => addToCollection(c, f)}
        ownedQty={ownedQty}
        ownedByFinish={ownedByFinish}
        onDecrement={(f) => decrementOne(`${c.id}::${f}`)}
        eurToNok={eurToNok ?? undefined}
      />
    );
  })}
        </div>
      )}

      {next && (
        <div className="flex justify-center mt-6">
          <Button onClick={() => loadPage(next!)}>Last inn flere</Button>
        </div>
      )}
    </div>
  );
}
