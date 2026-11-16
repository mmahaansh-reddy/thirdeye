"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { Lead, LeadStatus } from "@/lib/types";
import { STEPS, TAG_DEPTH, TAG_LABEL, funnelRows, funnelSteps, rowMatches, type FunnelTag, type StepFilter } from "@/lib/funnel";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
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
  const router = useRouter();
  const { error, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [requestFor, setRequestFor] = useState<Lead | null>(null);
  const [step, setStep] = useState<StepFilter>("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");

  // Deep links from the dashboard funnel: /leads?step=quoted
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("step");
    if (s && (VALID_FILTERS as string[]).includes(s)) setStep(s as StepFilter);
  }, []);

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
        title="Leads & Funnel"
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
        <Card className="mt-2 py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const l = r.lead;
                  const go = r.href ? () => router.push(r.href!) : undefined;
                  return (
                    <TableRow
                      key={l.id}
                      id={l.id}
                      className={cn(go && "cursor-pointer")}
                      tabIndex={go ? 0 : undefined}
                      onClick={go}
                      onKeyDown={go ? (e) => e.key === "Enter" && go() : undefined}
                    >
                      <TableCell>
                        <Badge variant={TAG_TONE[r.tag]}>{TAG_LABEL[r.tag]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Progress depth={TAG_DEPTH[r.tag]} muted={r.tag === "lost" || r.tag === "duplicate"} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.customerName}</div>
                        <div className="text-muted-foreground text-xs">
                          {l.phone} · <span className="font-mono">{l.id}</span>
                          {l.duplicateOf && ` · dup of ${l.duplicateOf}`}
                        </div>
                      </TableCell>
                      <TableCell>{l.source}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <NativeSelect className="h-8 w-32" value={l.status} onChange={(e) => run(actions.setLeadStatus(l.id, e.target.value as LeadStatus))}>
                          {(["new", "contacted", "converted", "lost"] as LeadStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      <TableCell>{userName(db, l.ownerId)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.requests || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quotes || "—"}</TableCell>
                      <TableCell>
                        {r.bookingIds.length
                          ? r.bookingIds.map((id) => (
                              <Link key={id} href={`/bookings/${id}`} onClick={(e) => e.stopPropagation()} className="mr-2 font-mono text-xs underline-offset-2 hover:underline">
                                {id}
                              </Link>
                            ))
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.value ? formatINR(r.value) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.received ? formatINR(r.received) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(l.createdAt)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {!l.otpVerified && !l.duplicateOf && (
                          <Button size="sm" variant="outline" onClick={() => run(actions.verifyOtp(l.id))}>
                            <ShieldCheck /> Mark OTP verified
                          </Button>
                        )}
                        {l.otpVerified && !l.duplicateOf && (
                          <Button size="sm" variant="outline" onClick={() => setRequestFor(l)}>
                            Raise request
                          </Button>
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
      <p className="text-muted-foreground mt-3 text-xs">
        Funnel steps are cumulative: a fully paid customer also counts as booked, quoted, request raised and lead. The tag on each row is the furthest stage
        reached. Duplicates (same phone number) are merged and excluded from the funnel.
      </p>

      <AddLeadDialog open={adding} onOpenChange={setAdding} />
      <RequestDialog lead={requestFor} onClose={() => setRequestFor(null)} />
    </>
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

function RequestDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { error, run, setError } = useAction();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  return (
    <Dialog
      open={!!lead}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise booking request</DialogTitle>
          <DialogDescription>For {lead?.customerName} ({lead?.id})</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Goa offsite – 3N, 20 pax" />
          </Field>
          <Field label="Details">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <ErrorText error={error} />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!lead) return;
              if (!title.trim()) return setError("Title is required");
              run(actions.createRequest(lead.id, title.trim(), details.trim()), (id) => {
                setTitle("");
                setDetails("");
                onClose();
                if (id) window.location.href = `/requests/${id}`;
              });
            }}
          >
            Create request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
