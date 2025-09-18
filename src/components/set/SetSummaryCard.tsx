import React from "react";
import { Link } from "react-router-dom";
import Progress from "../Progress";
import RarityBars from "../RarityBars";

type RarityBuckets = {
  common:   { owned: number; total: number };
  uncommon: { owned: number; total: number };
  rare:     { owned: number; total: number };
  mythic:   { owned: number; total: number };
};

type Props = {
  code: string;
  name: string;
  year?: string;
  icon?: string;             // icon_svg_uri
  setId?: string;            // for lenke /set/:id (fallback til code)
  ownedUniqueNumbers: number;
  totalUniqueNumbers: number;
  ownedUniqueNames: number;
  totalUniqueNames: number;
  totalOwnedQty: number;     // sum antall kort du har i dette settet
  rarity: RarityBuckets;
  nokRemainingForFullNameSet?: number | null; // valgfritt
};

export default function SetSummaryCard({
  code, name, year, icon, setId,
  ownedUniqueNumbers, totalUniqueNumbers,
  ownedUniqueNames, totalUniqueNames,
  totalOwnedQty, rarity,
  nokRemainingForFullNameSet
}: Props) {
  const link = `/set/${setId || code}`;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        {icon ? <img src={icon} alt="" className="h-6 w-6" /> : <div className="h-6 w-6 bg-gray-200 rounded" />}
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold">{name} <span className="font-mono text-gray-500">({code.toUpperCase()})</span></div>
          {year && <div className="text-xs text-gray-500">{year}</div>}
        </div>
        <Link to={link} className="text-sm underline underline-offset-2">Åpne</Link>
      </div>

      {/* Total: unike nummer */}
      <div className="mb-3">
        <Progress
          value={ownedUniqueNumbers}
          max={totalUniqueNumbers}
          label={`Unike # ${ownedUniqueNumbers} / ${totalUniqueNumbers} · ${totalOwnedQty} stk totalt`}
        />
      </div>

      {/* Unike navn (egen bar) */}
      <div className="mb-4">
        <Progress
          value={ownedUniqueNames}
          max={totalUniqueNames}
          label={`Unike navn ${ownedUniqueNames} / ${totalUniqueNames}`}
        />
      </div>

      <RarityBars {...rarity} />

      {typeof nokRemainingForFullNameSet === "number" && (
        <div className="text-xs text-gray-600 mt-3">
          Gjenstår (navn): {nokRemainingForFullNameSet.toLocaleString("no-NO")} kr
        </div>
      )}
    </div>
  );
}
