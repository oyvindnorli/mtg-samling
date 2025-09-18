import React from "react";
import type { OwnedCard } from "../types";
import { Button, QuantityPicker } from "./UI";

export default function CollectionItem({ item, onChangeQty, onRemove }: { item: OwnedCard; onChangeQty: (qty: number) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-3 p-2 rounded-xl hover:bg-gray-50 items-center">
      {item.image ? (
        <img src={item.image} alt={item.name} className="h-14 w-10 rounded-lg object-cover" />
      ) : (
        <div className="h-14 w-10 rounded-lg bg-gray-200" />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{item.name}</div>
        <div className="text-xs text-gray-600 truncate">
          {item.set.toUpperCase()} · {item.set_name} · #{item.collector_number} · {item.finish}
        </div>
      </div>
      <QuantityPicker value={item.qty} onChange={onChangeQty} />
      <Button variant="ghost" onClick={onRemove} className="ml-2">Fjern</Button>
    </div>
  );
}