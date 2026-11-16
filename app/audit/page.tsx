"use client";

import { useState } from "react";
import { useDB } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityLink, Loading, PageHeader, userName } from "@/components/common";

export default function AuditPage() {
  const db = useDB();
  const [sev, setSev] = useState("all");
  if (!db) return <Loading />;
  const rows = db.audit.filter((a) => sev === "all" || (a.severity ?? "info") === sev);
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of every change, override and blocked rule violation.">
        <NativeSelect className="w-44" value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="all">All entries</option>
          <option value="blocked">Blocked attempts</option>
          <option value="warning">Overrides / warnings</option>
          <option value="info">Info</option>
        </NativeSelect>
      </PageHeader>
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(a.at)}</TableCell>
                  <TableCell>{userName(db, a.actorId)}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    {a.action}
                    {a.details && <div className="text-muted-foreground text-xs">{a.details}</div>}
                  </TableCell>
                  <TableCell>
                    <EntityLink db={db} type={a.entityType} id={a.entityId} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.severity === "blocked" ? "destructive" : a.severity === "warning" ? "warning" : "secondary"}>
                      {a.severity ?? "info"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
