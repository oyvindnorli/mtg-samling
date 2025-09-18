import React from "react";
import Progress from "./Progress";

type Bucket = { owned: number; total: number };
type Props = {
  common:   Bucket;
  uncommon: Bucket;
  rare:     Bucket;
  mythic:   Bucket;
};
export default function RarityBars({ common, uncommon, rare, mythic }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Progress value={common.owned}   max={common.total}   label={`Common ${common.owned}/${common.total}`} />
      <Progress value={uncommon.owned} max={uncommon.total} label={`Uncommon ${uncommon.owned}/${uncommon.total}`} />
      <Progress value={rare.owned}     max={rare.total}     label={`Rare ${rare.owned}/${rare.total}`} />
      <Progress value={mythic.owned}   max={mythic.total}   label={`Mythic ${mythic.owned}/${mythic.total}`} />
    </div>
  );
}
