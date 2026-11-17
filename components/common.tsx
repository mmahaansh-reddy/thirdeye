"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookingStatus, DB, EntityType } from "@/lib/types";
import type { Result } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BOOKING_STATUS_LABEL } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({
  label, value, hint, tone = "default", href,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "good" | "bad" | "warn"; href?: string }) {
  const body = (
    <Card className={cn("gap-1 py-4", href && "hover:border-ring transition-colors")}>
      <CardContent>
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "good" && "text-success",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-[oklch(0.55_0.14_60)]"
          )}
        >
          {value}
        </div>
        {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const BOOKING_TONE: Record<BookingStatus, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  pending_seller: "warning",
  seller_accepted: "secondary",
  confirmed: "secondary",
  advance_paid: "secondary",
  fully_paid: "success",
  fulfilled: "success",
  vendor_settled: "success",
  closed: "outline",
  cancelled: "destructive",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={BOOKING_TONE[status]}>{BOOKING_STATUS_LABEL[status]}</Badge>;
}

export function Loading() {
  return <div className="text-muted-foreground p-8 text-sm">Loading data…</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{children}</div>;
}

/** Wraps an action call and shows its error (including rule violations) inline. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = (r: Result, onOk?: (id?: string) => void) => {
    if (r.ok) {
      setError(null);
      onOk?.(r.id);
    } else setError(r.error);
    return r.ok;
  };
  return { error, setError, run };
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</div>;
}

export const userName = (db: DB, id?: string) => db.users.find((u) => u.id === id)?.name ?? id ?? "—";

export function entityHref(db: DB, type: EntityType, id: string): string | null {
  switch (type) {
    case "lead":
      return `/leads#${id}`;
    case "request":
      return `/leads?request=${id}`;
    case "quote": {
      const q = db.quotes.find((x) => x.id === id);
      return q ? `/leads?request=${q.requestId}` : null;
    }
    case "booking":
      return `/bookings/${id}`;
    case "change_request": {
      const c = db.changeRequests.find((x) => x.id === id);
      return c ? `/bookings/${c.bookingId}` : null;
    }
    case "vendor":
      return "/vendors";
    default:
      return null;
  }
}

export function EntityLink({ db, type, id }: { db: DB; type: EntityType; id: string }) {
  const href = entityHref(db, type, id);
  return href ? (
    <Link className="font-mono text-xs underline-offset-2 hover:underline" href={href}>
      {id}
    </Link>
  ) : (
    <span className="font-mono text-xs">{id}</span>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
