import React from "react";
import QuantityPicker from "./QuantityPicker";
import Button from "./Button";
import Badge from "./Badge";
import type { OwnedCard } from "../types";

export default function CollectionList({
  items,
  onChangeQty,
  onRemove,
  size = "normal",
  showHeader = true,
}: {
  items: OwnedCard[];
  onChangeQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  size?: "normal" | "small";
  showHeader?: boolean;
}) {
  const thumb = size === "small" ? "h-10 w-8" : "h-14 w-10";

  return (
    <aside className="mt-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {showHeader && (
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Samlingen din</h2>
            <Badge>{items.reduce((s, c) => s + c.qty, 0)} kort</Badge>
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">Tom samling.</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.key} className="flex gap-3 p-2 rounded-xl hover:bg-gray-50 items-center">
                {item.image ? (
                  <img src={item.image} alt={item.name} className={`${thumb} rounded-lg object-cover`} />
                ) : (
                  <div className={`${thumb} rounded-lg bg-gray-200`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {item.set.toUpperCase()} · #{item.collector_number} · {item.finish}
                  </div>
                </div>
                <QuantityPicker value={item.qty} onChange={(q) => onChangeQty(item.key, q)} />
                <Button variant="ghost" onClick={() => onRemove(item.key)} className="ml-2">
                  Fjern
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
