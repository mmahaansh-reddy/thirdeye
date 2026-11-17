// Work queues for the Finance team, derived from the same data as everything else.

import type { Booking, DB, Vendor } from "./types";
import { bookingFinance, type BookingFinance } from "./finance";

export interface FinRow {
  b: Booking;
  f: BookingFinance;
}

export interface PayoutRow {
  b: Booking;
  vendor: Vendor | undefined;
  invoiced: number;
  paid: number;
  payable: number;
}

export function financeDesk(db: DB) {
  const live = db.bookings.filter((b) => b.status !== "cancelled");
  const rows: FinRow[] = live.map((b) => ({ b, f: bookingFinance(db, b) }));
  const confirmedOn = ["confirmed", "advance_paid", "fully_paid", "fulfilled"];

  // Customer money still to collect (only once the booking is confirmed to the customer).
  const collect = rows.filter((x) => confirmedOn.includes(x.b.status) && x.f.receivable > 0);

  // Fulfilled bookings where at least one vendor has no invoice recorded yet.
  const toInvoice = rows
    .filter((x) => x.b.status === "fulfilled")
    .map((x) => {
      const vendorIds = [...new Set(x.b.items.map((i) => i.vendorId))];
      const missing = vendorIds.filter((v) => !x.b.vendorInvoices.some((i) => i.vendorId === v));
      return { ...x, missing: missing.map((id) => db.vendors.find((v) => v.id === id)?.name ?? id) };
    })
    .filter((x) => x.missing.length > 0);

  // Vendor invoices recorded but not fully paid out.
  const payouts: PayoutRow[] = [];
  for (const { b } of rows) {
    for (const vendorId of new Set(b.vendorInvoices.map((i) => i.vendorId))) {
      const invoiced = b.vendorInvoices.filter((i) => i.vendorId === vendorId).reduce((s, i) => s + i.amount, 0);
      const paid = b.vendorPayments.filter((p) => p.vendorId === vendorId).reduce((s, p) => s + p.gross, 0);
      if (invoiced - paid > 0) payouts.push({ b, vendor: db.vendors.find((v) => v.id === vendorId), invoiced, paid, payable: invoiced - paid });
    }
  }

  return {
    rows,
    collect,
    toInvoice,
    payouts,
    pendingVendors: db.vendors.filter((v) => v.status === "pending"),
    toClose: rows.filter((x) => x.b.status === "vendor_settled"),
    marginAlerts: rows.filter((x) => x.f.leakage > 0 || x.f.flaggedMargin !== 0),
  };
}
