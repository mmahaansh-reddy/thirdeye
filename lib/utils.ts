import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatINR = (n: number) => inr.format(Math.round(n || 0));

export const formatPct = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;

export const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

/** "2d 4h", "3h 20m", "5m" */
export function formatDuration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}
