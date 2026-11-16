"use client";

import Link from "next/link";
import { useDB } from "@/lib/store";
import { bookingFinance } from "@/lib/finance";
import { cn, formatINR } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusBadge, Loading, PageHeader, Stat } from "@/components/common";

export default function FinancePage() {
  const db = useDB();
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sell (pre-GST)</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Quoted margin</TableHead>
                <TableHead className="text-right">Booked margin</TableHead>
                <TableHead className="text-right">Realised</TableHead>
                <TableHead className="text-right">Leakage</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
                <TableHead className="text-right">Receivable</TableHead>
                <TableHead className="text-right">Vendor payable</TableHead>
                <TableHead className="text-right">TDS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ b, f }) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link className="font-mono text-xs underline-offset-2 hover:underline" href={`/bookings/${b.id}`}>
                      {b.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <BookingStatusBadge status={b.status} />
                  </TableCell>
                  <Num v={f.booked.sell} />
                  <Num v={f.booked.gst} />
                  <Num v={f.quoted.margin} />
                  <Num v={f.booked.margin} />
                  <TableCell className="text-right tabular-nums">{f.realisedMargin === null ? "—" : formatINR(f.realisedMargin)}</TableCell>
                  <Num v={f.leakage} bad={f.leakage > 0} />
                  <Num v={f.flaggedMargin} bad={f.flaggedMargin !== 0} />
                  <Num v={f.receivable} />
                  <Num v={f.vendorPayable} />
                  <Num v={f.tdsDeducted} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-muted-foreground mt-3 text-xs">
        Assumptions for this prototype: GST is charged on the full sell price at each line&apos;s rate; TDS is deducted at the vendor&apos;s rate on gross
        vendor payouts. Confirm the exact GST treatment (e.g. margin scheme vs. full value) with your CA before go-live.
      </p>
    </>
  );
}

function Num({ v, bad }: { v: number; bad?: boolean }) {
  return <TableCell className={cn("text-right tabular-nums", bad && "text-destructive font-semibold")}>{formatINR(v)}</TableCell>;
}
