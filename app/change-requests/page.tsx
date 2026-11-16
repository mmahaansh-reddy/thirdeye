"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDB } from "@/lib/store";
import type { ChangeRequestStatus } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Loading, PageHeader, Stat, userName } from "@/components/common";

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
        description="Every customer, client or internal change across all bookings. Click a row to open the booking and decide or review it."
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
                          <Link href={`/requests/${req.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
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
