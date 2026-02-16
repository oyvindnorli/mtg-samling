import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./lib/supabase";
import type { DbCollectionItem, OwnedCard, ScryfallCard } from "./types";
import { getCardImage, makeOwnedKey } from "./utils/scryfall";

import ToastStack, { type Toast } from "./components/ToastStack";
import Button from "./components/Button";
import Badge from "./components/Badge";

import HomePage from "./pages/HomePage";
import SetPage from "./pages/SetPage";
import StatisticsPage from "./pages/StatisticsPage";
import CheckListPage from "./pages/CheckListPage";

// -----------------------------
// DB mapping
// -----------------------------
function toDb(userId: string, item: OwnedCard): DbCollectionItem {
  return {
    user_id: userId,
    key: item.key,
    id_card: item.id,
    name: item.name,
    set: item.set,
    set_name: item.set_name,
    collector_number: item.collector_number,
    finish: item.finish,
    rarity: item.rarity ?? null,
    qty: item.qty,
    image: item.image ?? null,
    updated_at: new Date().toISOString(),
  };
}
function fromDb(row: DbCollectionItem): OwnedCard {
  return {
    key: row.key,
    id: row.id_card,
    name: row.name,
    set: row.set,
    set_name: row.set_name,
    collector_number: row.collector_number,
    finish: row.finish,
    rarity: row.rarity ?? undefined,
    qty: row.qty,
    image: row.image ?? undefined,
  };
}

