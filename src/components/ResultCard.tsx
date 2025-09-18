import React from "react";
import { Link } from "react-router-dom";
import type { ScryfallCard } from "../types";
import Badge from "./Badge";
import Button from "./Button";
import { getCardImage } from "../utils/scryfall";

function parseNum(s?: string | null): number | null {
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function fmtEUR(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function fmtNOK(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

export default function ResultCard({
  card,
  onAdd,
  linkToSet,
  ownedQty = 0,
  ownedByFinish,
  onDecrement,
  eurToNok, // <— kurs
}: {
  card: ScryfallCard;
  onAdd: (finish: string) => void;
  linkToSet?: boolean;
  ownedQty?: number;
  ownedByFinish?: Record<string, number>;
  onDecrement?: (finish: string) => void;
  eurToNok?: number;
}) {
  const img = getCardImage(card);
  const finishes: string[] = (card.finishes as any) || ["nonfoil", "foil"];
  const setLink = `/set/${card.set}?name=${encodeURIComponent(card.set_name)}`;
  const owned = ownedQty > 0;

  const eurRaw = parseNum(card.prices?.eur);
  const eurFoilRaw = parseNum(card.prices?.eur_foil);
  const cmLink = card.purchase_uris?.cardmarket || card.related_uris?.cardmarket;

  const eur = fmtEUR(eurRaw);
  const eurFoil = fmtEUR(eurFoilRaw);
  const nok = eurToNok && eurRaw != null ? fmtNOK(eurRaw * eurToNok) : null;
  const nokFoil = eurToNok && eurFoilRaw != null ? fmtNOK(eurFoilRaw * eurToNok) : null;

  return (
    <div className={`relative group rounded-2xl border bg-white p-3 shadow-sm hover:shadow-md transition flex flex-col ${owned ? "border-emerald-500" : "border-gray-200"}`}>
      {/* Eid-badge */}
      {owned && (
        <div className="absolute left-2 top-2 rounded-md bg-emerald-600/90 text-white text-[11px] px-2 py-0.5">
          ✓ I samling{ownedQty > 1 ? ` (${ownedQty})` : ""}
        </div>
      )}

      {img ? (
        <img src={img} alt={card.name} className="rounded-xl mb-3 aspect-[2.5/3.5] object-cover" />
      ) : (
        <div className="rounded-xl bg-gray-100 h-48 mb-3 flex items-center justify-center text-gray-500 text-sm">Ingen bilde</div>
      )}

      <div className="flex-1">
        <div className="font-semibold leading-tight mb-1">{card.name}</div>
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-mono mr-1">{card.set.toUpperCase()}</span>·{" "}
          {linkToSet ? (
            <Link to={setLink} className="underline underline-offset-2 hover:text-black">{card.set_name}</Link>
          ) : (
            <span>{card.set_name}</span>
          )} {" "}· #{card.collector_number}
        </div>

        {/* Finish-badges (viser evt. antall pr finish) */}
        <div className="flex flex-wrap gap-2 mb-2">
          {finishes.map((f) => (
            <Badge key={f}>
              {f}{ownedByFinish && ownedByFinish[f] ? ` (${ownedByFinish[f]})` : ""}
            </Badge>
          ))}
        </div>

        {/* Cardmarket-priser: EUR + NOK + lenke */}
        {(eur || eurFoil || cmLink) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <span className="text-gray-500">Cardmarket:</span>
            {eur && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5">
                {eur}{nok ? ` · ${nok}` : ""}
              </span>
            )}
            {eurFoil && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5">
                Foil {eurFoil}{nokFoil ? ` · ${nokFoil}` : ""}
              </span>
            )}
            {cmLink && (
              <a href={cmLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-600 hover:text-black underline underline-offset-2" title="Åpne på Cardmarket">
                åpne
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M12.5 3.75a.75.75 0 000 1.5h1.69l-6.72 6.72a.75.75 0 101.06 1.06l6.72-6.72v1.69a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75h-3z" />
                  <path d="M6.25 5A2.25 2.25 0 004 7.25v7.5A2.25 2.25 0 006.25 17h7.5A2.25 2.25 0 0016 14.75V11a.75.75 0 00-1.5 0v3.75a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-7.5a.75.75 0 01.75-.75H10a.75.75 0 000-1.5H6.25z" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Handling */}
      <div className="mt-auto flex flex-col gap-2">
        {finishes.map((f) => {
          const q = ownedByFinish?.[f] ?? 0;
          return (
            <div key={f} className="flex items-center gap-2">
              <Button onClick={() => onAdd(f)} className="flex-1">Legg til {f}</Button>
              {q > 0 && onDecrement && (
                <>
                  <Button variant="outline" onClick={() => onDecrement(f)} title="Trekk fra 1">−</Button>
                  <span className="text-xs text-gray-600 w-10 text-right">{q} stk</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
