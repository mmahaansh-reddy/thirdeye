"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { Booking, ChangeRequest, DB } from "@/lib/types";
import { bookingFinance, changeRequestValues, originalValue, tdsFor, vendorById } from "@/lib/finance";
import { BOOKING_FLOW, BOOKING_STATUS_LABEL, MANUAL_TRANSITIONS } from "@/lib/workflow";
import { cn, formatClock, formatDate, formatDay, formatDuration, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingStatusBadge, Empty, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";
import { LineItemsTable } from "@/components/line-items-editor";
import { useNow } from "@/lib/use-now";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const { error, run } = useAction();
  const [tab, setTab] = useState("items");
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (["items", "payments", "changes", "vendors", "history"].includes(h)) setTab(h);
  }, []);
  if (!db) return <Loading />;
  const b = db.bookings.find((x) => x.id === id);
  if (!b) return <Empty>Booking {id} not found.</Empty>;
  const f = bookingFinance(db, b);
  const lead = db.leads.find((l) => l.id === b.leadId);
  const req = db.requests.find((r) => r.id === b.requestId);
  const crs = db.changeRequests.filter((c) => c.bookingId === b.id);
  const nextManual = MANUAL_TRANSITIONS[b.status] ?? [];

  return (
    <>
      <PageHeader
        title={`Booking ${b.id}`}
        description={`${lead?.customerName ?? ""} · ${req?.title ?? ""} · owner ${userName(db, b.ownerId)} · version v${b.version}`}
      >
        <Button asChild variant="outline">
          <Link href={`/leads?request=${b.requestId}`}>Request {b.requestId}</Link>
        </Button>
      </PageHeader>

      <Lifecycle db={db} b={b} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={b.status} />
        {nextManual.map((s) => (
          <Button key={s} size="sm" variant={s === "cancelled" ? "ghost" : "default"} onClick={() => run(actions.setBookingStatus(b.id, s))}>
            {s === "cancelled" ? "Cancel booking" : `Mark: ${BOOKING_STATUS_LABEL[s]}`}
          </Button>
        ))}
        {["confirmed", "advance_paid"].includes(b.status) && (
          <span className="text-muted-foreground text-xs">Payment statuses update automatically when payments are recorded.</span>
        )}
      </div>
      <div className="mt-2">
        <ErrorText error={error} />
      </div>

      <Card className="mt-4 py-4">
        <CardContent>
          <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Booking value (what the customer pays, incl. GST)</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-xs">Original value · v1 (before any change request)</div>
              <div className="text-2xl font-semibold tabular-nums">{formatINR(originalValue(b).gross)}</div>
              <div className="text-muted-foreground text-xs">
                {formatINR(originalValue(b).sell)} + GST {formatINR(originalValue(b).gst)} · set {formatDay(b.versions[0]?.at ?? b.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Approved changes · {b.version - 1}</div>
              <div className={cn("text-2xl font-semibold tabular-nums", f.booked.gross - originalValue(b).gross < 0 && "text-destructive")}>
                {f.booked.gross - originalValue(b).gross >= 0 ? "+" : "−"}
                {formatINR(Math.abs(f.booked.gross - originalValue(b).gross))}
              </div>
              <div className="text-muted-foreground text-xs">
                {crs.filter((c) => c.status === "pending").length
                  ? `${crs.filter((c) => c.status === "pending").length} pending, not included`
                  : "none pending"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Current value · v{b.version}</div>
              <div className="text-2xl font-semibold tabular-nums">{formatINR(f.booked.gross)}</div>
              <div className="text-muted-foreground text-xs">
                {formatINR(f.booked.sell)} + GST {formatINR(f.booked.gst)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Money label="Quoted margin" value={f.quoted.margin} hint="at quote acceptance" />
        <Money label="Booked margin" value={f.booked.margin} hint={`after ${b.version - 1} approved change(s)`} />
        <Money label="Realised margin" value={f.realisedMargin} hint={f.realisedMargin === null ? "awaiting vendor invoices" : `leakage ${formatINR(f.leakage)}`} bad={f.leakage > 0} />
        <Money label="Flagged-vendor margin" value={f.flaggedMargin} bad={f.flaggedMargin !== 0} />
        <Money label="Customer pays" value={f.booked.gross} hint={`incl. GST ${formatINR(f.booked.gst)}`} />
        <Money label="Received / receivable" value={f.received} hint={`${formatINR(f.receivable)} outstanding`} />
        <Money label="Vendor payable" value={f.vendorPayable} hint={`invoiced ${formatINR(f.invoicedCost)}`} />
        <Money label="TDS deducted" value={f.tdsDeducted} hint={`net paid ${formatINR(f.vendorPaidNet)}`} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="items">Line items</TabsTrigger>
          <TabsTrigger value="payments">Customer payments ({b.payments.length})</TabsTrigger>
          <TabsTrigger value="changes">Change requests ({crs.length})</TabsTrigger>
          <TabsTrigger value="vendors">Vendor invoices & payouts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <Card>
            <CardContent>
              <LineItemsTable db={db} items={b.items} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Payments db={db} b={b} />
        </TabsContent>
        <TabsContent value="changes">
          <ChangeRequests db={db} b={b} crs={crs} />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorMoney db={db} b={b} />
        </TabsContent>
        <TabsContent value="history">
          <History db={db} b={b} />
        </TabsContent>
      </Tabs>
    </>
  );
}

type StepState = "done" | "current" | "todo" | "skipped" | "cancelled";
type Step = { key: string; label: string; entry?: Booking["statusHistory"][number]; state: StepState };

function Lifecycle({ db, b }: { db: DB; b: Booking }) {
  const now = useNow(30_000);
  const idx = BOOKING_FLOW.indexOf(b.status);
  const cancelled = b.status === "cancelled";
  const entryFor = (s: string) => [...b.statusHistory].reverse().find((h) => h.status === s);

  // When cancelled, show the steps that were reached, then a Cancelled end-point.
  const lastReached = cancelled
    ? Math.max(0, ...b.statusHistory.map((h) => BOOKING_FLOW.indexOf(h.status)))
    : BOOKING_FLOW.length - 1;

  const steps: Step[] = BOOKING_FLOW.slice(0, lastReached + 1).map((s, i): Step => {
    const entry = entryFor(s);
    let state: StepState;
    if (cancelled) state = entry ? "done" : "skipped";
    else if (i < idx) state = entry ? "done" : "skipped"; // skipped = e.g. paid in full, so no separate advance step
    else if (i === idx) state = "current";
    else state = "todo";
    return { key: s as string, label: BOOKING_STATUS_LABEL[s], entry, state };
  });
  if (cancelled) {
    const entry = entryFor("cancelled");
    steps.push({ key: "cancelled", label: "Cancelled", entry, state: "cancelled" });
  }

  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-[860px]">
        {steps.map((st, i) => {
          const last = i === steps.length - 1;
          const reached = st.state === "done" || st.state === "current" || st.state === "cancelled";
          const nextReached = !last && ["done", "current", "cancelled"].includes(steps[i + 1].state);
          const prev = i > 0 ? steps[i - 1].entry : undefined;
          return (
            <li key={st.key} className="relative min-w-0 flex-1">
              {!last && <span className={cn("absolute top-3 left-6 -right-0 h-0.5", nextReached ? "bg-primary" : "bg-border")} />}
              <span
                className={cn(
                  "relative z-10 flex size-6 items-center justify-center rounded-full border-2",
                  st.state === "done" && "border-primary bg-primary text-primary-foreground",
                  st.state === "current" && "border-primary bg-background ring-primary/25 ring-4",
                  st.state === "cancelled" && "border-destructive bg-destructive text-white",
                  (st.state === "todo" || st.state === "skipped") && "border-border bg-background"
                )}
              >
                {st.state === "done" && <Check className="size-3.5" />}
                {st.state === "current" && <span className="bg-primary size-2 animate-pulse rounded-full" />}
                {st.state === "cancelled" && <span className="text-xs leading-none">×</span>}
              </span>
              <div className={cn("mt-2 pr-3 text-xs", !reached && "opacity-60")}>
                <div className={cn("text-sm leading-tight font-medium", st.state === "cancelled" && "text-destructive")}>{st.label}</div>
                {st.entry ? (
                  <>
                    <div className="text-foreground mt-1 tabular-nums">{formatDay(st.entry.at)}</div>
                    <div className="text-muted-foreground tabular-nums">{formatClock(st.entry.at)}</div>
                    <div className="text-muted-foreground truncate">by {userName(db, st.entry.by)}</div>
                    {prev && st.state !== "current" && (
                      <div className="text-muted-foreground mt-0.5">+{formatDuration(new Date(st.entry.at).getTime() - new Date(prev.at).getTime())}</div>
                    )}
                    {st.state === "current" && <div className="text-primary mt-0.5 font-medium">In stage {formatDuration(now - new Date(st.entry.at).getTime())}</div>}
                  </>
                ) : (
                  <div className="text-muted-foreground mt-1">{st.state === "skipped" ? "Skipped" : "Pending"}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Money({ label, value, hint, bad }: { label: string; value: number | null; hint?: string; bad?: boolean }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className={cn("text-xl font-semibold tabular-nums", bad && "text-destructive")}>{value === null ? "—" : formatINR(value)}</div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Payments({ db, b }: { db: DB; b: Booking }) {
  const { error, run } = useAction();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");
  const [ref, setRef] = useState("");
  const f = bookingFinance(db, b);
  const advanceDue = Math.max(0, (f.booked.gross * db.settings.advancePct) / 100 - f.received);
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Amount ₹">
            <Input className="w-36" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Mode">
            <NativeSelect className="w-40" value={mode} onChange={(e) => setMode(e.target.value)}>
              {["UPI", "Card", "Bank transfer", "Payment link", "Cash"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Reference / UTR">
            <Input className="w-44" value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Button
            onClick={() =>
              run(actions.recordPayment(b.id, Number(amount), mode, ref), () => {
                setAmount("");
                setRef("");
              })
            }
          >
            Record payment
          </Button>
          {advanceDue > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setAmount(String(Math.ceil(advanceDue)))}>
              Fill advance due ({formatINR(advanceDue)})
            </Button>
          )}
        </div>
        <ErrorText error={error} />
        {b.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          <SimpleTable
            head={["ID", "Date", "Mode", "Reference", "Amount"]}
            rows={b.payments.map((p) => [p.id, formatDate(p.at), p.mode, p.reference, formatINR(p.amount)])}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ChangeRequests({ db, b, crs }: { db: DB; b: Booking; crs: ChangeRequest[] }) {
  const { error, run } = useAction();
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Change requests are raised from the <b>Change Requests</b> page and linked to this booking. They are read-only here: the booking only
            changes when an Admin approves one, which creates a new version.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/change-requests?booking=${b.id}`}>Raise change request for {b.id}</Link>
          </Button>
        </CardContent>
      </Card>
      <ErrorText error={error} />
      {crs.length === 0 && <Empty>No change requests for this booking.</Empty>}
      {crs.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {c.id}
              <Badge variant={c.status === "approved" ? "success" : c.status === "rejected" ? "destructive" : "warning"}>{c.status}</Badge>
              <span className="text-muted-foreground text-sm font-normal">raised by {c.raisedBy}</span>
            </CardTitle>
            <CardDescription>
              {c.description} · logged by {userName(db, c.createdBy)} {formatDate(c.createdAt)}
              {c.decidedBy && ` · decided by ${userName(db, c.decidedBy)} ${formatDate(c.decidedAt)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const v = changeRequestValues(b, c);
              return (
                <div className="text-sm">
                  Booking value: <b className="tabular-nums">{formatINR(v.before)}</b> → <b className="tabular-nums">{formatINR(v.after)}</b>
                  <span className="text-muted-foreground"> (incl. GST, {c.status === "approved" ? "applied" : "if approved"})</span>
                </div>
              );
            })()}
            <div className="flex gap-6 text-sm">
              <span>Value Δ <b className="tabular-nums">{formatINR(c.valueDelta)}</b></span>
              <span>Margin Δ <b className={cn("tabular-nums", c.marginDelta < 0 && "text-destructive")}>{formatINR(c.marginDelta)}</b></span>
            </div>
            <LineItemsTable db={db} items={c.proposedItems} />
            {c.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => run(actions.decideChangeRequest(c.id, true))}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => run(actions.decideChangeRequest(c.id, false))}>Reject</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function VendorMoney({ db, b }: { db: DB; b: Booking }) {
  const { error, run } = useAction();
  const vendorIds = [...new Set(b.items.map((i) => i.vendorId))];
  const [vendorId, setVendorId] = useState(vendorIds[0] ?? "");
  const [invNo, setInvNo] = useState("");
  const [invAmt, setInvAmt] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const preview = tdsFor(vendorById(db, vendorId), Number(payAmt) || 0);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <SimpleTable
            head={["Vendor", "Quoted cost", "Invoiced", "Variance", "Paid (gross)", "TDS", "Payable"]}
            rows={vendorIds.map((v) => {
              const quoted = b.items.filter((i) => i.vendorId === v).reduce((s, i) => s + i.cost, 0);
              const inv = b.vendorInvoices.filter((i) => i.vendorId === v).reduce((s, i) => s + i.amount, 0);
              const paid = b.vendorPayments.filter((p) => p.vendorId === v).reduce((s, p) => s + p.gross, 0);
              const tds = b.vendorPayments.filter((p) => p.vendorId === v).reduce((s, p) => s + p.tds, 0);
              const variance = inv ? inv - quoted : 0;
              return [
                vendorById(db, v)?.name ?? v,
                formatINR(quoted),
                formatINR(inv),
                <span key="v" className={variance > 0 ? "text-destructive font-semibold" : ""}>{formatINR(variance)}</span>,
                formatINR(paid),
                formatINR(tds),
                formatINR(Math.max(0, inv - paid)),
              ];
            })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Vendor">
            <NativeSelect className="w-56" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendorIds.map((v) => (
                <option key={v} value={v}>
                  {vendorById(db, v)?.name ?? v}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Invoice no.">
            <Input className="w-36" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          </Field>
          <Field label="Invoice amount ₹ (pre-GST)">
            <Input className="w-40" type="number" value={invAmt} onChange={(e) => setInvAmt(e.target.value)} />
          </Field>
          <Button variant="outline" onClick={() => run(actions.recordVendorInvoice(b.id, vendorId, invNo, Number(invAmt)), () => { setInvNo(""); setInvAmt(""); })}>
            Record invoice
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Pay vendor ₹ (gross)">
            <Input className="w-40" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
          </Field>
          <span className="text-muted-foreground pb-2 text-xs">
            TDS {formatINR(preview.tds)} · net transfer {formatINR(preview.net)}
          </span>
          <Button variant="outline" onClick={() => run(actions.recordVendorPayment(b.id, vendorId, Number(payAmt)), () => setPayAmt(""))}>
            Record payout
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">Finance/Admin only. Payouts cannot exceed recorded invoices; invoices above the vendor&apos;s quote are flagged.</p>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}

function History({ db, b }: { db: DB; b: Booking }) {
  const ids = new Set([b.id, b.quoteId, b.requestId, ...db.changeRequests.filter((c) => c.bookingId === b.id).map((c) => c.id)]);
  const entries = db.audit.filter((a) => ids.has(a.entityId));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...b.versions].reverse().map((v) => (
            <div key={v.version}>
              <div className="mb-1 text-sm font-medium">
                v{v.version} · {formatDate(v.at)} {v.changeRequestId && <span className="text-muted-foreground">via {v.changeRequestId}</span>}
              </div>
              <LineItemsTable db={db} items={v.items} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {b.statusHistory.map((h, i) => (
              <li key={`s${i}`} className="flex justify-between gap-2">
                <span>Status: {BOOKING_STATUS_LABEL[h.status]}</span>
                <span className="text-muted-foreground text-xs">{userName(db, h.by)} · {formatDate(h.at)}</span>
              </li>
            ))}
            {entries.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-t pt-2">
                <span className={a.severity === "blocked" ? "text-destructive" : ""}>{a.action}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{userName(db, a.actorId)} · {formatDate(a.at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-b">
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 font-medium", i === 0 ? "text-left" : "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {r.map((c, j) => (
              <td key={j} className={cn("py-1.5 tabular-nums", j === 0 ? "text-left" : "text-right")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
