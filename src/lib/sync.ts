import type { OwnedCard, DbCollectionItem } from "../types";

export const SYNC_DEBOUNCE_MS = 800;

export function toDb(userId: string, item: OwnedCard): DbCollectionItem {
  return {
    user_id: userId,
    key: item.key,
    id_card: item.id,
    name: item.name,
    set: item.set,
    set_name: item.set_name,
    collector_number: item.collector_number,
    finish: item.finish,
    qty: item.qty,
    image: item.image ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function fromDb(row: DbCollectionItem): OwnedCard {
  return {
    key: row.key,
    id: row.id_card,
    name: row.name,
    set: row.set,
    set_name: row.set_name,
    collector_number: row.collector_number,
    finish: row.finish,
    qty: row.qty,
    image: row.image ?? undefined,
  };
}

export function mergeCollections(local: OwnedCard[], remote: OwnedCard[]): OwnedCard[] {
  const map = new Map<string, OwnedCard>();
  for (const r of remote) map.set(r.key, { ...r });
  for (const l of local) {
    const prev = map.get(l.key);
    if (!prev) map.set(l.key, { ...l });
    else map.set(l.key, { ...prev, qty: prev.qty + l.qty });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}