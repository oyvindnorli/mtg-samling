import React from "react";
export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100">
      {children}
    </span>
  );
}
