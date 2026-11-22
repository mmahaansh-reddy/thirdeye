"use client";

// Single source of truth, persisted to localStorage for now.
// Every mutation goes through `commit`, which: applies business rules,
// writes an audit entry, re-syncs automatic follow-up tasks, and persists.
// Swapping to a real database later means re-implementing load/save + these actions as API calls.

import { useSyncExternalStore } from "react";
import type {
  AuditEntry, Booking, BookingStatus, ChangeRequest, DB, EntityType, LeadStatus, LineItem, Quote, Role, Settings, User, Vendor, VendorStatus,
} from "./types";
import { seedDB } from "./seed";
import { MANUAL_TRANSITIONS, paymentStatus, syncTasks, BOOKING_STATUS_LABEL } from "./workflow";
import { flaggedItems, tdsFor, totals, vendorById } from "./finance";
import { uid } from "./utils";

const STORAGE_KEY = "mahaansh:db:v1";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

let state: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? (JSON.parse(raw) as DB) : seedDB();
  } catch {
    state = seedDB();
  }
  state = { ...state, tasks: syncTasks(state) };
  save(state);
  return state;
}

function save(db: DB) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full or unavailable — state still lives in memory */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = null;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** React hook: returns the DB, or null during server render / before hydration. */
export function useDB(): DB | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

export function useCurrentUser(): User | null {
  const db = useDB();
  return db ? currentUser(db) : null;
}

const now = () => new Date().toISOString();

export function currentUser(db: DB): User {
  return db.users.find((u) => u.id === db.settings.currentUserId) ?? db.users[0];
}

function log(db: DB, action: string, entityType: EntityType, entityId: string, details?: string, severity: AuditEntry["severity"] = "info") {
  db.audit.unshift({ id: uid("A"), at: now(), actorId: db.settings.currentUserId, action, entityType, entityId, details, severity });
}

/** Run a mutation. Throwing `Blocked` rejects it, records the attempt, and leaves data untouched. */
class Blocked extends Error {
  constructor(message: string, public entityType: EntityType, public entityId: string) {
    super(message);
  }
}

