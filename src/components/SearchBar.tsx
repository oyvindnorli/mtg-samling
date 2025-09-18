import React from "react";
export default function SearchBar({
  value,
  onChange,
  isLoading,
}: {
  value: string;
  onChange: (v: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-gray-300 px-3 py-2 bg-white">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-gray-500">
        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 105.364 10.905l3.74 3.741a.75.75 0 101.06-1.06l-3.74-3.742A6.75 6.75 0 0010.5 3.75zm-5.25 6.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z" clipRule="evenodd"/>
      </svg>
      <input
        className="w-full outline-none text-base"
        placeholder="Søk (name:goblin type:creature set:khm)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isLoading && <span className="text-xs text-gray-500">Laster…</span>}
    </div>
  );
}
