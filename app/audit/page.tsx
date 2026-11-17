"use client";

import { useState } from "react";
import { useDB } from "@/lib/store";
import type { AuditEntry, DB } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { DataList, type Column } from "@/components/data-list";
import { Empty, EntityLink, Loading, PageHeader, userName } from "@/components/common";

function auditColumns(db: DB): Column<AuditEntry>[] {
  return [
    { header: "When", card: "title", cell: (a) => <span className="text-muted-foreground text-xs">{formatDate(a.at)}</span> },
    { header: "Who", cell: (a) => userName(db, a.actorId) },
    {
      header: "Action",
      card: "full",
      cell: (a) => (
        <div>
          {a.action}
          {a.details && <div className="text-muted-foreground text-xs">{a.details}</div>}
        </div>
      ),
    },
    { header: "Record", cell: (a) => <EntityLink db={db} type={a.entityType} id={a.entityId} /> },
    {
      header: "Severity",
      cell: (a) => (
        <Badge variant={a.severity === "blocked" ? "destructive" : a.severity === "warning" ? "warning" : "secondary"}>{a.severity ?? "info"}</Badge>
      ),
    },
  ];
}

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
      {rows.length === 0 ? <Empty>No entries.</Empty> : <DataList rows={rows} columns={auditColumns(db)} rowKey={(a) => a.id} breakpoint="lg" />}
    </>
  );
}
