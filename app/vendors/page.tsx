"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { actions, useDB } from "@/lib/store";
import type { VendorStatus } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { bookingFinance } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <Card className="mt-2 py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>GSTIN / PAN</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Booked cost</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {db.vendors.map((v) => {
                const bookedCost = db.bookings
                  .filter((b) => b.status !== "cancelled")
                  .flatMap((b) => b.items)
                  .filter((i) => i.vendorId === v.id)
                  .reduce((s, i) => s + i.cost, 0);
                const invoiced = db.bookings.flatMap((b) => b.vendorInvoices).filter((i) => i.vendorId === v.id).reduce((s, i) => s + i.amount, 0);
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{v.id}</div>
                    </TableCell>
                    <TableCell>{v.category}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.gstin || <span className="text-destructive">missing</span>} / {v.pan || <span className="text-destructive">missing</span>}
                    </TableCell>
                    <TableCell className="text-right">{v.tdsRate}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(bookedCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(invoiced)}</TableCell>
                    <TableCell>
                      <Badge variant={TONE[v.status]}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
