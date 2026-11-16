"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { actions, currentUser, useDB } from "@/lib/store";
import type { LineItem, QuoteStatus } from "@/lib/types";
import { flaggedItems } from "@/lib/finance";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";
import { LineItemsEditor, LineItemsTable, blankItem } from "@/components/line-items-editor";

const Q_TONE: Record<QuoteStatus, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "warning",
  accepted: "success",
  rejected: "destructive",
  superseded: "secondary",
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const db = useDB();
  const { error, run } = useAction();
  const [items, setItems] = useState<LineItem[] | null>(null);
  const [override, setOverride] = useState("");
  const [presalesAssignee, setPresalesAssignee] = useState("");

  if (!db) return <Loading />;
  const r = db.requests.find((x) => x.id === id);
  if (!r) return <Empty>Request {id} not found.</Empty>;
  const lead = db.leads.find((l) => l.id === r.leadId);
  const quotes = db.quotes.filter((q) => q.requestId === r.id).sort((a, b) => b.number - a.number);
  const booking = db.bookings.find((b) => b.requestId === r.id);
  const me = currentUser(db);
  const presalesUsers = db.users.filter((u) => u.role === "presales");
  const draftItems = items ?? [];
  const flagged = flaggedItems(db, draftItems);
  const closed = r.stage === "won" || r.stage === "lost";

  return (
    <>
      <PageHeader title={r.title} description={`${r.id} · ${lead?.customerName ?? ""} (${r.leadId}) · owner ${userName(db, r.ownerId)} · raised ${formatDate(r.createdAt)}`}>
        {booking && (
          <Button asChild variant="outline">
            <Link href={`/bookings/${booking.id}`}>Open booking {booking.id}</Link>
          </Button>
        )}
        {!closed && (
          <Button variant="ghost" onClick={() => run(actions.closeRequestLost(r.id))}>
            Mark lost
          </Button>
        )}
      </PageHeader>
      <ErrorText error={error} />

      <div className="mt-2 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{r.details || <span className="text-muted-foreground">No details</span>}</p>
            <div className="flex items-center gap-2">
              Stage: <Badge variant="secondary">{r.stage}</Badge>
            </div>
            <div>Quotes given: <b>{quotes.filter((q) => q.status !== "draft").length}</b></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pre-sales routing</CardTitle>
            <CardDescription>
              One-way rule: only <b>{db.settings.presalesRoutingRole}</b> (or admin) can route to pre-sales. Attempts by others are blocked and logged.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {r.presales ? (
              <p>
                With <b>{userName(db, r.presales.assigneeId)}</b> — routed by {userName(db, r.presales.routedBy)} on {formatDate(r.presales.routedAt)}
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
                <Button
                  variant="outline"
                  disabled={!presalesAssignee || closed}
                  onClick={() => run(actions.routeToPresales(r.id, presalesAssignee))}
                >
                  <Send /> Route as {me.name}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!closed && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>New quote</CardTitle>
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
                    <b className="text-destructive">{flagged.length} line(s) use a non-approved vendor.</b> This needs an admin override with a reason, and
                    the margin will be reported separately as flagged.
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

      <h2 className="mt-8 mb-3 text-lg font-semibold">Quotes ({quotes.length})</h2>
      {quotes.length === 0 && <Empty>No quotes yet.</Empty>}
      <div className="space-y-3">
        {quotes.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
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
                {q.status === "draft" && <Button size="sm" onClick={() => run(actions.sendQuote(q.id))}>Mark sent to customer</Button>}
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
    </>
  );
}
