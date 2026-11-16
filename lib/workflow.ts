// Lifecycle rules and follow-up automations. Tasks are generated from data,
// so nobody has to remember to create them, and they close themselves once done.

import type { Booking, BookingStatus, DB, EntityType, Task } from "./types";
import { totals } from "./finance";
import { uid } from "./utils";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_seller: "Awaiting seller",
  seller_accepted: "Seller accepted",
  confirmed: "Confirmed to customer",
  advance_paid: "Advance paid",
  fully_paid: "Fully paid",
  fulfilled: "Fulfilled",
  vendor_settled: "Vendor settled",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const BOOKING_FLOW: BookingStatus[] = [
  "pending_seller",
  "seller_accepted",
  "confirmed",
  "advance_paid",
  "fully_paid",
  "fulfilled",
  "vendor_settled",
  "closed",
];

/** Manual transitions allowed from each status. Payment statuses are set automatically by recorded payments. */
export const MANUAL_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending_seller: ["seller_accepted", "cancelled"],
  seller_accepted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  advance_paid: ["cancelled"],
  fully_paid: ["fulfilled"],
  fulfilled: [],
  vendor_settled: ["closed"],
};

/** Payment-driven status, given what has been received so far. */
export function paymentStatus(db: DB, b: Booking): BookingStatus | null {
  const order = BOOKING_FLOW.indexOf(b.status);
  if (b.status === "cancelled" || order < BOOKING_FLOW.indexOf("confirmed")) return null;
  if (order >= BOOKING_FLOW.indexOf("fulfilled")) return null;
  const gross = totals(b.items).gross;
  const received = b.payments.reduce((s, p) => s + p.amount, 0);
  if (received >= gross - 1) return "fully_paid";
  if (received >= (gross * db.settings.advancePct) / 100) return "advance_paid";
  return "confirmed";
}

interface Desired {
  ruleId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  assigneeId: string;
  dueAt: string;
}

const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();

const lastStatusAt = (b: Booking) => b.statusHistory[b.statusHistory.length - 1]?.at ?? b.createdAt;

export const AUTOMATION_RULES = [
  { id: "lead_first_contact", label: "First contact on new verified lead" },
  { id: "request_send_quote", label: "Send first quote on open request" },
  { id: "quote_follow_up", label: "Follow up on sent quote" },
  { id: "booking_seller_accept", label: "Chase seller acceptance" },
  { id: "booking_confirmation", label: "Send booking confirmation to customer" },
  { id: "booking_advance", label: "Collect advance payment" },
  { id: "booking_balance", label: "Collect balance payment" },
  { id: "change_request_decision", label: "Decide pending change request" },
] as const;

function desiredTasks(db: DB): Desired[] {
  const s = db.settings.sla;
  const out: Desired[] = [];

  for (const l of db.leads) {
    if (l.otpVerified && !l.duplicateOf && l.status === "new")
      out.push({
        ruleId: "lead_first_contact",
        entityType: "lead",
        entityId: l.id,
        title: `Call ${l.customerName} (first contact)`,
        assigneeId: l.ownerId,
        dueAt: addHours(l.createdAt, s.firstContactHours),
      });
  }

  for (const r of db.requests) {
    if (r.stage !== "open") continue;
    const sent = db.quotes.some((q) => q.requestId === r.id && q.status !== "draft");
    if (!sent)
      out.push({
        ruleId: "request_send_quote",
        entityType: "request",
        entityId: r.id,
        title: `Send quote: ${r.title}`,
        assigneeId: r.ownerId,
        dueAt: addHours(r.createdAt, s.quoteHours),
      });
  }

  for (const q of db.quotes) {
    if (q.status !== "sent" || !q.sentAt) continue;
    const r = db.requests.find((x) => x.id === q.requestId);
    out.push({
      ruleId: "quote_follow_up",
      entityType: "quote",
      entityId: q.id,
      title: `Follow up on quote #${q.number} (${r?.title ?? q.requestId})`,
      assigneeId: r?.ownerId ?? q.createdBy,
      dueAt: addHours(q.sentAt, s.quoteFollowUpHours),
    });
  }

  for (const b of db.bookings) {
    const since = lastStatusAt(b);
    const base = { entityType: "booking" as const, entityId: b.id, assigneeId: b.ownerId };
    if (b.status === "pending_seller")
      out.push({ ...base, ruleId: "booking_seller_accept", title: `Get seller acceptance: ${b.id}`, dueAt: addHours(since, s.sellerAcceptHours) });
    if (b.status === "seller_accepted")
      out.push({ ...base, ruleId: "booking_confirmation", title: `Send confirmation to customer: ${b.id}`, dueAt: addHours(since, s.confirmationHours) });
    if (b.status === "confirmed")
      out.push({ ...base, ruleId: "booking_advance", title: `Collect advance (${db.settings.advancePct}%): ${b.id}`, dueAt: addHours(since, s.advancePaymentHours) });
    if (b.status === "advance_paid")
      out.push({ ...base, ruleId: "booking_balance", title: `Collect balance payment: ${b.id}`, dueAt: addHours(since, s.advancePaymentHours * 3) });
  }

  for (const c of db.changeRequests) {
    if (c.status === "pending")
      out.push({
        ruleId: "change_request_decision",
        entityType: "change_request",
        entityId: c.id,
        title: `Approve/reject change request ${c.id}`,
        assigneeId: db.bookings.find((b) => b.id === c.bookingId)?.ownerId ?? c.createdBy,
        dueAt: addHours(c.createdAt, 24),
      });
  }
  return out;
}

/** Reconcile automatic tasks with current data: create missing ones, auto-close resolved ones. */
export function syncTasks(db: DB, now = new Date().toISOString()): Task[] {
  const desired = desiredTasks(db);
  const key = (r: string, e: string) => `${r}|${e}`;
  const wanted = new Map(desired.map((d) => [key(d.ruleId, d.entityId), d]));
  const tasks = db.tasks.map((t) => {
    if (t.ruleId === "manual" || t.status !== "open") return t;
    return wanted.has(key(t.ruleId, t.entityId)) ? t : { ...t, status: "auto_closed" as const, closedAt: now };
  });
  // A task the user already completed is not recreated for the same rule + record.
  const existing = new Set(tasks.filter((t) => t.status !== "auto_closed").map((t) => key(t.ruleId, t.entityId)));
  for (const d of desired) {
    if (existing.has(key(d.ruleId, d.entityId))) continue;
    tasks.push({ id: uid("TSK"), status: "open", createdAt: now, ...d });
  }
  return tasks;
}

export const isOverdue = (t: Task, now = Date.now()) => t.status === "open" && new Date(t.dueAt).getTime() < now;
