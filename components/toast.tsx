"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";

// Tiny toast store: call toast("Saved") from anywhere (client side).
interface T { id: number; text: string }
let items: T[] = [];
let n = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string) {
  const id = ++n;
  items = [...items, { id, text }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 2600);
}

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};
const empty: T[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => empty);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast-in bg-card text-card-foreground flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg">
          <CheckCircle2 className="text-success size-4" />
          {t.text}
        </div>
      ))}
    </div>
  );
}