function commit(mutate: (db: DB) => string | void): Result {
  const draft: DB = structuredClone(load());
  try {
    const id = mutate(draft);
    draft.tasks = syncTasks(draft);
    state = draft;
    save(draft);
    emit();
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    if (e instanceof Blocked) {
      const db: DB = structuredClone(load());
      log(db, `BLOCKED: ${e.message}`, e.entityType, e.entityId, undefined, "blocked");
      state = db;
      save(db);
      emit();
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

function requireRole(db: DB, roles: Role[], what: string, entityType: EntityType, entityId: string) {
  const u = currentUser(db);
  if (!roles.includes(u.role)) throw new Blocked(`${u.name} (${u.role}) tried to ${what}; allowed: ${roles.join(", ")}`, entityType, entityId);
}

function find<T extends { id: string }>(list: T[], id: string, label: string): T {
  const x = list.find((i) => i.id === id);
  if (!x) throw new Error(`${label} ${id} not found`);
  return x;
}

/** Non-approved vendors need an admin override with a reason. */
function checkVendors(db: DB, items: LineItem[], entityType: EntityType, entityId: string, overrideReason?: string) {
  if (!items.length) throw new Error("Add at least one line item");
  for (const i of items) {
    if (!vendorById(db, i.vendorId)) throw new Error(`Line "${i.description}" has no vendor`);
    if (!i.vendorQuoteRef.trim()) throw new Error(`Line "${i.description}" needs the vendor's quote reference`);
    if (i.cost <= 0 || i.price <= 0) throw new Error(`Line "${i.description}" needs a cost and price above zero`);
  }
  const flagged = flaggedItems(db, items);
  if (!flagged.length) return undefined;
  const names = flagged.map((i) => vendorById(db, i.vendorId)?.name).join(", ");
  if (currentUser(db).role !== "admin" || !overrideReason?.trim())
    throw new Blocked(`use non-approved vendor(s) ${names} without admin override`, entityType, entityId);
  return { approvedBy: db.settings.currentUserId, reason: overrideReason.trim(), at: now() };
}

function setStatus(db: DB, b: Booking, status: BookingStatus) {
  if (b.status === status) return;
  b.status = status;
  b.statusHistory.push({ status, at: now(), by: db.settings.currentUserId });
  log(db, `Booking → ${BOOKING_STATUS_LABEL[status]}`, "booking", b.id);
}

export const actions = {
  setCurrentUser: (id: string) =>
    commit((db) => {
      db.settings.currentUserId = id;
    }),

  resetDemo: () => {
    state = seedDB();
    save(state);
    emit();
  },

  updateSettings: (patch: Partial<Settings>) =>
    commit((db) => {
      requireRole(db, ["admin"], "change settings", "settings", "settings");
      const before = JSON.stringify({ r: db.settings.presalesRoutingRole, s: db.settings.sla, a: db.settings.advancePct });
      db.settings = { ...db.settings, ...patch, currentUserId: db.settings.currentUserId };
      log(db, "Updated settings", "settings", "settings", `before: ${before}`, "warning");
    }),

  // ---------- Leads ----------
  addLead: (input: { source: string; customerName: string; phone: string; email?: string; otpVerified: boolean }) =>
    commit((db) => {
      const phone = input.phone.replace(/\D/g, "").slice(-10);
      if (phone.length !== 10) throw new Error("Enter a valid 10-digit phone number");
      const original = db.leads.find((l) => l.phone === phone && !l.duplicateOf);
      const id = uid("L");
      db.leads.unshift({ ...input, phone, id, status: "new", ownerId: db.settings.currentUserId, duplicateOf: original?.id, createdAt: now() });
      log(db, `${input.otpVerified ? "Lead" : "Enquiry (no OTP)"} captured from ${input.source}${original ? ` — duplicate of ${original.id}` : ""}`, "lead", id);
      return id;
    }),

  verifyOtp: (leadId: string) =>
    commit((db) => {
      const l = find(db.leads, leadId, "Lead");
      l.otpVerified = true;
      log(db, "OTP verified — enquiry promoted to lead", "lead", l.id);
    }),

  setLeadStatus: (leadId: string, status: LeadStatus) =>
    commit((db) => {
      const l = find(db.leads, leadId, "Lead");
      log(db, `Lead status ${l.status} → ${status}`, "lead", l.id);
      l.status = status;
    }),

  // ---------- Vendors ----------
  addVendor: (v: Omit<Vendor, "id" | "status" | "createdAt">) =>
    commit((db) => {
      const id = uid("V");
      db.vendors.push({ ...v, id, status: "pending", createdAt: now() });
      log(db, `Vendor ${v.name} added (pending approval)`, "vendor", id);
      return id;
    }),

  setVendorStatus: (vendorId: string, status: VendorStatus) =>
    commit((db) => {
      requireRole(db, ["admin", "finance"], `set vendor status to ${status}`, "vendor", vendorId);
      const v = find(db.vendors, vendorId, "Vendor");
      if (status === "approved" && (!v.gstin || !v.pan)) throw new Error("GSTIN and PAN are required before approval");
      log(db, `Vendor ${v.name}: ${v.status} → ${status}`, "vendor", v.id, undefined, "warning");
      v.status = status;
    }),

  // ---------- Requests & quotes ----------
  createRequest: (leadId: string, title: string, details: string) =>
    commit((db) => {
      const l = find(db.leads, leadId, "Lead");
      if (!l.otpVerified) throw new Blocked("create a request on an enquiry without OTP verification", "lead", l.id);
      if (l.duplicateOf) throw new Error(`This is a duplicate of ${l.duplicateOf}; raise the request there`);
      const id = uid("R");
      db.requests.unshift({ id, leadId, title, details, ownerId: l.ownerId, stage: "open", createdAt: now() });
      if (l.status === "new") l.status = "contacted";
      log(db, `Request raised: ${title}`, "request", id);
      return id;
    }),

  routeToPresales: (requestId: string, assigneeId: string) =>
    commit((db) => {
      const r = find(db.requests, requestId, "Request");
      requireRole(db, [db.settings.presalesRoutingRole, "admin"], "route a request to pre-sales", "request", r.id);
      if (r.presales) throw new Error("Already with pre-sales");
      r.presales = { routedBy: db.settings.currentUserId, routedAt: now(), assigneeId };
      log(db, "Routed to pre-sales", "request", r.id);
    }),

  addQuote: (requestId: string, items: LineItem[], overrideReason?: string) =>
    commit((db) => {
      const r = find(db.requests, requestId, "Request");
      if (r.stage === "won" || r.stage === "lost") throw new Error("Request is already closed");
      const vendorOverride = checkVendors(db, items, "request", r.id, overrideReason);
      const number = db.quotes.filter((q) => q.requestId === r.id).length + 1;
      const id = uid("Q");
      const q: Quote = { id, requestId, number, items, status: "draft", createdBy: db.settings.currentUserId, createdAt: now(), vendorOverride };
      db.quotes.push(q);
      const t = totals(items);
      log(db, `Quote #${number} drafted (margin ${t.marginPct.toFixed(1)}%)`, "quote", id, vendorOverride ? `Vendor override: ${vendorOverride.reason}` : undefined, vendorOverride ? "warning" : "info");
      return id;
    }),

  sendQuote: (quoteId: string) =>
    commit((db) => {
      const q = find(db.quotes, quoteId, "Quote");
      if (q.status !== "draft") throw new Error("Only drafts can be sent");
      q.status = "sent";
      q.sentAt = now();
      const r = find(db.requests, q.requestId, "Request");
      if (r.stage === "open") r.stage = "quoted";
      log(db, `Quote #${q.number} sent to customer`, "quote", q.id);
    }),

  rejectQuote: (quoteId: string) =>
    commit((db) => {
      const q = find(db.quotes, quoteId, "Quote");
      if (q.status !== "sent") throw new Error("Only sent quotes can be rejected");
      q.status = "rejected";
      q.decidedAt = now();
      log(db, `Quote #${q.number} rejected by customer`, "quote", q.id);
    }),

  acceptQuote: (quoteId: string) =>
    commit((db) => {
      const q = find(db.quotes, quoteId, "Quote");
      if (q.status !== "sent") throw new Error("Only sent quotes can be accepted");
      // Re-check vendors at acceptance: a vendor may have been rejected since the quote was made.
      if (!q.vendorOverride) checkVendors(db, q.items, "quote", q.id);
      const r = find(db.requests, q.requestId, "Request");
      q.status = "accepted";
      q.decidedAt = now();
      db.quotes.forEach((o) => {
        if (o.requestId === r.id && o.id !== q.id && (o.status === "sent" || o.status === "draft")) o.status = "superseded";
      });
      r.stage = "won";
      const lead = find(db.leads, r.leadId, "Lead");
      lead.status = "converted";
      const id = uid("B");
      const at = now();
      db.bookings.unshift({
        id, requestId: r.id, leadId: r.leadId, quoteId: q.id, ownerId: r.ownerId, status: "pending_seller", version: 1,
        items: structuredClone(q.items), versions: [{ version: 1, items: structuredClone(q.items), at }],
        statusHistory: [{ status: "pending_seller", at, by: db.settings.currentUserId }],
        payments: [], vendorInvoices: [], vendorPayments: [], createdAt: at,
      });
      log(db, `Quote #${q.number} accepted → booking ${id} created`, "booking", id);
      return id;
    }),

  closeRequestLost: (requestId: string) =>
    commit((db) => {
      const r = find(db.requests, requestId, "Request");
      r.stage = "lost";
      db.quotes.forEach((q) => {
        if (q.requestId === r.id && (q.status === "sent" || q.status === "draft")) q.status = "rejected";
      });
      log(db, "Request marked lost", "request", r.id);
    }),

  // ---------- Bookings ----------
  setBookingStatus: (bookingId: string, status: BookingStatus) =>
    commit((db) => {
      const b = find(db.bookings, bookingId, "Booking");
      if (!MANUAL_TRANSITIONS[b.status]?.includes(status))
        throw new Blocked(`move booking from ${BOOKING_STATUS_LABEL[b.status]} to ${BOOKING_STATUS_LABEL[status]}`, "booking", b.id);
      if (status === "seller_accepted") requireRole(db, ["seller", "admin"], "mark seller acceptance", "booking", b.id);
      if (status === "closed") requireRole(db, ["finance", "admin"], "close a booking", "booking", b.id);
      setStatus(db, b, status);
    }),

  recordPayment: (bookingId: string, amount: number, mode: string, reference: string) =>
    commit((db) => {
      const b = find(db.bookings, bookingId, "Booking");
      if (["pending_seller", "seller_accepted", "cancelled"].includes(b.status)) throw new Error("Confirm the booking before taking payment");
      if (amount <= 0) throw new Error("Amount must be positive");
      if (!reference.trim()) throw new Error("Payment reference is required for reconciliation");
      b.payments.push({ id: uid("P"), amount, mode, reference: reference.trim(), at: now() });
      log(db, `Payment received ₹${amount.toLocaleString("en-IN")} via ${mode} (${reference})`, "booking", b.id);
      const next = paymentStatus(db, b);
      if (next) setStatus(db, b, next);
    }),

  raiseChangeRequest: (bookingId: string, raisedBy: ChangeRequest["raisedBy"], description: string, proposedItems: LineItem[]) =>
    commit((db) => {
      const b = find(db.bookings, bookingId, "Booking");
      if (["cancelled", "closed", "vendor_settled"].includes(b.status)) throw new Error("Booking can no longer be changed");
      if (!description.trim()) throw new Error("Describe the change");
      checkVendorsSoft(db, proposedItems);
      // A change cannot bring in a vendor that is not approved (unless that vendor is already on the booking).
      for (const i of proposedItems) {
        const v = vendorById(db, i.vendorId);
        if (v && v.status !== "approved" && !b.items.some((x) => x.vendorId === i.vendorId)) {
          throw new Error(`${v.name} is not an approved vendor. Ask Finance to approve them before adding them to a booking`);
        }
      }
      const strip = (items: LineItem[]) => JSON.stringify(items.map(({ id: _id, ...rest }) => rest));
      if (strip(proposedItems) === strip(b.items)) throw new Error("No changes made: edit at least one line before submitting");
      const before = totals(b.items);
      const after = totals(proposedItems);
      const id = uid("CR");
      db.changeRequests.unshift({
        id, bookingId, raisedBy, description, proposedItems, valueDelta: after.sell - before.sell, marginDelta: after.margin - before.margin, baseGross: before.gross,
        status: "pending", createdBy: db.settings.currentUserId, createdAt: now(),
      });
      log(db, `Change request raised by ${raisedBy}: ${description}`, "change_request", id);
      return id;
    }),

  decideChangeRequest: (crId: string, approve: boolean) =>
    commit((db) => {
      const c = find(db.changeRequests, crId, "Change request");
      requireRole(db, ["admin"], "decide a change request", "change_request", c.id);
      if (c.status !== "pending") throw new Error("Already decided");
      if (approve) {
        const cur = find(db.bookings, c.bookingId, "Booking");
        if (c.baseGross !== undefined && Math.round(totals(cur.items).gross) !== Math.round(c.baseGross)) {
          throw new Error("The booking changed after this request was raised. Reject it and raise a fresh one");
        }
      }
      c.status = approve ? "approved" : "rejected";
      c.decidedBy = db.settings.currentUserId;
      c.decidedAt = now();
      if (approve) {
        const b = find(db.bookings, c.bookingId, "Booking");
        b.version += 1;
        b.items = structuredClone(c.proposedItems);
        b.versions.push({ version: b.version, items: structuredClone(c.proposedItems), at: now(), changeRequestId: c.id });
        const next = paymentStatus(db, b);
        if (next) setStatus(db, b, next);
      }
      log(db, `Change request ${approve ? "approved" : "rejected"} (margin Δ ₹${c.marginDelta.toLocaleString("en-IN")})`, "change_request", c.id);
    }),

  recordVendorInvoice: (bookingId: string, vendorId: string, invoiceNo: string, amount: number) =>
    commit((db) => {
      const b = find(db.bookings, bookingId, "Booking");
      requireRole(db, ["finance", "admin"], "record a vendor invoice", "booking", b.id);
      if (!b.items.some((i) => i.vendorId === vendorId)) throw new Blocked("record an invoice from a vendor not on this booking", "booking", b.id);
      if (!invoiceNo.trim() || amount <= 0) throw new Error("Invoice number and amount are required");
      b.vendorInvoices.push({ id: uid("VI"), vendorId, invoiceNo: invoiceNo.trim(), amount, at: now() });
      const quoted = b.items.filter((i) => i.vendorId === vendorId).reduce((s, i) => s + i.cost, 0);
      const billed = b.vendorInvoices.filter((i) => i.vendorId === vendorId).reduce((s, i) => s + i.amount, 0);
      const over = billed - quoted;
      log(db, `Vendor invoice ${invoiceNo} recorded`, "booking", b.id, over > 0 ? `Over vendor quote by ₹${over.toLocaleString("en-IN")}` : undefined, over > 0 ? "warning" : "info");
    }),

  recordVendorPayment: (bookingId: string, vendorId: string, gross: number) =>
    commit((db) => {
      const b = find(db.bookings, bookingId, "Booking");
      requireRole(db, ["finance", "admin"], "pay a vendor", "booking", b.id);
      const invoiced = b.vendorInvoices.filter((i) => i.vendorId === vendorId).reduce((s, i) => s + i.amount, 0);
      const paid = b.vendorPayments.filter((p) => p.vendorId === vendorId).reduce((s, p) => s + p.gross, 0);
      if (gross <= 0) throw new Error("Amount must be positive");
      if (paid + gross > invoiced) throw new Blocked("pay a vendor more than their recorded invoices", "booking", b.id);
      const { tds, net } = tdsFor(vendorById(db, vendorId), gross);
      b.vendorPayments.push({ id: uid("VP"), vendorId, gross, tds, net, at: now() });
      log(db, `Vendor paid ₹${net.toLocaleString("en-IN")} (TDS ₹${tds.toLocaleString("en-IN")})`, "booking", b.id);
      const allVendors = [...new Set(b.items.map((i) => i.vendorId))];
      const settled = allVendors.every((v) => {
        const inv = b.vendorInvoices.filter((i) => i.vendorId === v).reduce((s, i) => s + i.amount, 0);
        const pd = b.vendorPayments.filter((p) => p.vendorId === v).reduce((s, p) => s + p.gross, 0);
        return inv > 0 && pd >= inv;
      });
      if (settled && b.status === "fulfilled") setStatus(db, b, "vendor_settled");
    }),

  // ---------- Tasks ----------
  completeTask: (taskId: string) =>
    commit((db) => {
      const t = find(db.tasks, taskId, "Task");
      t.status = "done";
      t.closedAt = now();
      log(db, `Task done: ${t.title}`, "task", t.id);
    }),

  addTask: (title: string, assigneeId: string, dueAt: string) =>
    commit((db) => {
      const id = uid("TSK");
      db.tasks.push({ id, ruleId: "manual", entityType: "task", entityId: id, title, assigneeId, dueAt, status: "open", createdAt: now() });
      log(db, `Manual task created: ${title}`, "task", id);
      return id;
    }),
};

/** Change requests may add items; reuse the same validation but require override via admin approval step. */
function checkVendorsSoft(db: DB, items: LineItem[]) {
  if (!items.length) throw new Error("Add at least one line item");
  for (const i of items) {
    if (!vendorById(db, i.vendorId)) throw new Error(`Line "${i.description}" has no vendor`);
    if (!i.vendorQuoteRef.trim()) throw new Error(`Line "${i.description}" needs the vendor's quote reference`);
  }
}

export type { DB } from "./types";
