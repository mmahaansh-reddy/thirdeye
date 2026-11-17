"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDB } from "@/lib/store";
import { actions } from "@/lib/store";
import type { Booking, ChangeRequest, ChangeRequestStatus, DB, LineItem } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineItemsEditor } from "@/components/line-items-editor";
import { NativeSelect } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, ErrorText, Field, Loading, PageHeader, Stat, userName, useAction } from "@/components/common";

const TONE: Record<ChangeRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export default function ChangeRequestsPage() {
  const db = useDB();
  const router = useRouter();
  const [status, setStatus] = useState<"all" | ChangeRequestStatus>("all");
  const [raisedBy, setRaisedBy] = useState("all");
  const [raising, setRaising] = useState(false);
  const [presetBooking, setPresetBooking] = useState("");

  // Arriving from a booking's "Raise change request" button (?booking=B-XXXX) opens the form for that booking.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("booking");
    if (id) {
      setPresetBooking(id);
      setRaising(true);
    }
  }, []);

  if (!db) return <Loading />;

  const all = db.changeRequests;
  const rows = all
    .filter((c) => status === "all" || c.status === status)
    .filter((c) => raisedBy === "all" || c.raisedBy === raisedBy)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const approved = all.filter((c) => c.status === "approved");

  return (
    <>
      <PageHeader
        title="Change requests"
        description="Raise a change against an existing booking. Full details are viewable only inside the booking, and are read-only."
      >
        <Button onClick={() => setRaising(true)}>
          <Plus /> Raise change request
        </Button>
      </PageHeader>
      <RaiseDialog
        db={db}
        open={raising}
        presetBooking={presetBooking}
        onOpenChange={(o) => {
          setRaising(o);
          if (!o) {
            setPresetBooking("");
            window.history.replaceState(null, "", "/change-requests");
          }
        }}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={all.length} />
        <Stat label="Pending decision" value={all.filter((c) => c.status === "pending").length} tone={all.some((c) => c.status === "pending") ? "warn" : "default"} />
        <Stat label="Approved value Δ" value={formatINR(approved.reduce((s, c) => s + c.valueDelta, 0))} />
        <Stat
          label="Approved margin Δ"
          value={formatINR(approved.reduce((s, c) => s + c.marginDelta, 0))}
          tone={approved.reduce((s, c) => s + c.marginDelta, 0) < 0 ? "bad" : "default"}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect className="w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </NativeSelect>
        <NativeSelect className="w-44" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)}>
          <option value="all">Raised by anyone</option>
          <option value="customer">Customer</option>
          <option value="client">Client</option>
          <option value="internal">Internal</option>
        </NativeSelect>
      </div>

      {rows.length === 0 ? (
        <Empty>No change requests match. Start one from a booking&apos;s Change requests tab.</Empty>
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Change</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Raised by</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Value Δ</TableHead>
                  <TableHead className="text-right">Margin Δ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Decided</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const b = db.bookings.find((x) => x.id === c.bookingId);
                  const req = db.requests.find((r) => r.id === b?.requestId);
                  const lead = db.leads.find((l) => l.id === b?.leadId);
                  const href = `/bookings/${c.bookingId}#changes`;
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
                    >
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
                          {c.bookingId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {req ? (
                          <Link href={`/leads?request=${req.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
                            {req.id}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{lead?.customerName ?? "—"}</TableCell>
                      <TableCell className="capitalize">{c.raisedBy}</TableCell>
                      <TableCell className="max-w-64 truncate" title={c.description}>
                        {c.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(c.valueDelta)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", c.marginDelta < 0 && "text-destructive")}>{formatINR(c.marginDelta)}</TableCell>
                      <TableCell>
                        <Badge variant={TONE[c.status]}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(c.createdAt)}
                        <div>{userName(db, c.createdBy)}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {c.decidedAt ? (
                          <>
                            {formatDate(c.decidedAt)}
                            <div>{userName(db, c.decidedBy)}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const EDITABLE = (b: Booking) => !["cancelled", "closed", "vendor_settled"].includes(b.status);

function RaiseDialog({ db, open, presetBooking, onOpenChange }: { db: DB; open: boolean; presetBooking: string; onOpenChange: (o: boolean) => void }) {
  const { error, run, setError } = useAction();
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");
  const [items, setItems] = useState<LineItem[] | null>(null);
  const [desc, setDesc] = useState("");
  const [raisedBy, setRaisedBy] = useState<ChangeRequest["raisedBy"]>("customer");

  const eligible = db.bookings.filter(EDITABLE);
  const selectedId = bookingId || (presetBooking && eligible.some((b) => b.id === presetBooking) ? presetBooking : "");
  const booking = eligible.find((b) => b.id === selectedId);
  const lead = db.leads.find((l) => l.id === booking?.leadId);
  const req = db.requests.find((r) => r.id === booking?.requestId);
  // Lines start as a copy of the booking's current lines; null means "not edited yet".
  const lines: LineItem[] = items ?? (booking ? structuredClone(booking.items) : []);

  const reset = () => {
    setBookingId("");
    setItems(null);
    setDesc("");
    setRaisedBy("customer");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Raise change request</DialogTitle>
          <DialogDescription>
            Must be linked to an existing booking. Edit the lines to show what the customer wants; the booking itself is not touched until an Admin approves.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <Field label="Booking (required)">
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={selectedId}
                onChange={(e) => {
                  setBookingId(e.target.value);
                  setItems(null);
                }}
              >
                <option value="">Select an existing booking</option>
                {eligible.map((b) => {
                  const l = db.leads.find((x) => x.id === b.leadId);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.id} · {l?.customerName ?? ""} · {db.requests.find((r) => r.id === b.requestId)?.title ?? ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Raised by">
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={raisedBy}
                onChange={(e) => setRaisedBy(e.target.value as ChangeRequest["raisedBy"])}
              >
                <option value="customer">Customer</option>
                <option value="client">Client</option>
                <option value="internal">Internal</option>
              </select>
            </Field>
          </div>

          {booking && (
            <>
              <div className="text-muted-foreground text-xs">
                Linked to booking <b className="text-foreground">{booking.id}</b> (v{booking.version}) · request{" "}
                <b className="text-foreground">{req?.id}</b> · {lead?.customerName}
              </div>
              <Field label="What changed and why">
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Customer wants a gala dinner added on night 2" />
              </Field>
              <LineItemsEditor db={db} items={lines} onChange={setItems} />
            </>
          )}
          <ErrorText error={error} />
        </div>
        <DialogFooter>
          <Button
            disabled={!booking}
            onClick={() => {
              if (!booking) return setError("Select a booking to link this change to");
              run(actions.raiseChangeRequest(booking.id, raisedBy, desc, lines), () => {
                const id = booking.id;
                reset();
                onOpenChange(false);
                router.push(`/bookings/${id}#changes`);
              });
            }}
          >
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
