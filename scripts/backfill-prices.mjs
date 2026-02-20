import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bkrbomyquyjilzvndtsj.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error("Bruk: SUPABASE_KEY=<din-key> node scripts/backfill-prices.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Hent alle rader
async function fetchAll() {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("mtg_collection_items")
      .select("key,id_card,user_id,finish")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

// Hent prisdata fra Scryfall i batches på 75
async function fetchPrices(cardIds) {
  const map = new Map(); // id → { eur, eur_foil }
  const BATCH = 75;
  for (let i = 0; i < cardIds.length; i += BATCH) {
    const batch = cardIds.slice(i, i + BATCH).map((id) => ({ id }));
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(cardIds.length / BATCH);
    console.log(`  Scryfall batch ${batchNum}/${totalBatches} (${batch.length} kort)...`);

    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: batch }),
    });

    if (!res.ok) {
      console.warn(`  Batch feilet: ${res.status} ${res.statusText}`);
      continue;
    }

    const json = await res.json();
    for (const card of json.data ?? []) {
      const eur = parseFloat(card.prices?.eur ?? "") || null;
      const eurFoil = parseFloat(card.prices?.eur_foil ?? "") || null;
      map.set(card.id, { eur, eurFoil });
    }

    await new Promise((r) => setTimeout(r, 100));
  }
  return map;
}

async function main() {
  console.log("Henter alle kort fra DB...");
  const rows = await fetchAll();
  console.log(`Fant ${rows.length} rader.`);

  if (rows.length === 0) {
    console.log("Ingenting å gjøre!");
    return;
  }

  const uniqueIds = [...new Set(rows.map((r) => r.id_card))];
  console.log(`${uniqueIds.length} unike kort-IDer. Henter priser fra Scryfall...`);

  const priceMap = await fetchPrices(uniqueIds);
  console.log(`Fikk priser for ${priceMap.size} kort.`);

  // Oppdater DB
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const data = priceMap.get(row.id_card);
    if (!data) { skipped++; continue; }

    const price = row.finish === "foil"
      ? (data.eurFoil ?? data.eur)
      : (data.eur ?? data.eurFoil);

    if (price == null) { skipped++; continue; }

    const { error } = await supabase
      .from("mtg_collection_items")
      .update({ price_eur: price })
      .eq("user_id", row.user_id)
      .eq("key", row.key);

    if (error) {
      failed++;
      if (failed <= 3) console.warn(`  Feil: ${error.message} (key=${row.key})`);
    } else {
      updated++;
    }
  }

  console.log(`Ferdig! Oppdatert ${updated} rader. ${skipped} uten pris. ${failed > 0 ? `${failed} feilet.` : ""}`);
}

main().catch((e) => {
  console.error("Feil:", e);
  process.exit(1);
});
