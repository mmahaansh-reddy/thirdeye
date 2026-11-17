"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { bookingFinance, type BookingFinance } from "@/lib/finance";
import type { Booking } from "@/lib/types";
import { DataList, type Column } from "@/components/data-list";
import { cn, formatINR } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusBadge, Loading, PageHeader, Stat } from "@/components/common";

export default function FinancePage() {
  const db = useDB();
  const router = useRouter();
  if (!db) return <Loading />;
  const rows = db.bookings.filter((b) => b.status !== "cancelled").map((b) => ({ b, f: bookingFinance(db, b) }));
  const sum = (fn: (x: (typeof rows)[number]) => number) => rows.reduce((s, x) => s + fn(x), 0);

  return (
    <>
      <PageHeader
        title="Finance & margins"
        description="Three margins per booking: quoted (at acceptance), booked (after approved changes) and realised (after actual vendor invoices)."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Quoted margin" value={formatINR(sum((x) => x.f.quoted.margin))} />
        <Stat label="Booked margin" value={formatINR(sum((x) => x.f.booked.margin))} />
        <Stat label="Realised margin" value={formatINR(sum((x) => x.f.realisedMargin ?? 0))} hint="invoiced bookings only" tone="good" />
        <Stat label="Leakage" value={formatINR(sum((x) => x.f.leakage))} tone={sum((x) => x.f.leakage) > 0 ? "bad" : "default"} hint="vendor invoices above vendor quotes" />
        <Stat label="GST output" value={formatINR(sum((x) => x.f.booked.gst))} />
        <Stat label="TDS deducted" value={formatINR(sum((x) => x.f.tdsDeducted))} />
        <Stat label="Customer receivable" value={formatINR(sum((x) => x.f.receivable))} tone="warn" />
        <Stat label="Vendor payable" value={formatINR(sum((x) => x.f.vendorPayable))} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Per-booking ledger</CardTitle>
          <CardDescription>Every margin rupee here traces to booking lines and vendor quote references. Click a booking to audit it.</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          <DataList rows={rows} columns={ledgerColumns} rowKey={(x) => x.b.id} onRowClick={(x) => router.push(`/bookings/${x.b.id}`)} breakpoint="xl" bare />
        </CardContent>
      </Card>
      <p className="text-muted-foreground mt-3 text-xs">
        Assumptions for this prototype: GST is charged on the full sell price at each line&apos;s rate; TDS is deducted at the vendor&apos;s rate on gross
        vendor payouts. Confirm the exact GST treatment (e.g. margin scheme vs. full value) with your CA before go-live.
      </p>
    </>
  );
}

type LedgerRow = { b: Booking; f: BookingFinance };

const ledgerColumns: Column<LedgerRow>[] = [
  {
    header: "Booking",
    card: "title",
    cell: ({ b }) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link className="font-mono text-xs underline-offset-2 hover:underline" href={`/bookings/${b.id}`} onClick={(e) => e.stopPropagation()}>
          {b.id}
        </Link>
        <BookingStatusBadge status={b.status} />
      </span>
    ),
  },
  {
    header: "Sell (pre-GST) / GST",
    align: "right",
    cell: ({ f }) => (
      <>
        <div>{formatINR(f.booked.sell)}</div>
        <div className="text-muted-foreground text-xs">GST {formatINR(f.booked.gst)}</div>
      </>
    ),
  },
  {
    header: "Margin: quoted · booked · realised",
    align: "right",
    cell: ({ f }) => (
      <div className="space-y-0.5 text-xs">
        <div>
          <span className="text-muted-foreground">Quoted </span>
          {formatINR(f.quoted.margin)}
        </div>
        <div>
          <span className="text-muted-foreground">Booked </span>
          {formatINR(f.booked.margin)}
        </div>
        <div>
          <span className="text-muted-foreground">Realised </span>
          {f.realisedMargin === null ? "—" : formatINR(f.realisedMargin)}
        </div>
      </div>
    ),
  },
  {
    header: "Leakage / flagged",
    align: "right",
    cell: ({ f }) => (
      <div className="space-y-0.5 text-xs">
        <div className={cn(f.leakage > 0 && "text-destructive font-semibold")}>
          <span className="text-muted-foreground">Leakage </span>
          {formatINR(f.leakage)}
        </div>
        <div className={cn(f.flaggedMargin !== 0 && "text-destructive font-semibold")}>
          <span className="text-muted-foreground">Flagged </span>
          {formatINR(f.flaggedMargin)}
        </div>
      </div>
    ),
  },
  { header: "Receivable", align: "right", cell: ({ f }) => formatINR(f.receivable) },
  {
    header: "Vendor payable / TDS",
    align: "right",
    cell: ({ f }) => (
      <>
        <div>{formatINR(f.vendorPayable)}</div>
        <div className="text-muted-foreground text-xs">TDS {formatINR(f.tdsDeducted)}</div>
      </>
    ),
  },
];

function Num({ v, bad }: { v: number; bad?: boolean }) {
  return <TableCell className={cn("text-right tabular-nums", bad && "text-destructive font-semibold")}>{formatINR(v)}</TableCell>;
}
