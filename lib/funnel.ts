// Single source for the funnel. The Leads and Enquiries page and the dashboard funnel graph both read from here,
// so their numbers always match. One row per unique customer (duplicates are kept but flagged and excluded).

import type { DB, Lead } from "./types";
import { bookingFinance } from "./finance";
import { BOOKING_FLOW } from "./workflow";

/** Funnel steps, in order. Counts are cumulative: a customer who is Fully paid also counts as Booked, Quoted, Request and Lead. */
export type FunnelStep = "enquiry" | "lead" | "request" | "quoted" | "booked" | "paid";

export const STEPS: { key: FunnelStep; label: string }[] = [
  { key: "enquiry", label: "Enquiries (no OTP)" },
  { key: "lead", label: "Leads (OTP verified)" },
  { key: "request", label: "Requests raised" },
  { key: "quoted", label: "Quoted" },
  { key: "booked", label: "Booked" },
  { key: "paid", label: "Fully paid" },
];

/** The tag shown on a row: the furthest stage reached, or Lost / Duplicate. */
export type FunnelTag = FunnelStep | "lost" | "duplicate";

export const TAG_LABEL: Record<FunnelTag, string> = {
  enquiry: "Enquiry (no OTP)",
  lead: "Lead",
  request: "Request raised",
  quoted: "Quoted",
  booked: "Booked",
  paid: "Fully paid",
  lost: "Lost",
  duplicate: "Duplicate (merged)",
};

export type StepFilter = FunnelTag | "all";

/** Position on the 6-step progress bar (0 = enquiry … 5 = fully paid). */
export const TAG_DEPTH: Record<FunnelTag, number> = { enquiry: 0, lead: 1, request: 2, quoted: 3, booked: 4, paid: 5, lost: 1, duplicate: 0 };

export interface FunnelRow {
  lead: Lead;
  tag: FunnelTag;
  reached: Record<FunnelStep, boolean>;
  requests: number;
  quotes: number;
  bookingIds: string[];
  requestIds: string[];
  value: number; // booked value incl. GST on live bookings
  received: number;
}

const PAID_INDEX = BOOKING_FLOW.indexOf("fully_paid");

export function funnelRows(db: DB): FunnelRow[] {
  return db.leads.map((lead) => {
    const unique = !lead.duplicateOf;
    const requests = db.requests.filter((r) => r.leadId === lead.id);
    const requestIds = requests.map((r) => r.id);
    const sentQuotes = db.quotes.filter((q) => requestIds.includes(q.requestId) && q.status !== "draft");
    const bookings = db.bookings.filter((b) => b.leadId === lead.id && b.status !== "cancelled");
    const fin = bookings.map((b) => bookingFinance(db, b));
    const hasPaid = bookings.some((b) => BOOKING_FLOW.indexOf(b.status) >= PAID_INDEX);

    const reached: Record<FunnelStep, boolean> = {
      enquiry: unique && !lead.otpVerified,
      lead: unique && lead.otpVerified,
      request: unique && requests.length > 0,
      quoted: unique && sentQuotes.length > 0,
      booked: unique && bookings.length > 0,
      paid: unique && hasPaid,
    };

    let tag: FunnelTag;
    if (!unique) tag = "duplicate";
    else if (hasPaid) tag = "paid";
    else if (bookings.length) tag = "booked";
    else if (lead.status === "lost" || (requests.length > 0 && requests.every((r) => r.stage === "lost"))) tag = "lost";
    else if (sentQuotes.length) tag = "quoted";
    else if (requests.length) tag = "request";
    else tag = lead.otpVerified ? "lead" : "enquiry";

    return {
      lead,
      tag,
      reached,
      requests: requests.length,
      quotes: sentQuotes.length,
      bookingIds: bookings.map((b) => b.id),
      requestIds,
      value: fin.reduce((s, f) => s + f.booked.gross, 0),
      received: fin.reduce((s, f) => s + f.received, 0),
    };
  });
}

/** Does this row belong to the chosen filter? Funnel steps are cumulative ("reached at least"). */
export function rowMatches(row: FunnelRow, filter: StepFilter): boolean {
  if (filter === "all") return true;
  if (filter === "lost" || filter === "duplicate") return row.tag === filter;
  return row.reached[filter];
}

/** The numbers behind the dashboard funnel graph and the filter chips on the Leads and Enquiries page. */
export function funnelSteps(rows: FunnelRow[]) {
  return STEPS.map((s) => ({ ...s, value: rows.filter((r) => r.reached[s.key]).length }));
}
