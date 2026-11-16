// All money figures are DERIVED here from line items and recorded transactions.
// Nothing in the UI lets a user type a margin, GST or payable directly.

import type { Booking, DB, LineItem, Quote, Vendor } from "./types";

export interface Totals {
  sell: number; // pre-GST value to customer
  cost: number; // pre-GST vendor cost
  gst: number; // GST charged to customer
  gross: number; // sell + gst (what the customer pays)
  margin: number; // sell - cost
  marginPct: number;
}

export function totals(items: LineItem[]): Totals {
  const sell = items.reduce((s, i) => s + i.price, 0);
  const cost = items.reduce((s, i) => s + i.cost, 0);
  const gst = items.reduce((s, i) => s + (i.price * i.gstRate) / 100, 0);
  const margin = sell - cost;
  return { sell, cost, gst, gross: sell + gst, margin, marginPct: sell ? (margin / sell) * 100 : 0 };
}

export const vendorById = (db: DB, id: string): Vendor | undefined => db.vendors.find((v) => v.id === id);

/** Line items whose vendor is not approved — their margin is reported separately. */
export function flaggedItems(db: DB, items: LineItem[]): LineItem[] {
  return items.filter((i) => vendorById(db, i.vendorId)?.status !== "approved");
}

export function quoteFor(db: DB, b: Booking): Quote | undefined {
  return db.quotes.find((q) => q.id === b.quoteId);
}

export interface BookingFinance {
  quoted: Totals; // at the time the customer accepted the quote
  booked: Totals; // current version after approved change requests
  realisedMargin: number | null; // booked sell − actual vendor invoices (null until invoices exist)
  invoicedCost: number;
  received: number;
  receivable: number;
  tdsDeducted: number;
  vendorPaidNet: number;
  vendorPayable: number; // invoiced cost − (net paid + TDS)
  flaggedMargin: number; // margin from non-approved vendors
  leakage: number; // booked margin − realised margin (cost overrun vs vendor quote)
}

export function bookingFinance(db: DB, b: Booking): BookingFinance {
  const q = quoteFor(db, b);
  const quoted = totals(q ? q.items : b.versions[0]?.items ?? b.items);
  const booked = totals(b.items);
  const invoicedCost = b.vendorInvoices.reduce((s, i) => s + i.amount, 0);
  const realisedMargin = b.vendorInvoices.length ? booked.sell - invoicedCost : null;
  const received = b.payments.reduce((s, p) => s + p.amount, 0);
  const tdsDeducted = b.vendorPayments.reduce((s, p) => s + p.tds, 0);
  const vendorPaidNet = b.vendorPayments.reduce((s, p) => s + p.net, 0);
  const flaggedMargin = totals(flaggedItems(db, b.items)).margin;
  return {
    quoted,
    booked,
    realisedMargin,
    invoicedCost,
    received,
    receivable: Math.max(0, booked.gross - received),
    tdsDeducted,
    vendorPaidNet,
    vendorPayable: Math.max(0, invoicedCost - vendorPaidNet - tdsDeducted),
    flaggedMargin,
    leakage: realisedMargin === null ? 0 : booked.margin - realisedMargin,
  };
}

export function tdsFor(vendor: Vendor | undefined, gross: number) {
  const tds = Math.round((gross * (vendor?.tdsRate ?? 0)) / 100);
  return { tds, net: gross - tds };
}
