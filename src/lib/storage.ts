import type { OwnedCard, ScryfallCard } from "../types";

export const SETTINGS_KEY = "mtg_settings_v1";

export function getCardImage(card: ScryfallCard): string | undefined {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces && card.card_faces[0]?.image_uris?.normal)
    return card.card_faces[0].image_uris!.normal;
}

export function makeOwnedKey(card: ScryfallCard, finish: OwnedCard["finish"]) {
  return `${card.id}::${finish}`;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { groupPrints: false };
    return JSON.parse(raw) as { groupPrints: boolean };
  } catch {
    return { groupPrints: false };
  }
}

export function saveSettings(s: { groupPrints: boolean }) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}