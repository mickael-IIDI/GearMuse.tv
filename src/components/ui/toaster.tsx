"use client";

import { useEffect, useState } from "react";

export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      setItems((s) => [...s.slice(-2), { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener("vc:toast", on);
    return () => window.removeEventListener("vc:toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg shadow-lg">
          {t.text}
        </div>
      ))}
    </div>
  );
}
