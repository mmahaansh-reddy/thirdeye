"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { DB, Vendor, VendorStatus } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { bookingFinance } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataList, type Column } from "@/components/data-list";
import { ErrorText, Field, Loading, PageHeader, useAction } from "@/components/common";

const TONE: Record<VendorStatus, "success" | "warning" | "destructive"> = { approved: "success", pending: "warning", rejected: "destructive" };

export default function VendorsPage() {
  const db = useDB();
  const { error, run } = useAction();
  const [adding, setAdding] = useState(false);
  if (!db) return <Loading />;

  return (
    <>
      <PageHeader title="Vendor master" description="Only approved vendors can be quoted. Approval needs GSTIN + PAN and is restricted to Finance/Admin.">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add vendor
        </Button>
      </PageHeader>
      <ErrorText error={error} />
      <div className="mt-2">
        <DataList rows={db.vendors} columns={vendorColumns(db, run)} rowKey={(v) => v.id} breakpoint="xl" />
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Margin currently booked through non-approved vendors:{" "}
        <b className="text-destructive">
          {formatINR(db.bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + bookingFinance(db, b).flaggedMargin, 0))}
        </b>
      </p>
      <AddVendorDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

function vendorColumns(db: DB, run: ReturnType<typeof useAction>["run"]): Column<Vendor>[] {
  return [
    {
      header: "Vendor",
      card: "title",
      cell: (v) => (
        <div>
          <div className="font-medium">{v.name}</div>
          <div className="text-muted-foreground text-xs">
            <span className="font-mono">{v.id}</span> · {v.category}
          </div>
        </div>
      ),
    },
    {
      header: "GSTIN / PAN",
      cell: (v) => (
        <div className="font-mono text-xs">
          <div>{v.gstin || <span className="text-destructive">GSTIN missing</span>}</div>
          <div>{v.pan || <span className="text-destructive">PAN missing</span>}</div>
        </div>
      ),
    },
    { header: "TDS", align: "right", cell: (v) => `${v.tdsRate}%` },
    {
      header: "Booked cost / invoiced",
      align: "right",
      cell: (v) => {
        const bookedCost = db.bookings
          .filter((b) => b.status !== "cancelled")
          .flatMap((b) => b.items)
          .filter((i) => i.vendorId === v.id)
          .reduce((s, i) => s + i.cost, 0);
        const invoiced = db.bookings.flatMap((b) => b.vendorInvoices).filter((i) => i.vendorId === v.id).reduce((s, i) => s + i.amount, 0);
        return (
          <>
            <div>{formatINR(bookedCost)}</div>
            <div className="text-muted-foreground text-xs">{formatINR(invoiced)} invoiced</div>
          </>
        );
      },
    },
    { header: "Status", cell: (v) => <Badge variant={TONE[v.status]}>{v.status}</Badge> },
    {
      header: "Action",
      stop: true,
      cell: (v) => (
        <div className="flex flex-wrap gap-1">
          {v.status !== "approved" && (
            <Button size="sm" variant="outline" onClick={() => run(actions.setVendorStatus(v.id, "approved"))}>
              Approve
            </Button>
          )}
          {v.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={() => run(actions.setVendorStatus(v.id, "rejected"))}>
              Reject
            </Button>
          )}
        </div>
      ),
    },
  ];
}

function AddVendorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { error, run, setError } = useAction();
  const empty = { name: "", category: "", gstin: "", pan: "", tdsRate: "2" };
  const [f, setF] = useState(empty);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add vendor</DialogTitle>
          <DialogDescription>New vendors start as pending and cannot be quoted until approved.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GSTIN"><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="PAN"><Input value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} /></Field>
          </div>
          <Field label="TDS rate %"><Input type="number" value={f.tdsRate} onChange={(e) => setF({ ...f, tdsRate: e.target.value })} /></Field>
          <ErrorText error={error} />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!f.name.trim()) return setError("Name is required");
              run(actions.addVendor({ name: f.name.trim(), category: f.category.trim(), gstin: f.gstin.trim(), pan: f.pan.trim(), tdsRate: Number(f.tdsRate) || 0 }), () => {
                setF(empty);
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
