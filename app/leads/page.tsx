"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { DB, Lead, LeadStatus } from "@/lib/types";
import { STEPS, TAG_DEPTH, TAG_LABEL, funnelRows, funnelSteps, rowMatches, type FunnelRow, type FunnelTag, type StepFilter } from "@/lib/funnel";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { RequestPanel } from "@/components/request-panel";
import { Empty, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";

const SOURCES = ["LeadSquared", "Zoho CRM", "Website", "Meta Ads", "Referral", "Walk-in / Phone"];

const TAG_TONE: Record<FunnelTag, "secondary" | "warning" | "success" | "destructive" | "outline" | "default"> = {
  enquiry: "warning",
  lead: "secondary",
  request: "secondary",
  quoted: "default",
  booked: "default",
  paid: "success",
  lost: "destructive",
  duplicate: "outline",
};

const VALID_FILTERS: StepFilter[] = ["all", ...STEPS.map((s) => s.key), "lost", "duplicate"];

export default function LeadsPage() {
  const db = useDB();
  const { error, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<{ leadId: string; requestId?: string } | null>(null);
  const deepLinked = useRef(false);
  const [step, setStep] = useState<StepFilter>("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");

  // Deep links from the dashboard funnel: /leads?step=quoted
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("step");
    if (s && (VALID_FILTERS as string[]).includes(s)) setStep(s as StepFilter);
  }, []);

  // Old links like /requests/R-2001 now arrive as /leads?request=R-2001 and open that request's panel.
  useEffect(() => {
    if (!db || deepLinked.current) return;
    const rid = new URLSearchParams(window.location.search).get("request");
    if (!rid) return;
    deepLinked.current = true;
    const r = db.requests.find((x) => x.id === rid);
    if (r) setPanel({ leadId: r.leadId, requestId: r.id });
  }, [db]);

  const closePanel = () => {
    setPanel(null);
    if (window.location.search.includes("request=")) window.history.replaceState(null, "", "/leads");
  };

  if (!db) return <Loading />;

  const all = funnelRows(db);
  const sources = [...new Set(db.leads.map((l) => l.source))].sort();
  const owners = db.users.filter((u) => all.some((r) => r.lead.ownerId === u.id));
  const needle = q.trim().toLowerCase();

  // Chip counts follow the source / owner / search filters but not the step filter, so the funnel split is always visible.
  // With no other filter they equal the dashboard funnel exactly (both use lib/funnel.ts).
  const scoped = all
    .filter((r) => source === "all" || r.lead.source === source)
    .filter((r) => owner === "all" || r.lead.ownerId === owner)
    .filter((r) => !needle || [r.lead.customerName, r.lead.phone, r.lead.id, ...r.requestIds, ...r.bookingIds].some((v) => v.toLowerCase().includes(needle)));
  const steps = funnelSteps(scoped);
  const rows = scoped.filter((r) => rowMatches(r, step)).sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt));
  const countOf = (f: "lost" | "duplicate") => scoped.filter((r) => r.tag === f).length;

  return (
    <>
      <PageHeader
        title="Leads and Enquiries"
        description="Every customer from first enquiry to payment, tagged with the furthest stage reached. These counts drive the dashboard funnel. Only OTP-verified intake counts as a lead."
      >
        <Button onClick={() => setAdding(true)}>
          <Plus /> Capture intake
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={step === "all"} onClick={() => setStep("all")} label="All" n={scoped.length} />
        {steps.map((s) => (
          <Chip key={s.key} active={step === s.key} onClick={() => setStep(s.key)} label={s.label} n={s.value} />
        ))}
        <Chip active={step === "lost"} onClick={() => setStep("lost")} label="Lost" n={countOf("lost")} />
        <Chip active={step === "duplicate"} onClick={() => setStep("duplicate")} label="Duplicates" n={countOf("duplicate")} />
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
      <ErrorText error={error} />

      {rows.length === 0 ? (
        <Empty>Nothing matches these filters.</Empty>
      ) : (
        <>
          {/* Wide screens: a compact table that fits the page width (no sideways scrolling). */}
          <Card className="mt-2 hidden py-2 xl:block">
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-normal">Stage</TableHead>
                    <TableHead className="whitespace-normal">Customer</TableHead>
                    <TableHead className="whitespace-normal">Requests · quotes · booking</TableHead>
                    <TableHead className="text-right whitespace-normal">Value / received</TableHead>
                    <TableHead className="whitespace-normal">Captured</TableHead>
                    <TableHead className="whitespace-normal">Status / action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const l = r.lead;
                    const open = canOpen(l) ? () => setPanel({ leadId: l.id }) : undefined;
                    return (
                      <TableRow
                        key={l.id}
                        id={l.id}
                        className={cn(open && "cursor-pointer")}
                        tabIndex={open ? 0 : undefined}
                        onClick={open}
                        onKeyDown={open ? (e) => e.key === "Enter" && open() : undefined}
                      >
                        <TableCell className="align-top whitespace-normal">
                          <StageCell r={r} />
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <CustomerCell db={db} r={r} />
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <PipelineCell r={r} />
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-normal tabular-nums">
                          <MoneyCell r={r} />
                        </TableCell>
                        <TableCell className="text-muted-foreground align-top text-xs whitespace-normal">{formatDate(l.createdAt)}</TableCell>
                        <TableCell className="align-top whitespace-normal" onClick={(e) => e.stopPropagation()}>
                          <RowControls r={r} run={run} onOpen={() => setPanel({ leadId: l.id })} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Narrower screens (tablet / phone): one card per customer. */}
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((r) => {
              const l = r.lead;
              const open = canOpen(l) ? () => setPanel({ leadId: l.id }) : undefined;
              return (
                <Card
                  key={l.id}
                  id={l.id}
                  className={cn("gap-3", open && "hover:border-ring cursor-pointer transition-colors")}
                  tabIndex={open ? 0 : undefined}
                  onClick={open}
                  onKeyDown={open ? (e) => e.key === "Enter" && open() : undefined}
                >
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <StageCell r={r} />
                      <span className="text-muted-foreground shrink-0 text-xs">{formatDate(l.createdAt)}</span>
                    </div>
                    <CustomerCell db={db} r={r} />
                    <div className="flex flex-wrap items-end justify-between gap-3 text-sm">
                      <PipelineCell r={r} />
                      <div className="text-right tabular-nums">
                        <MoneyCell r={r} />
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RowControls r={r} run={run} onOpen={() => setPanel({ leadId: l.id })} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        Click a customer to open their requests, quotes and pre-sales routing. Funnel steps are cumulative: a fully paid customer also counts as booked, quoted, request raised and lead. The tag on each row is the furthest stage
        reached. Duplicates (same phone number) are merged and excluded from the funnel.
      </p>

      <AddLeadDialog open={adding} onOpenChange={setAdding} />
      <RequestPanel db={db} leadId={panel?.leadId ?? null} initialRequestId={panel?.requestId} onClose={closePanel} />
    </>
  );
}

/** Only verified, non-duplicate customers have a requests & quotes panel. */
const canOpen = (l: Lead) => l.otpVerified && !l.duplicateOf;

function StageCell({ r }: { r: FunnelRow }) {
  return (
    <div className="space-y-1.5">
      <Badge variant={TAG_TONE[r.tag]}>{TAG_LABEL[r.tag]}</Badge>
      <Progress depth={TAG_DEPTH[r.tag]} muted={r.tag === "lost" || r.tag === "duplicate"} />
    </div>
  );
}

function CustomerCell({ db, r }: { db: DB; r: FunnelRow }) {
  const l = r.lead;
  return (
    <div>
      <div className="font-medium">{l.customerName}</div>
      <div className="text-muted-foreground text-xs">
        {l.phone} · <span className="font-mono">{l.id}</span>
        {l.duplicateOf && ` · dup of ${l.duplicateOf}`}
      </div>
      <div className="text-muted-foreground text-xs">
        {l.source} · {userName(db, l.ownerId)}
      </div>
    </div>
  );
}

function PipelineCell({ r }: { r: FunnelRow }) {
  return (
    <div className="space-y-0.5 text-sm">
      <div className="text-muted-foreground text-xs">
        Requests <b className="text-foreground tabular-nums">{r.requests || "—"}</b> · Quotes <b className="text-foreground tabular-nums">{r.quotes || "—"}</b>
      </div>
      <div className="flex flex-wrap gap-x-2">
        {r.bookingIds.length ? (
          r.bookingIds.map((id) => (
            <Link key={id} href={`/bookings/${id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
              {id}
            </Link>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">No booking</span>
        )}
      </div>
    </div>
  );
}

function MoneyCell({ r }: { r: FunnelRow }) {
  return r.value ? (
    <>
      <div>{formatINR(r.value)}</div>
      <div className="text-muted-foreground text-xs">{formatINR(r.received)} received</div>
    </>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function RowControls({ r, run, onOpen }: { r: FunnelRow; run: ReturnType<typeof useAction>["run"]; onOpen: () => void }) {
  const l = r.lead;
  return (
    <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-stretch">
      <NativeSelect className="h-8 w-32 xl:w-full" value={l.status} onChange={(e) => run(actions.setLeadStatus(l.id, e.target.value as LeadStatus))}>
        {(["new", "contacted", "converted", "lost"] as LeadStatus[]).map((st) => (
          <option key={st} value={st}>
            {st}
          </option>
        ))}
      </NativeSelect>
      {!l.otpVerified && !l.duplicateOf && (
        <Button size="sm" variant="outline" onClick={() => run(actions.verifyOtp(l.id))}>
          <ShieldCheck /> Mark OTP verified
        </Button>
      )}
      {canOpen(l) && (
        <Button size="sm" variant="outline" onClick={onOpen}>
          Requests &amp; quotes{r.requests ? ` (${r.requests})` : ""}
        </Button>
      )}
    </div>
  );
}

function Chip({ label, n, active, onClick }: { label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-sm transition-colors", active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent")}
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

function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { error, run, setError } = useAction();
  const [form, setForm] = useState({ source: SOURCES[0], customerName: "", phone: "", email: "", otpVerified: false });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture intake</DialogTitle>
          <DialogDescription>
            Simulates a CRM webhook. Same phone number as an existing record is merged as a duplicate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Source / CRM">
            <NativeSelect value={form.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Customer name">
            <Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" />
          </Field>
          <Field label="Email (optional)">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.otpVerified} onChange={(e) => set("otpVerified", e.target.checked)} />
            OTP verified by the source
          </label>
          <ErrorText error={error} />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!form.customerName.trim()) return setError("Customer name is required");
              run(actions.addLead({ ...form, email: form.email || undefined }), () => {
                setForm({ source: SOURCES[0], customerName: "", phone: "", email: "", otpVerified: false });
                onOpenChange(false);
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
