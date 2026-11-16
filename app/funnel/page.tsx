"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDB } from "@/lib/store";
import { STAGE_DEPTH, STAGE_LABEL, STAGE_ORDER, funnelRows, type FunnelStage } from "@/lib/funnel";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Loading, PageHeader, userName } from "@/components/common";

const TAG_TONE: Record<FunnelStage, "secondary" | "warning" | "success" | "destructive" | "outline" | "default"> = {
  enquiry: "warning",
  lead: "secondary",
  request: "secondary",
  quoted: "default",
  booked: "default",
  paid: "success",
  lost: "destructive",
  duplicate: "outline",
};

export default function FunnelPage() {
  const db = useDB();
  const router = useRouter();
  const [stage, setStage] = useState<"all" | FunnelStage>("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");

  // Allow deep links like /funnel?stage=quoted
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("stage");
    if (s && (STAGE_ORDER as string[]).includes(s)) setStage(s as FunnelStage);
  }, []);

  if (!db) return <Loading />;

  const all = funnelRows(db);
  const sources = [...new Set(db.leads.map((l) => l.source))].sort();
  const owners = db.users.filter((u) => all.some((r) => r.lead.ownerId === u.id));
  const needle = q.trim().toLowerCase();

  // Counts respect the source/owner/search filters but not the stage filter, so the chips always show the split.
  const scoped = all
    .filter((r) => source === "all" || r.lead.source === source)
    .filter((r) => owner === "all" || r.lead.ownerId === owner)
    .filter(
      (r) =>
        !needle ||
        [r.lead.customerName, r.lead.phone, r.lead.id, ...r.requestIds, ...r.bookingIds].some((v) => v.toLowerCase().includes(needle))
    );
  const rows = scoped.filter((r) => stage === "all" || r.stage === stage).sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt));
  const count = (s: FunnelStage) => scoped.filter((r) => r.stage === s).length;

  return (
    <>
      <PageHeader
        title="Funnel items"
        description="Every customer journey from first enquiry to payment, tagged with the furthest stage reached. Each customer appears once, so the tag counts add up to the total."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={stage === "all"} onClick={() => setStage("all")} label="All" n={scoped.length} />
        {STAGE_ORDER.map((s) => (
          <Chip key={s} active={stage === s} onClick={() => setStage(s)} label={STAGE_LABEL[s]} n={count(s)} />
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Search name, phone, lead / request / booking ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <NativeSelect className="w-44" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources / CRMs</option>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-48" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">All owners</option>
          {owners.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {rows.length === 0 ? (
        <Empty>Nothing matches these filters.</Empty>
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.lead.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => router.push(r.href)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(r.href)}
                  >
                    <TableCell>
                      <Badge variant={TAG_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Progress depth={STAGE_DEPTH[r.stage]} muted={r.stage === "lost" || r.stage === "duplicate"} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.lead.customerName}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.lead.phone} · <span className="font-mono">{r.lead.id}</span>
                        {r.lead.duplicateOf && ` · dup of ${r.lead.duplicateOf}`}
                      </div>
                    </TableCell>
                    <TableCell>{r.lead.source}</TableCell>
                    <TableCell>{userName(db, r.lead.ownerId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.requests || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quotes || "—"}</TableCell>
                    <TableCell>
                      {r.bookingIds.length ? (
                        r.bookingIds.map((id) => (
                          <Link key={id} href={`/bookings/${id}`} onClick={(e) => e.stopPropagation()} className="mr-2 font-mono text-xs underline-offset-2 hover:underline">
                            {id}
                          </Link>
                        ))
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.value ? formatINR(r.value) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.received ? formatINR(r.received) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(r.lead.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        Progress dots: enquiry → lead → request → quoted → booked → fully paid. The dashboard funnel counts records at each step (e.g. all requests), so its
        numbers can differ from these per-customer tags when one customer has several requests.
      </p>
    </>
  );
}

function Chip({ label, n, active, onClick }: { label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
      )}
    >
      {label} <span className={cn("ml-1 tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{n}</span>
    </button>
  );
}

function Progress({ depth, muted }: { depth: number; muted?: boolean }) {
  return (
    <div className="flex gap-0.5" aria-label={`Stage ${depth + 1} of 6`}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-4 rounded-full", i <= depth ? (muted ? "bg-muted-foreground/40" : "bg-primary") : "bg-muted")} />
      ))}
    </div>
  );
}
