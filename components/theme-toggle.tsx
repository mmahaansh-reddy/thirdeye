"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// Theme lives on <html class="dark">, set before paint by the inline script in layout.tsx.
const KEY = "thirdeye:theme";
const subs = new Set<() => void>();
const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(KEY, dark ? "dark" : "light");
  } catch {}
  subs.forEach((f) => f());
}

export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    isDark,
    () => false
  );
  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={className ?? "flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100"}
    >
      {dark ? <Sun className="size-3" /> : <Moon className="size-3" />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
