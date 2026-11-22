"use client";

// Dependency-free SVG/CSS charts. Colours come from theme tokens, so they follow dark mode.

import Link from "next/link";
import { cn, formatINR } from "@/lib/utils";

/** Horizontal funnel: bar width = count, with the step-to-step conversion shown on the right. */
export function FunnelChart({ steps }: { steps: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : 0;
        const conv = i > 0 && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <Link key={s.key} href={`/leads?step=${s.key}`} className="group hover:bg-muted/60 -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors">
            <div className="text-muted-foreground w-28 shrink-0 text-sm sm:w-36">{s.label}</div>
            <div className="bg-muted relative h-8 flex-1 overflow-hidden rounded-md">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{
                  width: `${Math.max((s.value / max) * 100, s.value ? 3 : 0)}%`,
                  background: `color-mix(in oklch, var(--chart-1) ${100 - i * 9}%, var(--chart-2))`,
                }}
              />
            </div>
            <div className="w-8 text-right text-sm font-semibold tabular-nums">{s.value}</div>
            <div className="text-muted-foreground w-10 text-right text-xs tabular-nums">{conv === null ? "" : `${conv}%`}</div>
          </Link>
        );
      })}
      <div className="text-muted-foreground pl-1 text-[11px]">Right column: share that moved on from the step above.</div>
    </div>
  );
}

/** Vertical bars with value labels. */
export function BarChart({ data, format = formatINR, height = 160 }: { data: { label: string; value: number; color: string }[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="flex items-end justify-around gap-4" style={{ height: height + 44 }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="text-xs font-semibold tabular-nums">{format(d.value)}</div>
          <div className="flex w-full max-w-16 items-end" style={{ height }}>
            <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${Math.max((Math.abs(d.value) / max) * 100, d.value ? 2 : 0)}%`, background: d.color }} />
          </div>
          <div className="text-muted-foreground truncate text-center text-xs">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Donut showing parts of a whole, with the centre label. */
export function Donut({
  parts, centerLabel, centerValue, size = 148,
}: { parts: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={centerLabel}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--muted)" strokeWidth="16" />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                style={{ transition: "stroke-dasharray 0.5s" }}
              />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
          {centerValue}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-muted-foreground text-[8px]">
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-semibold tabular-nums">{formatINR(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A thin meter, e.g. share of leads that became bookings. */
export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("bg-muted h-1.5 overflow-hidden rounded-full", className)}>
      <div className="bg-brand h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
