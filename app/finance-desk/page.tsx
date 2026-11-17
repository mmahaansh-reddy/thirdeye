"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { financeDesk, type FinRow, type PayoutRow } from "@/lib/finance-desk";
import type { DB, Vendor } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList, type Column } from "@/components/data-list";
import { BookingStatusBadge, Loading, PageHeader, Stat } from "@/components/common";

export default function FinanceDeskPage() {
  const db = useDB();
  const router = useRouter();
  if (!db) return <Loading />;
  const d = financeDesk(db);
  const sum = (fn: (x: FinRow) => number) => d.rows.reduce((s, x) => s + fn(x), 0);
  const go = (id: string, tab: string) => router.push(`/bookings/${id}#${tab}`);

  return (
    <>
      <PageHeader title="Finance desk" description="Everything that needs Finance's attention: money to collect, invoices to record, payouts to make and vendors to approve." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To collect from customers" value={formatINR(sum((x) => x.f.receivable))} tone={d.collect.length ? "warn" : "default"} href="/finance" />
        <Stat label="Owed to vendors" value={formatINR(sum((x) => x.f.vendorPayable))} href="/finance" />
        <Stat label="TDS deducted" value={formatINR(sum((x) => x.f.tdsDeducted))} href="/finance" />
        <Stat label="GST output" value={formatINR(sum((x) => x.f.booked.gst))} href="/finance" />
      </div>

      <div className="mt-6 grid gap-4">
        <Queue title="Collect from customers" count={d.collect.length} hint="Confirmed bookings with money still outstanding" empty="Nothing outstanding.">
          <DataList rows={d.collect} columns={collectColumns(db)} rowKey={(x) => x.b.id} onRowClick={(x) => go(x.b.id, "payments")} breakpoint="md" bare />
        </Queue>

        <Queue title="Vendor invoices to record" count={d.toInvoice.length} hint="Fulfilled bookings where a vendor has not been invoiced yet" empty="All fulfilled bookings are invoiced.">
          <DataList
            rows={d.toInvoice}
            columns={invoiceColumns(db)}
            rowKey={(x) => x.b.id}
            onRowClick={(x) => go(x.b.id, "vendors")}
            breakpoint="md"
            bare
          />
        </Queue>

        <Queue title="Vendor payouts due" count={d.payouts.length} hint="Invoices recorded but not fully paid. TDS is deducted at the vendor's rate" empty="No payouts due.">
          <DataList rows={d.payouts} columns={payoutColumns} rowKey={(x) => `${x.b.id}-${x.vendor?.id}`} onRowClick={(x) => go(x.b.id, "vendors")} breakpoint="md" bare />
        </Queue>

        <Queue title="Vendors waiting for approval" count={d.pendingVendors.length} hint="Cannot be quoted until approved. GSTIN and PAN are required" empty="No vendors waiting.">
          <DataList rows={d.pendingVendors} columns={pendingVendorColumns} rowKey={(v) => v.id} onRowClick={() => router.push("/vendors")} breakpoint="md" bare />
        </Queue>

        <Queue title="Margin alerts" count={d.marginAlerts.length} hint="Vendor invoices above their quotes, or margin from non-approved vendors" empty="No alerts.">
          <DataList rows={d.marginAlerts} columns={alertColumns} rowKey={(x) => x.b.id} onRowClick={(x) => go(x.b.id, "vendors")} breakpoint="md" bare />
        </Queue>

        <Queue title="Ready to close" count={d.toClose.length} hint="Every vendor is settled; Finance can close the booking" empty="Nothing waiting to be closed.">
          <DataList rows={d.toClose} columns={closeColumns(db)} rowKey={(x) => x.b.id} onRowClick={(x) => router.push(`/bookings/${x.b.id}`)} breakpoint="md" bare />
        </Queue>
      </div>
    </>
  );
}

function Queue({ title, count, hint, empty, children }: { title: string; count: number; hint: string; empty: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant={count ? "warning" : "secondary"}>{count}</Badge>
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>{count === 0 ? <p className="text-muted-foreground text-sm">{empty}</p> : children}</CardContent>
    </Card>
  );
}

const bookingLink = (id: string, tab = "") => (
  <Link href={`/bookings/${id}${tab ? `#${tab}` : ""}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
    {id}
  </Link>
);

const customerOf = (db: DB, x: { b: { leadId: string } }) => db.leads.find((l) => l.id === x.b.leadId)?.customerName ?? "—";

function collectColumns(db: DB): Column<FinRow>[] {
  return [
    { header: "Booking", card: "title", stop: true, cell: (x) => <span className="flex items-center gap-2">{bookingLink(x.b.id, "payments")}<BookingStatusBadge status={x.b.status} /></span> },
    { header: "Customer", cell: (x) => customerOf(db, x) },
    { header: "Value", align: "right", cell: (x) => formatINR(x.f.booked.gross) },
    { header: "Received", align: "right", cell: (x) => formatINR(x.f.received) },
    { header: "Due", align: "right", cell: (x) => <b>{formatINR(x.f.receivable)}</b> },
  ];
}

function invoiceColumns(db: DB): Column<FinRow & { missing: string[] }>[] {
  return [
    { header: "Booking", card: "title", stop: true, cell: (x) => bookingLink(x.b.id, "vendors") },
    { header: "Customer", cell: (x) => customerOf(db, x) },
    { header: "Vendors not yet invoiced", card: "full", cell: (x) => x.missing.join(", ") },
  ];
}

const payoutColumns: Column<PayoutRow>[] = [
  { header: "Booking", card: "title", stop: true, cell: (x) => bookingLink(x.b.id, "vendors") },
  { header: "Vendor", cell: (x) => x.vendor?.name ?? "—" },
  { header: "Invoiced", align: "right", cell: (x) => formatINR(x.invoiced) },
  { header: "Paid", align: "right", cell: (x) => formatINR(x.paid) },
  { header: "Payable", align: "right", cell: (x) => <b>{formatINR(x.payable)}</b> },
  { header: "TDS on payable", align: "right", cell: (x) => formatINR((x.payable * (x.vendor?.tdsRate ?? 0)) / 100) },
];

const pendingVendorColumns: Column<Vendor>[] = [
  { header: "Vendor", card: "title", cell: (v) => <span className="font-medium">{v.name}</span> },
  { header: "Category", cell: (v) => v.category },
  { header: "GSTIN", cell: (v) => v.gstin || <span className="text-destructive">missing</span> },
  { header: "PAN", cell: (v) => v.pan || <span className="text-destructive">missing</span> },
];

const alertColumns: Column<FinRow>[] = [
  { header: "Booking", card: "title", stop: true, cell: (x) => bookingLink(x.b.id, "vendors") },
  { header: "Leakage", align: "right", cell: (x) => <span className={cn(x.f.leakage > 0 && "text-destructive font-semibold")}>{formatINR(x.f.leakage)}</span> },
  { header: "Flagged-vendor margin", align: "right", cell: (x) => <span className={cn(x.f.flaggedMargin !== 0 && "text-destructive font-semibold")}>{formatINR(x.f.flaggedMargin)}</span> },
  { header: "Booked margin", align: "right", cell: (x) => formatINR(x.f.booked.margin) },
];

function closeColumns(db: DB): Column<FinRow>[] {
  return [
    { header: "Booking", card: "title", stop: true, cell: (x) => bookingLink(x.b.id) },
    { header: "Customer", cell: (x) => customerOf(db, x) },
    { header: "Realised margin", align: "right", cell: (x) => (x.f.realisedMargin === null ? "—" : formatINR(x.f.realisedMargin)) },
  ];
}
