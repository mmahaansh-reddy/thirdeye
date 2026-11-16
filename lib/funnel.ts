// One row per customer journey (unique lead/enquiry), tagged with the furthest funnel stage reached.
// Tags are exclusive, so the per-tag counts add up to the total number of rows.

import type { DB, Lead } from "./types";
import { bookingFinance } from "./finance";
import { BOOKING_FLOW } from "./workflow";

export type FunnelStage = "enquiry" | "lead" | "request" | "quoted" | "booked" | "paid" | "lost" | "duplicate";

export const STAGE_ORDER: FunnelStage[] = ["enquiry", "lead", "request", "quoted", "booked", "paid", "lost", "duplicate"];

export const STAGE_LABEL: Record<FunnelStage, string> = {
  enquiry: "Enquiry (no OTP)",
  lead: "Lead (OTP verified)",
  request: "Request raised",
  quoted: "Quoted",
  booked: "Booked",
  paid: "Fully paid",
  lost: "Lost",
  duplicate: "Duplicate (merged)",
};

/** Progress through the 6 funnel steps (0 = enquiry … 5 = fully paid). */
export const STAGE_DEPTH: Record<FunnelStage, number> = {
  enquiry: 0, lead: 1, request: 2, quoted: 3, booked: 4, paid: 5, lost: 1, duplicate: 0,
};

export interface FunnelRow {
  lead: Lead;
  stage: FunnelStage;
  requests: number;
  quotes: number;
  bookingIds: string[];
  requestIds: string[];
  value: number; // booked value incl. GST on live bookings
  received: number;
  href: string;
}

const PAID_INDEX = BOOKING_FLOW.indexOf("fully_paid");

export function funnelRows(db: DB): FunnelRow[] {
  return db.leads.map((lead) => {
    const requests = db.requests.filter((r) => r.leadId === lead.id);
    const requestIds = requests.map((r) => r.id);
    const quotes = db.quotes.filter((q) => requestIds.includes(q.requestId) && q.status !== "draft");
    const bookings = db.bookings.filter((b) => b.leadId === lead.id && b.status !== "cancelled");
    const fin = bookings.map((b) => bookingFinance(db, b));

    let stage: FunnelStage;
    if (lead.duplicateOf) stage = "duplicate";
    else if (bookings.some((b) => BOOKING_FLOW.indexOf(b.status) >= PAID_INDEX)) stage = "paid";
    else if (bookings.length) stage = "booked";
    else if (lead.status === "lost" || (requests.length > 0 && requests.every((r) => r.stage === "lost"))) stage = "lost";
    else if (requests.some((r) => db.quotes.some((q) => q.requestId === r.id && q.status !== "draft"))) stage = "quoted";
    else if (requests.length) stage = "request";
    else stage = lead.otpVerified ? "lead" : "enquiry";

    const href = bookings[0] ? `/bookings/${bookings[0].id}` : requests[0] ? `/requests/${requests[0].id}` : `/leads#${lead.id}`;
    return {
      lead,
      stage,
      requests: requests.length,
      quotes: quotes.length,
      bookingIds: bookings.map((b) => b.id),
      requestIds,
      value: fin.reduce((s, f) => s + f.booked.gross, 0),
      received: fin.reduce((s, f) => s + f.received, 0),
      href,
    };
  });
}
