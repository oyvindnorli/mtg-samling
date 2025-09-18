import React from "react";

type Props = { value: number; max: number; label?: string; className?: string };
export default function Progress({ value, max, label, className = "" }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`w-full`}>
      {label && <div className="text-xs text-gray-600 mb-1">{label}</div>}
      <div className={`h-2 rounded-full bg-gray-200 overflow-hidden ${className}`}>
        <div className="h-full bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