export default function App() {
  // -----------------------------
  // State
  // -----------------------------
  const [collection, setCollection] = useState<OwnedCard[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  
  const [email, setEmail] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  function notify(text: string) {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  }

  // Hydration-vakt: ikke synk før vi har lest fra skyen
  const hydratedRef = useRef(false);
  

  // -----------------------------
  // Auth
  // -----------------------------
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // -----------------------------
  // Hent sky-data ved innlogging (sky = sannhet)
  // -----------------------------
  useEffect(() => {
    if (!supabase || !session) {
      setCollection([]);
      hydratedRef.current = false;
      return;
    }
    (async () => {
      setSyncing(true);
      setLastError(null);
      let allCards: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("mtg_collection_items")
          .select("user_id,key,id_card,name,set,set_name,collector_number,finish,rarity,qty,image,updated_at")
          .eq("user_id", session.user.id)
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (error) {
          setLastError(error.message);
          break;
        }
        
        if (!data || data.length === 0) {
          break;
        }
        
        allCards = [...allCards, ...data];
        
        if (data.length < pageSize) {
          break; // Last page
        }
        
        page++;
      }
      
      if (allCards.length > 0) {
        const mapped = allCards.map(fromDb);
        const mentorOfTheMeekMapped = mapped.filter(item => 
          item.name === 'Mentor of the Meek' && item.set === '2x2' && item.collector_number === '17'
        );
        
        
        setCollection(mapped);
      }
      
      setSyncing(false);
      hydratedRef.current = true;
    })();
  }, [session?.user?.id]); // Only depend on user ID, not entire session object

  // -----------------------------
  // Backfill rarity for eksisterende kort som mangler det
  // -----------------------------
  const backfillDoneRef = useRef(false);

  useEffect(() => {
    if (!supabase || !session) return;
    if (!hydratedRef.current) return;
    if (backfillDoneRef.current) return;

    const missing = collection.filter((c) => !c.rarity);
    if (missing.length === 0) {
      backfillDoneRef.current = true;
      return;
    }

    backfillDoneRef.current = true;
    const uniqueIds = [...new Set(missing.map((c) => c.id))];
    const BATCH = 75;

    (async () => {
      const rarityMap = new Map<string, string>();
      for (let i = 0; i < uniqueIds.length; i += BATCH) {
        const batch = uniqueIds.slice(i, i + BATCH).map((id) => ({ id }));
        try {
          const res = await fetch("https://api.scryfall.com/cards/collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifiers: batch }),
          });
          if (!res.ok) continue;
          const json = await res.json();
          for (const card of json.data ?? []) {
            if (card.rarity) rarityMap.set(card.id, card.rarity);
          }
        } catch {
          // Stille feil - prøv resten
        }
      }

      if (rarityMap.size === 0) return;

      // Oppdater state
      setCollection((prev) =>
        prev.map((c) => {
          const r = rarityMap.get(c.id);
          return r && !c.rarity ? { ...c, rarity: r } : c;
        }),
      );

      // Oppdater DB
      const userId = session.user.id;
      for (const card of missing) {
        const r = rarityMap.get(card.id);
        if (!r) continue;
        await supabase
          .from("mtg_collection_items")
          .update({ rarity: r })
          .eq("user_id", userId)
          .eq("key", card.key);
      }
    })();
  }, [collection, session]);

  // -----------------------------
  // Auto-synk: upsert endringer når collection endres
  // (men KUN etter hydration)
  // -----------------------------
  const syncTimerRef = useRef<number | null>(null);
  const syncInProgressRef = useRef<boolean>(false);
  const needsResyncRef = useRef<boolean>(false);
  
  // TEMPORARILY DISABLED auto-sync to debug loop
  /*
  useEffect(() => {
    if (!supabase || !session) return;
    if (!hydratedRef.current) return; // ikke synk før første sky-read
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    
    // Øk delay for å unngå race conditions
    syncTimerRef.current = window.setTimeout(async () => {
      await syncAllToCloud();
    }, 1000);
    
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [collection, session]);
  */

  async function syncAllToCloud() {
    if (!supabase || !session) return;
    if (!hydratedRef.current) return;
    if (syncInProgressRef.current) {
      needsResyncRef.current = true;
      console.log('⏰ Sync in progress, will retry after');
      return;
    }
    
    console.log('🔄 Starting sync...');
    syncInProgressRef.current = true;
    setSyncing(true);
    setLastError(null);

    const userId = session.user.id;
    const payload = collection.map((i) => toDb(userId, i));
    console.log('📊 Collection length during sync:', collection.length);
    
    // Debug: check if Javelineers is in payload
    const javelineers = payload.find(p => p.name.includes('Javelineers') && p.collector_number === '8b');
    if (javelineers) {
      console.log('📤 Found Javelineers 8b in payload:', javelineers.key);
    } else {
      console.log('❌ Javelineers 8b NOT in payload');
    }

    const { error: upErr } = await supabase
      .from("mtg_collection_items")
      .upsert(payload, { onConflict: "user_id,key" });

    if (upErr) {
      console.log('❌ Sync error:', upErr.message);
    }

    if (upErr) {
      setLastError(upErr.message);
      setSyncing(false);
      syncInProgressRef.current = false;
      return;
    }

    console.log('✅ Sync completed successfully');

    // ⚠️ Viktig: IKKE bulk-slett nøkler som ikke finnes lokalt.
    // Sletting gjøres eksplisitt når bruker fjerner et kort.
    setSyncing(false);
    syncInProgressRef.current = false;
    
    // Hvis det kom ny data mens vi synket, sync igjen
    if (needsResyncRef.current) {
      needsResyncRef.current = false;
      setTimeout(() => syncAllToCloud(), 500);
      console.log('🔄 Scheduling resync...');
    }
  }

  // -----------------------------
  // Samlingsoperasjoner
  // -----------------------------
  async function addToCollection(card: ScryfallCard, finish: string) {
    if (!session) {
      alert("Logg inn for å lagre i sky");
      return;
    }
    
    const key = makeOwnedKey(card, finish);
    const existingCard = collection.find(c => c.key === key);
    let finalQty = 1;
    let isNewCard = !existingCard;
    
    if (existingCard) {
      finalQty = existingCard.qty + 1;
    }

    // Update state
    setCollection((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      
      if (idx >= 0) {
        // Update existing card quantity
        return prev.map((item, index) => 
          index === idx ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        // Add new card
        const owned: OwnedCard = {
          key,
          id: card.id,
          name: card.name,
          set: card.set,
          set_name: card.set_name,
          collector_number: card.collector_number,
          finish,
          rarity: card.rarity,
          qty: 1,
          image: getCardImage(card),
        };
        return [owned, ...prev];
      }
    });

    // Save to database
    const ownedForDb: OwnedCard = {
      key,
      id: card.id,
      name: card.name,
      set: card.set,
      set_name: card.set_name,
      collector_number: card.collector_number,
      finish,
      rarity: card.rarity,
      qty: finalQty,
      image: getCardImage(card),
    };

    if (!supabase) {
      notify('Database ikke tilgjengelig');
      return;
    }

    const { error } = await supabase
      .from("mtg_collection_items")
      .upsert(toDb(session.user.id, ownedForDb), { onConflict: "user_id,key" });

    if (error) {
      notify(`Feil ved lagring: ${error.message}`);
    } else {
      notify(isNewCard ? `Lagt til: ${card.name} (${finish})` : `Økte antall: ${card.name} (${finish})`);
    }
  }

  function updateQty(key: string, qty: number) {
    if (!session) return;
    setCollection((prev) => prev.map((c) => (c.key === key ? { ...c, qty } : c)));
  }

  async function removeOwned(key: string) {
    if (!session) return;
    setCollection((prev) => prev.filter((c) => c.key !== key));
    // Slett samme rad i skyen eksplisitt
    await supabase?.from("mtg_collection_items")
      .delete()
      .eq("user_id", session.user.id)
      .eq("key", key);
    notify("Fjernet fra samlingen");
  }

  async function decrementOne(key: string) {
    if (!session) return;
    
    const currentItem = collection.find(c => c.key === key);
    if (!currentItem) return;
    
    const willBeRemoved = currentItem.qty <= 1;

    // Update state
    setCollection((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx < 0) return prev;
      
      const item = prev[idx];
      if (item.qty <= 1) {
        // Remove item completely
        return prev.filter((_, i) => i !== idx);
      } else {
        // Decrease quantity
        return prev.map((item, index) => 
          index === idx ? { ...item, qty: item.qty - 1 } : item
        );
      }
    });

    // Update database
    if (willBeRemoved) {
      const { error } = await supabase?.from("mtg_collection_items")
        .delete()
        .eq("user_id", session.user.id)
        .eq("key", key) || {};
      
      if (error) {
        notify(`Feil ved sletting: ${error.message}`);
      }
    } else {
      const updatedItem = { ...currentItem, qty: currentItem.qty - 1 };
      const { error } = await supabase?.from("mtg_collection_items")
        .upsert(toDb(session.user.id, updatedItem), { onConflict: "user_id,key" }) || {};
      
      if (error) {
        notify(`Feil ved oppdatering: ${error.message}`);
      }
    }
    
    notify(`Trakk fra: ${currentItem.name} (${currentItem.finish})`);
  }

  // -----------------------------
  // Export / Import (lokal fil)
  // -----------------------------
  function exportJson() {
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mtg_collection.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) setCollection(data as OwnedCard[]);
      } catch {
        alert("Ugyldig JSON");
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <ToastStack toasts={toasts} />

      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl md:text-3xl font-bold tracking-tight hover:opacity-80">
              MTG Samling
            </Link>
            {supabase ? (
              session ? (
                <Badge>Innlogget: {session.user.email ?? session.user.id.slice(0, 8)}</Badge>
              ) : (
                <Badge>Krever innlogging</Badge>
              )
            ) : (
              <Badge>Supabase ikke konfigurert</Badge>
            )}
            {syncing && <span className="text-xs text-gray-500">(lagrer…)</span>}
            {lastError && <span className="text-xs text-red-600">{lastError}</span>}
          </div>
          <div>
            {session ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (supabase) await supabase.auth.signOut();
                }}
              >
                Logg ut
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm w-64"
                  placeholder="Din e-post for magisk lenke"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    if (!supabase) return alert("Supabase ikke konfigurert");
                    if (!email) return alert("Skriv inn e-post");
                    const { error } = await supabase.auth.signInWithOtp({
                      email,
                      options: { emailRedirectTo: window.location.origin },
                    });
                    if (error) alert(error.message);
                    else alert("Sjekk e-posten for innloggingslenke.");
                  }}
                >
                  Send innloggingslenke
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Ruter */}
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                addToCollection={addToCollection}
                exportJson={exportJson}
                onImport={onImport}
                updateQty={updateQty}
                removeOwned={removeOwned}
                decrementOne={decrementOne}
                collection={collection}
              />
            }
          />
          <Route
            path="/set/:code"
            element={
              <SetPage
                addToCollection={addToCollection}
                collection={collection}
                decrementOne={decrementOne}
              />
            }
          />
          <Route
            path="/statistics"
            element={<StatisticsPage collection={collection} />}
          />
          <Route
            path="/check"
            element={<CheckListPage collection={collection} />}
          />
        </Routes>
      </div>
    </div>
  );
}
