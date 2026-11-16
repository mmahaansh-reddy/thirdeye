"use client";

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { DB, Lead, LeadStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";

const SOURCES = ["LeadSquared", "Zoho CRM", "Website", "Meta Ads", "Referral", "Walk-in / Phone"];

export default function LeadsPage() {
  const db = useDB();
  const [adding, setAdding] = useState(false);
  const [requestFor, setRequestFor] = useState<Lead | null>(null);
  if (!db) return <Loading />;

  const leads = db.leads.filter((l) => l.otpVerified && !l.duplicateOf);
  const enquiries = db.leads.filter((l) => !l.otpVerified && !l.duplicateOf);
  const dups = db.leads.filter((l) => l.duplicateOf);

  return (
    <>
      <PageHeader title="Leads & Enquiries" description="All CRMs feed one intake. Only OTP-verified contacts count as leads; the rest are tracked as enquiries.">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Capture intake
        </Button>
      </PageHeader>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="enquiries">Enquiries – no OTP ({enquiries.length})</TabsTrigger>
          <TabsTrigger value="dups">Duplicates ({dups.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="leads">
          <LeadTable db={db} rows={leads} onRequest={setRequestFor} />
        </TabsContent>
        <TabsContent value="enquiries">
          <LeadTable db={db} rows={enquiries} onRequest={setRequestFor} />
        </TabsContent>
        <TabsContent value="dups">
          <LeadTable db={db} rows={dups} onRequest={setRequestFor} />
        </TabsContent>
      </Tabs>

      <AddLeadDialog open={adding} onOpenChange={setAdding} />
      <RequestDialog lead={requestFor} onClose={() => setRequestFor(null)} />
    </>
  );
}

function LeadTable({ db, rows, onRequest }: { db: DB; rows: Lead[]; onRequest: (l: Lead) => void }) {
  const { error, run } = useAction();
  if (!rows.length) return <Empty>No records here.</Empty>;
  return (
    <Card className="py-2">
      <CardContent className="px-2">
        <ErrorText error={error} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>OTP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Captured</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => {
              const reqs = db.requests.filter((r) => r.leadId === l.id).length;
              return (
                <TableRow key={l.id} id={l.id}>
                  <TableCell className="font-mono text-xs">
                    {l.id}
                    {l.duplicateOf && <div className="text-muted-foreground">dup of {l.duplicateOf}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{l.customerName}</div>
                    <div className="text-muted-foreground text-xs">{l.phone}</div>
                  </TableCell>
                  <TableCell>{l.source}</TableCell>
                  <TableCell>{l.otpVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">No OTP</Badge>}</TableCell>
                  <TableCell>
                    <NativeSelect
                      className="h-8 w-32"
                      value={l.status}
                      onChange={(e) => run(actions.setLeadStatus(l.id, e.target.value as LeadStatus))}
                    >
                      {(["new", "contacted", "converted", "lost"] as LeadStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="text-sm">{userName(db, l.ownerId)}</TableCell>
                  <TableCell className="tabular-nums">{reqs}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(l.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {!l.otpVerified && (
                      <Button size="sm" variant="outline" onClick={() => run(actions.verifyOtp(l.id))}>
                        <ShieldCheck /> Mark OTP verified
                      </Button>
                    )}
                    {l.otpVerified && !l.duplicateOf && (
                      <Button size="sm" variant="outline" onClick={() => onRequest(l)}>
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
