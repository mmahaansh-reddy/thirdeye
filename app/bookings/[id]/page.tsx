"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { Booking, ChangeRequest, DB, LineItem } from "@/lib/types";
import { bookingFinance, tdsFor, vendorById } from "@/lib/finance";
import { BOOKING_FLOW, BOOKING_STATUS_LABEL, MANUAL_TRANSITIONS } from "@/lib/workflow";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingStatusBadge, Empty, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";
import { LineItemsEditor, LineItemsTable } from "@/components/line-items-editor";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const { error, run } = useAction();
  const [tab, setTab] = useState("items");
  useEffect(() => {
    if (window.location.hash === "#changes") setTab("changes");
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
          <Link href={`/requests/${b.requestId}`}>Request {b.requestId}</Link>
        </Button>
      </PageHeader>

      <Lifecycle b={b} />

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

function Lifecycle({ b }: { b: Booking }) {
  const idx = BOOKING_FLOW.indexOf(b.status);
  const at = (s: string) => [...b.statusHistory].reverse().find((h) => h.status === s)?.at;
  if (b.status === "cancelled") return <Badge variant="destructive">Cancelled on {formatDate(at("cancelled"))}</Badge>;
  return (
    <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
      {BOOKING_FLOW.map((s, i) => (
        <div key={s} className={cn("rounded-md border p-2 text-xs", i <= idx ? "border-primary bg-primary/5" : "opacity-60")}>
          <div className="flex items-center gap-1 font-medium">
            {i <= idx && <Check className="size-3" />}
            {BOOKING_STATUS_LABEL[s]}
          </div>
          <div className="text-muted-foreground mt-0.5">{formatDate(at(s))}</div>
        </div>
      ))}
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
  const [draft, setDraft] = useState<LineItem[] | null>(null);
  const [desc, setDesc] = useState("");
  const [raisedBy, setRaisedBy] = useState<ChangeRequest["raisedBy"]>("customer");
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Raise change request</CardTitle>
          <CardDescription>The booking is never edited directly. Approved changes create a new version; value and margin deltas are recorded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft === null ? (
            <Button variant="outline" onClick={() => setDraft(structuredClone(b.items))}>
              Start change request
            </Button>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_200px]">
                <Field label="What changed and why">
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
                </Field>
                <Field label="Raised by">
                  <NativeSelect value={raisedBy} onChange={(e) => setRaisedBy(e.target.value as ChangeRequest["raisedBy"])}>
                    <option value="customer">Customer</option>
                    <option value="client">Client</option>
                    <option value="internal">Internal</option>
                  </NativeSelect>
                </Field>
              </div>
              <LineItemsEditor db={db} items={draft} onChange={setDraft} />
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    run(actions.raiseChangeRequest(b.id, raisedBy, desc, draft), () => {
                      setDraft(null);
                      setDesc("");
                    })
                  }
                >
                  Submit for approval
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Discard
                </Button>
              </div>
            </>
          )}
          <ErrorText error={error} />
        </CardContent>
      </Card>
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
