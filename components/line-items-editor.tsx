"use client";

import { Plus, Trash2 } from "lucide-react";
import type { DB, LineItem } from "@/lib/types";
import { totals, vendorById } from "@/lib/finance";
import { formatINR, formatPct, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const blankItem = (db: DB): LineItem => ({
  id: uid("LI"),
  description: "",
  vendorId: db.vendors.find((v) => v.status === "approved")?.id ?? "",
  vendorQuoteRef: "",
  cost: 0,
  price: 0,
  gstRate: 18,
});

export function LineItemsEditor({ db, items, onChange }: { db: DB; items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const update = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const t = totals(items);
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground hidden grid-cols-[2fr_1.6fr_1fr_1fr_1fr_0.6fr_auto] gap-2 text-xs font-medium md:grid">
        <span>Description</span>
        <span>Vendor</span>
        <span>Vendor quote ref</span>
        <span>Vendor cost ₹</span>
        <span>Sell price ₹</span>
        <span>GST %</span>
        <span />
      </div>
      {items.map((i) => {
        const v = vendorById(db, i.vendorId);
        return (
          <div key={i.id} className="grid grid-cols-2 gap-2 md:grid-cols-[2fr_1.6fr_1fr_1fr_1fr_0.6fr_auto]">
            <Input className="col-span-2 md:col-span-1" placeholder="Description" value={i.description} onChange={(e) => update(i.id, { description: e.target.value })} />
            <div className="col-span-2 flex items-center gap-1 md:col-span-1">
              <NativeSelect value={i.vendorId} onChange={(e) => update(i.id, { vendorId: e.target.value })}>
                <option value="">Select vendor</option>
                {db.vendors.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.status !== "approved" ? ` (${x.status.toUpperCase()})` : ""}
                  </option>
                ))}
              </NativeSelect>
              {v && v.status !== "approved" && <Badge variant="destructive">!</Badge>}
            </div>
            <Input placeholder="Ref no." value={i.vendorQuoteRef} onChange={(e) => update(i.id, { vendorQuoteRef: e.target.value })} />
            <Input type="number" min={0} value={i.cost || ""} onChange={(e) => update(i.id, { cost: Number(e.target.value) })} />
            <Input type="number" min={0} value={i.price || ""} onChange={(e) => update(i.id, { price: Number(e.target.value) })} />
            <Input type="number" min={0} value={i.gstRate} onChange={(e) => update(i.id, { gstRate: Number(e.target.value) })} />
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => onChange(items.filter((x) => x.id !== i.id))}>
              <Trash2 />
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => onChange([...items, blankItem(db)])}>
          <Plus /> Add line
        </Button>
        <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          <span>Sell <b className="text-foreground">{formatINR(t.sell)}</b></span>
          <span>Cost <b className="text-foreground">{formatINR(t.cost)}</b></span>
          <span>GST <b className="text-foreground">{formatINR(t.gst)}</b></span>
          <span>Customer pays <b className="text-foreground">{formatINR(t.gross)}</b></span>
          <span>Margin <b className={t.margin < 0 ? "text-destructive" : "text-foreground"}>{formatINR(t.margin)} ({formatPct(t.marginPct)})</b></span>
        </div>
      </div>
    </div>
  );
}

export function LineItemsTable({ db, items }: { db: DB; items: LineItem[] }) {
  const t = totals(items);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-b">
            <th className="py-1.5 text-left font-medium">Item</th>
            <th className="text-left font-medium">Vendor</th>
            <th className="text-left font-medium">Vendor ref</th>
            <th className="text-right font-medium">Cost</th>
            <th className="text-right font-medium">Sell</th>
            <th className="text-right font-medium">GST</th>
            <th className="text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const v = vendorById(db, i.vendorId);
            return (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-1.5">{i.description}</td>
                <td>
                  {v?.name ?? "—"} {v && v.status !== "approved" && <Badge variant="destructive">{v.status}</Badge>}
                </td>
                <td className="font-mono text-xs">{i.vendorQuoteRef}</td>
                <td className="text-right tabular-nums">{formatINR(i.cost)}</td>
                <td className="text-right tabular-nums">{formatINR(i.price)}</td>
                <td className="text-right tabular-nums">{i.gstRate}%</td>
                <td className="text-right tabular-nums">{formatINR(i.price - i.cost)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="pt-2" colSpan={3}>
              Total (customer pays {formatINR(t.gross)})
            </td>
            <td className="pt-2 text-right tabular-nums">{formatINR(t.cost)}</td>
            <td className="pt-2 text-right tabular-nums">{formatINR(t.sell)}</td>
            <td className="pt-2 text-right tabular-nums">{formatINR(t.gst)}</td>
            <td className="pt-2 text-right tabular-nums">
              {formatINR(t.margin)} ({formatPct(t.marginPct)})
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
