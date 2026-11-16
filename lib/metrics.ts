// Dashboard metrics — pure functions over the DB, so every figure is reproducible.

import type { DB } from "./types";
import { bookingFinance } from "./finance";
import { isOverdue } from "./workflow";
import { funnelRows, funnelSteps } from "./funnel";

export function dashboardMetrics(db: DB) {
  // Funnel numbers come from the same rows that power the Leads & Funnel page.
  const rows = funnelRows(db);
  const steps = funnelSteps(rows);
  const stepCount = (k: string) => steps.find((s) => s.key === k)?.value ?? 0;
  const live = db.bookings.filter((b) => b.status !== "cancelled");

  const fin = live.map((b) => ({ b, f: bookingFinance(db, b) }));
  const sum = (fn: (x: (typeof fin)[number]) => number) => fin.reduce((s, x) => s + fn(x), 0);
  const realisedSet = fin.filter((x) => x.f.realisedMargin !== null);

  const quotesPerRequest = db.requests.length
    ? db.quotes.filter((q) => q.status !== "draft").length / db.requests.length
    : 0;

  const firstQuoteHours = db.requests
    .map((r) => {
      const first = db.quotes
        .filter((q) => q.requestId === r.id && q.sentAt)
        .sort((a, b) => a.sentAt!.localeCompare(b.sentAt!))[0];
      return first ? (new Date(first.sentAt!).getTime() - new Date(r.createdAt).getTime()) / 3600_000 : null;
    })
    .filter((x): x is number => x !== null);

  const bySource = Object.values(
    rows
      .filter((r) => r.tag !== "duplicate")
      .reduce<Record<string, { source: string; enquiries: number; leads: number; bookings: number; value: number }>>((acc, r) => {
        const row = (acc[r.lead.source] ??= { source: r.lead.source, enquiries: 0, leads: 0, bookings: 0, value: 0 });
        if (r.reached.enquiry) row.enquiries++;
        if (r.reached.lead) row.leads++;
        row.bookings += r.bookingIds.length;
        row.value += r.value;
        return acc;
      }, {})
  );

  const byOwner = db.users
    .filter((u) => u.role === "sales" || u.role === "seller")
    .map((u) => {
      const mine = fin.filter((x) => x.b.ownerId === u.id);
      return {
        user: u,
        bookings: mine.length,
        bookedMargin: mine.reduce((s, x) => s + x.f.booked.margin, 0),
        flaggedMargin: mine.reduce((s, x) => s + x.f.flaggedMargin, 0),
        leakage: mine.reduce((s, x) => s + x.f.leakage, 0),
        overdue: db.tasks.filter((t) => t.assigneeId === u.id && isOverdue(t)).length,
      };
    });

  return {
    funnel: steps,
    duplicates: rows.filter((r) => r.tag === "duplicate").length,
    leadToBooking: stepCount("lead") ? (stepCount("booked") / stepCount("lead")) * 100 : 0,
    enquiryShare: stepCount("enquiry") + stepCount("lead") ? (stepCount("enquiry") / (stepCount("enquiry") + stepCount("lead"))) * 100 : 0,
    quotesPerRequest,
    avgFirstQuoteHours: firstQuoteHours.length ? firstQuoteHours.reduce((a, b) => a + b, 0) / firstQuoteHours.length : 0,
    money: {
      bookingValue: sum((x) => x.f.booked.gross),
      received: sum((x) => x.f.received),
      receivable: sum((x) => x.f.receivable),
      vendorPayable: sum((x) => x.f.vendorPayable),
      gst: sum((x) => x.f.booked.gst),
      tds: sum((x) => x.f.tdsDeducted),
    },
    margin: {
      quoted: sum((x) => x.f.quoted.margin),
      booked: sum((x) => x.f.booked.margin),
      bookedSell: sum((x) => x.f.booked.sell),
      realised: realisedSet.reduce((s, x) => s + (x.f.realisedMargin ?? 0), 0),
      realisedBookings: realisedSet.length,
      flagged: sum((x) => x.f.flaggedMargin),
      leakage: sum((x) => x.f.leakage),
    },
    ops: {
      openTasks: db.tasks.filter((t) => t.status === "open").length,
      overdue: db.tasks.filter((t) => isOverdue(t)),
      pendingCRs: db.changeRequests.filter((c) => c.status === "pending").length,
      blocked: db.audit.filter((a) => a.severity === "blocked"),
      warnings: db.audit.filter((a) => a.severity === "warning"),
      presalesRouted: db.requests.filter((r) => r.presales).length,
    },
    bySource,
    byOwner,
  };
}
