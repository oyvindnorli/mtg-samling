import Dexie, { Table } from "dexie";
import type { OwnedCard } from "../types";

// Rader lagres én per eiet kort (key er unik kombinasjon av cardId + finish)
export type DbOwnedCard = OwnedCard & { updatedAt: number };

class MtgDB extends Dexie {
  collection!: Table<DbOwnedCard, string>; // primærnøkkel = key
  constructor() {
    super("mtg_local_db");
    this.version(1).stores({
      collection: "&key", // & = unique primary key
    });
  }
}

export const db = new MtgDB();

export async function readCollection(): Promise<OwnedCard[]> {
  const rows = await db.collection.toArray();
  return rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ updatedAt, ...rest }) => rest);
}

export async function writeCollection(items: OwnedCard[]): Promise<void> {
  // enkel strategi: skriv hele settet (raskt nok for noen tusen rader)
  await db.transaction("rw", db.collection, async () => {
    await db.collection.clear();
    const now = Date.now();
    await db.collection.bulkPut(items.map((i) => ({ ...i, updatedAt: now })));
  });
}

export async function removeItem(key: string): Promise<void> {
  await db.collection.delete(key);
}

export async function upsertItem(item: OwnedCard): Promise<void> {
  await db.collection.put({ ...item, updatedAt: Date.now() });
}