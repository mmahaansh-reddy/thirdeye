"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { actions, currentUser } from "@/lib/store";
import type { DB, LineItem, QuoteStatus, RequestStage } from "@/lib/types";
import { flaggedItems } from "@/lib/finance";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorText, Field, useAction, userName } from "@/components/common";
import { LineItemsEditor, LineItemsTable, blankItem } from "@/components/line-items-editor";

const Q_TONE: Record<QuoteStatus, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "warning",
  accepted: "success",
  rejected: "destructive",
  superseded: "secondary",
};

const STAGE_TONE: Record<RequestStage, "secondary" | "warning" | "success" | "destructive"> = {
  open: "warning",
  quoted: "secondary",
  won: "success",
  lost: "destructive",
};

/** Requests, quotes and pre-sales routing for one customer. Opens from the Leads and Enquiries page. */
export function RequestPanel({
  db,
  leadId,
  initialRequestId,
  onClose,
}: {
  db: DB;
  leadId: string | null;
  initialRequestId?: string;
  onClose: () => void;
}) {
  const lead = db.leads.find((l) => l.id === leadId);
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl">
        {lead && <PanelBody key={lead.id} db={db} leadId={lead.id} initialRequestId={initialRequestId} />}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({ db, leadId, initialRequestId }: { db: DB; leadId: string; initialRequestId?: string }) {
  const lead = db.leads.find((l) => l.id === leadId)!;
  const requests = db.requests.filter((r) => r.leadId === leadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const canRaise = lead.otpVerified && !lead.duplicateOf;
  const [sel, setSel] = useState<string>(() =>
    initialRequestId && requests.some((r) => r.id === initialRequestId) ? initialRequestId : requests[0]?.id ?? "new"
  );
  const selected = requests.find((r) => r.id === sel);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{lead.customerName} · requests &amp; quotes</DialogTitle>
        <DialogDescription>
          {lead.id} · {lead.phone} · {lead.source} · owner {userName(db, lead.ownerId)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-2">
        {requests.map((r) => (
          <button
            key={r.id}
            onClick={() => setSel(r.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
              sel === r.id ? "border-primary bg-primary/5" : "hover:bg-accent"
            )}
          >
            <span className="font-medium">{r.title}</span>
            <span className="text-muted-foreground ml-2 font-mono text-xs">{r.id}</span>
            <Badge variant={STAGE_TONE[r.stage]} className="ml-2">
              {r.stage}
            </Badge>
          </button>
        ))}
        {canRaise && (
          <button
            onClick={() => setSel("new")}
            className={cn("flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm", sel === "new" ? "border-primary bg-primary/5" : "hover:bg-accent")}
          >
            <Plus className="size-4" /> New request
          </button>
        )}
      </div>

      {sel === "new" || !selected ? (
        canRaise ? (
          <NewRequestForm db={db} leadId={leadId} onCreated={setSel} />
        ) : (
          <p className="text-muted-foreground text-sm">Requests can only be raised on OTP-verified leads.</p>
        )
      ) : (
        <RequestBody key={selected.id} db={db} requestId={selected.id} />
      )}
    </>
  );
}

function NewRequestForm({ db, leadId, onCreated }: { db: DB; leadId: string; onCreated: (id: string) => void }) {
  const { error, run, setError } = useAction();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  void db;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Raise booking request</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Goa offsite – 3N, 20 pax" />
        </Field>
        <Field label="Details">
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        <div>
          <Button
            onClick={() => {
              if (!title.trim()) return setError("Title is required");
              run(actions.createRequest(leadId, title.trim(), details.trim()), (id) => id && onCreated(id));
            }}
          >
            Create request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestBody({ db, requestId }: { db: DB; requestId: string }) {
  const router = useRouter();
  const { error, run } = useAction();
  const [items, setItems] = useState<LineItem[] | null>(null);
  const [override, setOverride] = useState("");
  const [presalesAssignee, setPresalesAssignee] = useState("");

  const r = db.requests.find((x) => x.id === requestId)!;
  const quotes = db.quotes.filter((q) => q.requestId === r.id).sort((a, b) => b.number - a.number);
  const booking = db.bookings.find((b) => b.requestId === r.id);
  const me = currentUser(db);
  const presalesUsers = db.users.filter((u) => u.role === "presales");
  const draftItems = items ?? [];
  const flagged = flaggedItems(db, draftItems);
  const closed = r.stage === "won" || r.stage === "lost";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {r.id} · raised {formatDate(r.createdAt)} · {r.details || "no details"} · quotes given: <b className="text-foreground">{quotes.filter((q) => q.status !== "draft").length}</b>
        </p>
        <div className="flex gap-2">
          {booking && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/bookings/${booking.id}`}>Open booking {booking.id}</Link>
            </Button>
          )}
          {!closed && (
            <Button variant="ghost" size="sm" onClick={() => run(actions.closeRequestLost(r.id))}>
              Mark lost
            </Button>
          )}
        </div>
      </div>
      <ErrorText error={error} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-sales routing</CardTitle>
          <CardDescription>
            One-way rule: only <b>{db.settings.presalesRoutingRole}</b> (or admin) can route to pre-sales. Attempts by others are blocked and logged.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {r.presales ? (
            <p>
              With <b>{userName(db, r.presales.assigneeId)}</b>: routed by {userName(db, r.presales.routedBy)} on {formatDate(r.presales.routedAt)}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Assign to">
                <NativeSelect className="w-56" value={presalesAssignee} onChange={(e) => setPresalesAssignee(e.target.value)}>
                  <option value="">Select pre-sales member</option>
                  {presalesUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button variant="outline" disabled={!presalesAssignee || closed} onClick={() => run(actions.routeToPresales(r.id, presalesAssignee))}>
                <Send /> Route as {me.name}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!closed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New quote</CardTitle>
            <CardDescription>Every line must point to a vendor and the vendor&apos;s own quote reference. Margin is calculated, never typed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items === null ? (
              <Button onClick={() => setItems([blankItem(db)])}>Start quote #{quotes.length + 1}</Button>
            ) : (
              <>
                <LineItemsEditor db={db} items={draftItems} onChange={setItems} />
                {flagged.length > 0 && (
                  <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-md border p-3 text-sm">
                    <b className="text-destructive">{flagged.length} line(s) use a non-approved vendor.</b> This needs an admin override with a reason, and the margin
                    will be reported separately as flagged.
                    {me.role === "admin" ? (
                      <Input placeholder="Reason for override" value={override} onChange={(e) => setOverride(e.target.value)} />
                    ) : (
                      <p className="text-muted-foreground">Switch to an approved vendor, or ask an admin to create this quote.</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(actions.addQuote(r.id, draftItems, override), () => {
                        setItems(null);
                        setOverride("");
                      })
                    }
                  >
                    Save draft
                  </Button>
                  <Button variant="ghost" onClick={() => setItems(null)}>
                    Discard
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <h3 className="text-base font-semibold">Quotes ({quotes.length})</h3>
      {quotes.length === 0 && <p className="text-muted-foreground text-sm">No quotes yet.</p>}
      <div className="space-y-3">
        {quotes.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Quote #{q.number} <span className="text-muted-foreground font-mono text-xs">{q.id}</span>
                <Badge variant={Q_TONE[q.status]}>{q.status}</Badge>
                {q.vendorOverride && <Badge variant="destructive">vendor override</Badge>}
              </CardTitle>
              <CardDescription>
                by {userName(db, q.createdBy)} · created {formatDate(q.createdAt)} · sent {formatDate(q.sentAt)}
                {q.vendorOverride && ` · override by ${userName(db, q.vendorOverride.approvedBy)}: “${q.vendorOverride.reason}”`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <LineItemsTable db={db} items={q.items} />
              <div className="flex gap-2">
                {q.status === "draft" && (
                  <Button size="sm" onClick={() => run(actions.sendQuote(q.id))}>
                    Mark sent to customer
                  </Button>
                )}
                {q.status === "sent" && (
                  <>
                    <Button size="sm" onClick={() => run(actions.acceptQuote(q.id), (bid) => bid && router.push(`/bookings/${bid}`))}>
                      Customer accepted → create booking
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run(actions.rejectQuote(q.id))}>
                      Customer rejected
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
