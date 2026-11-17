"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDB } from "@/lib/store";
import type { Booking, BookingStatus } from "@/lib/types";
import { bookingFinance, originalValue } from "@/lib/finance";
import { BOOKING_FLOW, BOOKING_STATUS_LABEL } from "@/lib/workflow";
import { useNow } from "@/lib/use-now";
import { cn, formatDate, formatDuration, formatINR, formatPct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataList, type Column } from "@/components/data-list";
import { BookingStatusBadge, Chip, Empty, Loading, PageHeader, userName } from "@/components/common";

export default function BookingsPage() {
  const db = useDB();
  const router = useRouter();
  const now = useNow(30_000);
  const [stage, setStage] = useState<"all" | "active" | BookingStatus>("all");
  const [showLost, setShowLost] = useState(false);
  if (!db) return <Loading />;

  // Active = anything not yet closed or cancelled.
  const isActive = (b: Booking) => b.status !== "closed" && b.status !== "cancelled";
  const stages: BookingStatus[] = [...BOOKING_FLOW, "cancelled"];
  // Bookings whose customer is marked "lost" on the Leads and Bookings page are hidden here (unless revealed below).
  const isLost = (b: Booking) => db.leads.find((l) => l.id === b.leadId)?.status === "lost";
  const hidden = db.bookings.filter(isLost);
  const visible = showLost ? db.bookings : db.bookings.filter((b) => !isLost(b));
  const shown = visible.filter((b) => (stage === "all" ? true : stage === "active" ? isActive(b) : b.status === stage));

  const columns: Column<Booking>[] = [
    {
      header: "Booking",
      card: "title",
      cell: (b) => (
        <span>
          <Link href={`/bookings/${b.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
            {b.id}
          </Link>
          <span className="text-muted-foreground ml-1.5 text-xs">v{b.version}</span>
        </span>
      ),
    },
    {
      header: "Customer",
      cell: (b) => {
        const presales = db.requests.find((r) => r.id === b.requestId)?.presales;
        return (
          <div>
            <div className="font-medium">{db.leads.find((l) => l.id === b.leadId)?.customerName}</div>
            <div className="text-muted-foreground text-xs">Owner: {userName(db, b.ownerId)}</div>
            <div className="text-muted-foreground text-xs">Pre-sales: {presales ? userName(db, presales.assigneeId) : "—"}</div>
          </div>
        );
      },
    },
    {
      header: "Stage",
      cell: (b) => {
        const f = bookingFinance(db, b);
        const pendingCR = db.changeRequests.some((c) => c.bookingId === b.id && c.status === "pending");
        const since = b.statusHistory[b.statusHistory.length - 1]?.at ?? b.createdAt;
        const depth = BOOKING_FLOW.indexOf(b.status);
        const ended = b.status === "closed" || b.status === "cancelled";
        return (
          <div>
            <div className="flex flex-wrap items-center gap-1">
              <BookingStatusBadge status={b.status} />
              {!ended && <span className="text-muted-foreground text-xs">· {formatDuration(now - new Date(since).getTime())}</span>}
              {pendingCR && <Badge variant="warning">CR pending</Badge>}
              {f.flaggedMargin !== 0 && <Badge variant="destructive">flagged vendor</Badge>}
            </div>
            <div className="mt-1.5 flex gap-0.5" aria-label={`Step ${Math.max(depth, 0) + 1} of ${BOOKING_FLOW.length}`}>
              {BOOKING_FLOW.map((s, i) => (
                <span key={s} className={cn("h-1.5 w-3 rounded-full", b.status === "cancelled" ? "bg-destructive/30" : i <= depth ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
          </div>
        );
      },
    },
    {
      header: "Value / received",
      align: "right",
      cell: (b) => {
        const f = bookingFinance(db, b);
        return (
          <>
            <div>{formatINR(f.booked.gross)}</div>
            <div className="text-muted-foreground text-xs">{formatINR(f.received)} received</div>
            {b.version > 1 && <div className="text-muted-foreground text-xs">original {formatINR(originalValue(b).gross)}</div>}
          </>
        );
      },
    },
    {
      header: "Booked margin",
      align: "right",
      cell: (b) => {
        const f = bookingFinance(db, b);
        return (
          <>
            <div>{formatINR(f.booked.margin)}</div>
            <div className="text-muted-foreground text-xs">{formatPct(f.booked.marginPct)}</div>
          </>
        );
      },
    },
    {
      header: "Changes",
      align: "right",
      stop: true,
      cell: (b) => {
        const n = db.changeRequests.filter((c) => c.bookingId === b.id).length;
        return n ? (
          <Link href={`/bookings/${b.id}#changes`} className="underline-offset-2 hover:underline">
            {n}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    { header: "Created", cell: (b) => <span className="text-muted-foreground text-xs">{formatDate(b.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Ongoing Bookings" description="Created only from an accepted quote. Changes go through versioned change requests." />
      {visible.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={stage === "all"} onClick={() => setStage("all")} label="All" n={visible.length} />
          <Chip active={stage === "active"} onClick={() => setStage("active")} label="Active" n={visible.filter(isActive).length} />
          {stages.map((s) => (
            <Chip key={s} active={stage === s} onClick={() => setStage(s)} label={BOOKING_STATUS_LABEL[s]} n={visible.filter((b) => b.status === s).length} />
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <Empty>{db.bookings.length === 0 ? "No bookings yet. Accept a quote to create one." : "No ongoing bookings. All remaining bookings belong to customers marked lost."}</Empty>
      ) : shown.length === 0 ? (
        <Empty>No bookings at this stage.</Empty>
      ) : (
        <DataList rows={shown} columns={columns} rowKey={(b) => b.id} onRowClick={(b) => router.push(`/bookings/${b.id}`)} breakpoint="xl" />
      )}
      {hidden.length > 0 && (
        <p className="text-muted-foreground mt-3 text-xs">
          {hidden.length} booking{hidden.length === 1 ? " is" : "s are"} {showLost ? "shown" : "hidden"} because the customer is marked lost on the Leads and Bookings page.{" "}
          <button className="underline underline-offset-2" onClick={() => setShowLost(!showLost)}>
            {showLost ? "Hide them" : "Show them"}
          </button>
        </p>
      )}
    </>
  );
}
