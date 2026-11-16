"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { bookingFinance } from "@/lib/finance";
import { formatDate, formatINR, formatPct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusBadge, Empty, Loading, PageHeader, userName } from "@/components/common";

export default function BookingsPage() {
  const db = useDB();
  const router = useRouter();
  if (!db) return <Loading />;
  return (
    <>
      <PageHeader title="Bookings" description="Created only from an accepted quote. Changes go through versioned change requests." />
      {db.bookings.length === 0 ? (
        <Empty>No bookings yet. Accept a quote to create one.</Empty>
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ver.</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Booked margin</TableHead>
                  <TableHead className="text-right">Changes</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.bookings.map((b) => {
                  const f = bookingFinance(db, b);
                  const lead = db.leads.find((l) => l.id === b.leadId);
                  const bookingCRs = db.changeRequests.filter((c) => c.bookingId === b.id);
                  const pendingCR = bookingCRs.some((c) => c.status === "pending");
                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(`/bookings/${b.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(`/bookings/${b.id}`)}
                    >
                      <TableCell>
                        <Link href={`/bookings/${b.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                          {b.id}
                        </Link>
                      </TableCell>
                      <TableCell>{lead?.customerName}</TableCell>
                      <TableCell>{userName(db, b.ownerId)}</TableCell>
                      <TableCell className="space-x-1">
                        <BookingStatusBadge status={b.status} />
                        {pendingCR && <Badge variant="warning">CR pending</Badge>}
                        {f.flaggedMargin !== 0 && <Badge variant="destructive">flagged vendor</Badge>}
                      </TableCell>
                      <TableCell className="text-right">v{b.version}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(f.booked.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(f.received)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(f.booked.margin)} <span className="text-muted-foreground text-xs">({formatPct(f.booked.marginPct)})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bookingCRs.length ? (
                          <Link
                            href={`/bookings/${b.id}#changes`}
                            onClick={(e) => e.stopPropagation()}
                            className="underline-offset-2 hover:underline"
                          >
                            {bookingCRs.length}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(b.createdAt)}</TableCell>
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
