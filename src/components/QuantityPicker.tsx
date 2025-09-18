import React from "react";
export default function QuantityPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-gray-300 overflow-hidden">
      <button className="px-2 py-1 text-lg" onClick={() => onChange(Math.max(1, value - 1))}>
        −
      </button>
      <span className="px-3 text-sm w-8 text-center">{value}</span>
      <button className="px-2 py-1 text-lg" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
