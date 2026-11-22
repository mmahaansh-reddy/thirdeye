"use client";

import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { currentUser } from "@/lib/store";
import { useDB } from "@/lib/store";
import { dashboardMetrics } from "@/lib/metrics";
import { formatDate, formatINR, formatPct } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataList, type Column } from "@/components/data-list";
import { BarChart, Donut, FunnelChart, Meter } from "@/components/charts";
import { EntityLink, Loading, PageHeader, Stat, userName } from "@/components/common";

export default function DashboardPage() {
  const db = useDB();
  if (!db) return <Loading />;
  const m = dashboardMetrics(db);
  const me = currentUser(db);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const realisedPct = m.margin.bookedSell ? (m.margin.booked / m.margin.bookedSell) * 100 : 0;

  return (
    <>
      <PageHeader title={`${greeting}, ${me.name.split(" ")[0]}`} description="Every figure is computed from records. Click a card, bar or row to see the records behind it." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Booking value" value={formatINR(m.money.bookingValue)} hint="incl. GST, live bookings" href="/bookings" />
        <Stat label="Received" value={formatINR(m.money.received)} tone="good" href="/finance" />
        <Stat label="Receivable" value={formatINR(m.money.receivable)} tone={m.money.receivable ? "warn" : "default"} href="/finance" />
        <Stat label="Vendor payable" value={formatINR(m.money.vendorPayable)} href="/finance" />
        <Stat label="GST output" value={formatINR(m.money.gst)} href="/finance" />
        <Stat label="TDS deducted" value={formatINR(m.money.tds)} href="/finance" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash position</CardTitle>
            <CardDescription>Of everything booked, what has come in and what is still to collect</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut
              centerLabel="of booking value"
              centerValue={m.money.bookingValue ? `${Math.round((m.money.received / m.money.bookingValue) * 100)}%` : "–"}
              parts={[
                { label: "Received", value: m.money.received, color: "var(--chart-3)" },
                { label: "Receivable", value: m.money.receivable, color: "var(--chart-4)" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Obligations</CardTitle>
            <CardDescription>Vendor payable, GST output and TDS deducted, side by side</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut
              centerLabel="total"
              centerValue={formatINR(m.money.vendorPayable + m.money.gst + m.money.tds)}
              size={148}
              parts={[
                { label: "Vendor payable", value: m.money.vendorPayable, color: "var(--chart-1)" },
                { label: "GST output", value: m.money.gst, color: "var(--chart-2)" },
                { label: "TDS deducted", value: m.money.tds, color: "var(--chart-5)" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads and Bookings</CardTitle>
            <CardDescription>
              Counted from the Leads and Bookings page, one count per customer. Click a bar to see them. {m.duplicates} duplicate{m.duplicates === 1 ? "" : "s"} merged across CRMs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelChart steps={m.funnel} />
            <div className="text-muted-foreground grid grid-cols-2 gap-2 border-t pt-3 text-xs sm:grid-cols-4">
              <div>Lead → booking: <b className="text-foreground">{formatPct(m.leadToBooking)}</b><Meter value={m.leadToBooking} className="mt-1.5" /></div>
              <div>Enquiry share: <b className="text-foreground">{formatPct(m.enquiryShare)}</b></div>
              <div>Quotes / request: <b className="text-foreground">{m.quotesPerRequest.toFixed(1)}</b></div>
              <div>Avg first quote: <b className="text-foreground">{m.avgFirstQuoteHours.toFixed(1)}h</b></div>
            </div>
            <Link href="/leads" className="text-muted-foreground block pt-1 text-xs underline-offset-2 hover:underline">
              Open Leads and Bookings →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margin integrity</CardTitle>
            <CardDescription>Quoted → booked → realised, all tied to booking lines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <BarChart
              height={110}
              data={[
                { label: "Quoted", value: m.margin.quoted, color: "var(--chart-2)" },
                { label: "Booked", value: m.margin.booked, color: "var(--chart-1)" },
                { label: "Realised", value: m.margin.realised, color: "var(--chart-3)" },
              ]}
            />
            <div className="border-t pt-3" />
            <Row label="Quoted margin" value={formatINR(m.margin.quoted)} />
            <Row label="Booked margin" value={`${formatINR(m.margin.booked)} (${formatPct(realisedPct)})`} />
            <Row label={`Realised (${m.margin.realisedBookings} invoiced)`} value={formatINR(m.margin.realised)} />
            <Row label="Leakage vs vendor quotes" value={formatINR(m.margin.leakage)} bad={m.margin.leakage > 0} />
            <Row label="From non-approved vendors" value={formatINR(m.margin.flagged)} bad={m.margin.flagged > 0} />
            <Link href="/finance" className="text-muted-foreground block pt-1 text-xs underline-offset-2 hover:underline">
              See per-booking breakdown →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-4" /> Overdue follow-ups ({m.ops.overdue.length})
            </CardTitle>
            <CardDescription>
              {m.ops.openTasks} open · {m.ops.pendingCRs} change requests awaiting decision
            </CardDescription>
          </CardHeader>
          <CardContent>
            {m.ops.overdue.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing overdue.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {m.ops.overdue.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <span className="truncate">{t.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {userName(db, t.assigneeId)} · due {formatDate(t.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/tasks" className="text-muted-foreground mt-3 block text-xs underline-offset-2 hover:underline">
              All follow-ups →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4" /> Rule violations & overrides
            </CardTitle>
            <CardDescription>
              {m.ops.blocked.length} blocked attempts · {m.ops.warnings.length} overrides/warnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...m.ops.blocked, ...m.ops.warnings]
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 6)
                .map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className={a.severity === "blocked" ? "text-destructive" : ""}>{a.action}</span>
                    </span>
                    <span className="shrink-0">
                      <EntityLink db={db} type={a.entityType} id={a.entityId} />
                    </span>
                  </li>
                ))}
            </ul>
            <Link href="/audit" className="text-muted-foreground mt-3 block text-xs underline-offset-2 hover:underline">
              Full audit log →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By source / CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <DataList rows={m.bySource} rowKey={(x) => x.source} breakpoint="md" bare columns={sourceColumns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By owner</CardTitle>
            <CardDescription>Leakage = booked margin lost to vendor invoices above their quotes</CardDescription>
          </CardHeader>
          <CardContent>
            <DataList rows={m.byOwner} rowKey={(x) => x.user.id} breakpoint="md" bare columns={ownerColumns} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

type SourceRow = ReturnType<typeof dashboardMetrics>["bySource"][number];
type OwnerRow = ReturnType<typeof dashboardMetrics>["byOwner"][number];

const sourceColumns: Column<SourceRow>[] = [
  { header: "Source", card: "title", cell: (x) => <span className="font-medium">{x.source}</span> },
  { header: "Enquiries", align: "right", cell: (x) => x.enquiries },
  { header: "Leads", align: "right", cell: (x) => x.leads },
  { header: "Bookings", align: "right", cell: (x) => x.bookings },
  { header: "Value", align: "right", cell: (x) => formatINR(x.value) },
];

const ownerColumns: Column<OwnerRow>[] = [
  { header: "Owner", card: "title", cell: (x) => <span className="font-medium">{x.user.name}</span> },
  { header: "Bookings", align: "right", cell: (x) => x.bookings },
  { header: "Margin", align: "right", cell: (x) => formatINR(x.bookedMargin) },
  { header: "Flagged", align: "right", cell: (x) => <span className={x.flaggedMargin ? "text-destructive" : ""}>{formatINR(x.flaggedMargin)}</span> },
  { header: "Leakage", align: "right", cell: (x) => <span className={x.leakage > 0 ? "text-destructive" : ""}>{formatINR(x.leakage)}</span> },
  { header: "Overdue", align: "right", cell: (x) => <span className={x.overdue ? "text-destructive" : ""}>{x.overdue}</span> },
];

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${bad ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
