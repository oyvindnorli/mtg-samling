import React from "react";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100">
      {children}
    </span>
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }
) {
  const { className = "", variant = "primary", ...rest } = props;
  const base =
    "px-3 py-2 rounded-2xl text-sm font-medium shadow-sm transition hover:shadow focus:outline-none focus:ring";
  const variants: Record<string, string> = {
    primary: "bg-black text-white",
    ghost: "bg-transparent text-black hover:bg-gray-100",
    outline: "bg-white border border-gray-300 hover:bg-gray-50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 select-none cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-black" : "bg-gray-300"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </span>
    </label>
  );
}

export function QuantityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-gray-300 overflow-hidden">
      <button className="px-2 py-1 text-lg" onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <span className="px-3 text-sm w-8 text-center">{value}</span>
      <button className="px-2 py-1 text-lg" onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}