import React from "react";
export type Toast = { id: number; text: string };
export default function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className="rounded-xl bg-black text-white px-3 py-2 shadow">
          {t.text}
        </div>
      ))}
    </div>
  );
}
