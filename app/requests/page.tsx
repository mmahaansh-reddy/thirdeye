"use client";

import Link from "next/link";
import { useDB } from "@/lib/store";
import type { RequestStage } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Loading, PageHeader, userName } from "@/components/common";

const STAGE_TONE: Record<RequestStage, "secondary" | "warning" | "success" | "destructive"> = {
  open: "warning",
  quoted: "secondary",
  won: "success",
  lost: "destructive",
};

export default function RequestsPage() {
  const db = useDB();
  if (!db) return <Loading />;
  return (
    <>
      <PageHeader title="Requests & Quotes" description="Each request can carry several quotes. Raise new requests from a verified lead." />
      {db.requests.length === 0 ? (
        <Empty>No requests yet. Raise one from the Leads page.</Empty>
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Pre-sales</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Raised</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.requests.map((r) => {
                  const lead = db.leads.find((l) => l.id === r.leadId);
                  const quotes = db.quotes.filter((q) => q.requestId === r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/requests/${r.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                          {r.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                          {r.title}
                        </Link>
                      </TableCell>
                      <TableCell>{lead?.customerName}</TableCell>
                      <TableCell>{userName(db, r.ownerId)}</TableCell>
                      <TableCell>{r.presales ? userName(db, r.presales.assigneeId) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {quotes.length}
                        {quotes.some((q) => q.vendorOverride) && <Badge variant="destructive" className="ml-1">override</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STAGE_TONE[r.stage]}>{r.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(r.createdAt)}</TableCell>
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
