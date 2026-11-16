// Demo data so the dashboard is meaningful on first load. "Reset demo data" restores it.

import type { Booking, DB, LineItem, Quote } from "./types";
import { syncTasks } from "./workflow";

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const item = (id: string, description: string, vendorId: string, ref: string, cost: number, price: number, gstRate = 5): LineItem => ({
  id,
  description,
  vendorId,
  vendorQuoteRef: ref,
  cost,
  price,
  gstRate,
});

export function seedDB(): DB {
  const users = [
    { id: "U-ADMIN", name: "Founder (Admin)", role: "admin" as const },
    { id: "U-ASHA", name: "Asha (Sales)", role: "sales" as const },
    { id: "U-RAVI", name: "Ravi (Sales)", role: "sales" as const },
    { id: "U-MEERA", name: "Meera (Seller)", role: "seller" as const },
    { id: "U-KIRAN", name: "Kiran (Pre-sales)", role: "presales" as const },
    { id: "U-FIN", name: "Neha (Finance)", role: "finance" as const },
  ];

  const vendors = [
    { id: "V-001", name: "Coastal Stays Pvt Ltd", category: "Accommodation", gstin: "30AAACC1234F1Z5", pan: "AAACC1234F", tdsRate: 2, status: "approved" as const, createdAt: ago(900) },
    { id: "V-002", name: "Swift Transport Co", category: "Transport", gstin: "29AAFCS9876K1Z2", pan: "AAFCS9876K", tdsRate: 1, status: "approved" as const, createdAt: ago(800) },
    { id: "V-003", name: "Royal Events & Catering", category: "Events", gstin: "27AABCR5555L1Z9", pan: "AABCR5555L", tdsRate: 2, status: "approved" as const, createdAt: ago(700) },
    { id: "V-004", name: "QuickDeals (unverified)", category: "Accommodation", gstin: "", pan: "", tdsRate: 2, status: "pending" as const, createdAt: ago(100) },
  ];

  const leads = [
    { id: "L-1001", source: "LeadSquared", customerName: "Rohan Mehta", phone: "9810000001", otpVerified: true, status: "converted" as const, ownerId: "U-ASHA", createdAt: ago(400) },
    { id: "L-1002", source: "Website", customerName: "Priya Nair", phone: "9810000002", otpVerified: true, status: "converted" as const, ownerId: "U-RAVI", createdAt: ago(300) },
    { id: "L-1003", source: "Zoho CRM", customerName: "Anil Kapoor", phone: "9810000003", otpVerified: true, status: "converted" as const, ownerId: "U-ASHA", createdAt: ago(200) },
    { id: "L-1004", source: "Website", customerName: "Sneha Rao", phone: "9810000004", otpVerified: true, status: "contacted" as const, ownerId: "U-RAVI", createdAt: ago(60) },
    { id: "L-1005", source: "LeadSquared", customerName: "Vikram Shah", phone: "9810000005", otpVerified: true, status: "new" as const, ownerId: "U-ASHA", createdAt: ago(30) },
    { id: "L-1006", source: "Website", customerName: "Unknown visitor", phone: "9810000006", otpVerified: false, status: "new" as const, ownerId: "U-RAVI", createdAt: ago(20) },
    { id: "L-1007", source: "Zoho CRM", customerName: "Karan Malhotra", phone: "9810000007", otpVerified: false, status: "new" as const, ownerId: "U-ASHA", createdAt: ago(10) },
    { id: "L-1008", source: "LeadSquared", customerName: "Rohan Mehta", phone: "9810000001", otpVerified: true, status: "new" as const, ownerId: "U-RAVI", duplicateOf: "L-1001", createdAt: ago(5) },
  ];

  const requests = [
    { id: "R-2001", leadId: "L-1001", title: "Goa offsite – 3N, 20 pax", details: "Team offsite with venue + transfers", ownerId: "U-ASHA", stage: "won" as const, createdAt: ago(395) },
    { id: "R-2002", leadId: "L-1002", title: "Wedding catering – 150 guests", details: "Reception dinner", ownerId: "U-RAVI", stage: "won" as const, createdAt: ago(295) },
    { id: "R-2003", leadId: "L-1003", title: "Family trip – 4N Kerala", details: "Houseboat + hotel", ownerId: "U-ASHA", stage: "won" as const, createdAt: ago(195) },
    { id: "R-2004", leadId: "L-1004", title: "Corporate dinner – 40 pax", details: "Weekday evening", ownerId: "U-RAVI", stage: "quoted" as const, createdAt: ago(55),
      presales: { routedBy: "U-RAVI", routedAt: ago(54), assigneeId: "U-KIRAN" } },
  ];

  const q1Items = [
    item("LI-1", "Resort – 10 rooms x 3N", "V-001", "CS/Q/881", 180000, 225000, 12),
    item("LI-2", "Airport transfers", "V-002", "SW/552", 24000, 32000, 5),
  ];
  const q2Items = [item("LI-3", "Dinner catering – 150 pax", "V-003", "RE/2024/77", 270000, 330000, 18)];
  const q3Items = [
    item("LI-4", "Hotel – 2 rooms x 4N", "V-004", "QD-001", 40000, 72000, 12),
    item("LI-5", "Cab – 4 days", "V-002", "SW/601", 14000, 18000, 5),
  ];
  const q4Items = [item("LI-6", "Dinner – 40 pax", "V-003", "RE/2024/90", 60000, 76000, 18)];

  const quotes: Quote[] = [
    { id: "Q-3001", requestId: "R-2001", number: 1, items: q1Items.map((i) => ({ ...i, price: i.price * 1.1 })), status: "superseded", createdBy: "U-ASHA", createdAt: ago(390), sentAt: ago(389) },
    { id: "Q-3002", requestId: "R-2001", number: 2, items: q1Items, status: "accepted", createdBy: "U-ASHA", createdAt: ago(370), sentAt: ago(369), decidedAt: ago(360) },
    { id: "Q-3003", requestId: "R-2002", number: 1, items: q2Items, status: "accepted", createdBy: "U-RAVI", createdAt: ago(290), sentAt: ago(289), decidedAt: ago(280) },
    { id: "Q-3004", requestId: "R-2003", number: 1, items: q3Items, status: "accepted", createdBy: "U-ASHA", createdAt: ago(190), sentAt: ago(189), decidedAt: ago(180),
      vendorOverride: { approvedBy: "U-ADMIN", reason: "Approved vendor sold out for dates", at: ago(189) } },
    { id: "Q-3005", requestId: "R-2004", number: 1, items: q4Items, status: "sent", createdBy: "U-RAVI", createdAt: ago(50), sentAt: ago(49) },
  ];

  const hist = (...s: [Booking["status"], number][]) => s.map(([status, h]) => ({ status, at: ago(h), by: "U-ASHA" }));

  const changedItems = [...q1Items, item("LI-7", "Gala dinner add-on", "V-003", "RE/2024/81", 30000, 38000, 18)];

  const bookings: Booking[] = [
    {
      id: "B-4001", requestId: "R-2001", leadId: "L-1001", quoteId: "Q-3002", ownerId: "U-ASHA", status: "vendor_settled", version: 2,
      items: changedItems,
      versions: [{ version: 1, items: q1Items, at: ago(360) }, { version: 2, items: changedItems, at: ago(300), changeRequestId: "CR-5001" }],
      statusHistory: hist(["pending_seller", 360], ["seller_accepted", 350], ["confirmed", 345], ["advance_paid", 330], ["fully_paid", 250], ["fulfilled", 150], ["vendor_settled", 100]),
      payments: [
        { id: "P-1", amount: 120000, mode: "UPI", reference: "UPI-88213", at: ago(330) },
        { id: "P-2", amount: 210440, mode: "Bank transfer", reference: "NEFT-1192", at: ago(250) },
      ],
      vendorInvoices: [
        { id: "VI-1", vendorId: "V-001", invoiceNo: "CS/INV/301", amount: 186000, at: ago(140) },
        { id: "VI-2", vendorId: "V-002", invoiceNo: "SW/INV/77", amount: 24000, at: ago(140) },
        { id: "VI-3", vendorId: "V-003", invoiceNo: "RE/INV/19", amount: 30000, at: ago(140) },
      ],
      vendorPayments: [
        { id: "VP-1", vendorId: "V-001", gross: 186000, tds: 3720, net: 182280, at: ago(100) },
        { id: "VP-2", vendorId: "V-002", gross: 24000, tds: 240, net: 23760, at: ago(100) },
        { id: "VP-3", vendorId: "V-003", gross: 30000, tds: 600, net: 29400, at: ago(100) },
      ],
      createdAt: ago(360),
    },
    {
      id: "B-4002", requestId: "R-2002", leadId: "L-1002", quoteId: "Q-3003", ownerId: "U-RAVI", status: "advance_paid", version: 1,
      items: q2Items, versions: [{ version: 1, items: q2Items, at: ago(280) }],
      statusHistory: hist(["pending_seller", 280], ["seller_accepted", 270], ["confirmed", 260], ["advance_paid", 240]),
      payments: [{ id: "P-3", amount: 120000, mode: "Card", reference: "RZP-55120", at: ago(240) }],
      vendorInvoices: [], vendorPayments: [], createdAt: ago(280),
    },
    {
      id: "B-4003", requestId: "R-2003", leadId: "L-1003", quoteId: "Q-3004", ownerId: "U-ASHA", status: "seller_accepted", version: 1,
      items: q3Items, versions: [{ version: 1, items: q3Items, at: ago(180) }],
      statusHistory: hist(["pending_seller", 180], ["seller_accepted", 100]),
      payments: [], vendorInvoices: [], vendorPayments: [], createdAt: ago(180),
    },
  ];

  const changeRequests = [
    { id: "CR-5001", bookingId: "B-4001", raisedBy: "customer" as const, description: "Add gala dinner on night 2", proposedItems: changedItems,
      valueDelta: 38000, marginDelta: 8000, status: "approved" as const, createdBy: "U-ASHA", createdAt: ago(310), decidedBy: "U-ADMIN", decidedAt: ago(300) },
  ];

  const db: DB = {
    users,
    leads,
    vendors,
    requests,
    quotes,
    bookings,
    changeRequests,
    tasks: [],
    audit: [
      { id: "A-1", at: ago(189), actorId: "U-ADMIN", action: "Approved non-approved vendor override on Q-3004", entityType: "quote", entityId: "Q-3004", severity: "warning" },
      { id: "A-2", at: ago(54), actorId: "U-RAVI", action: "Routed R-2004 to pre-sales", entityType: "request", entityId: "R-2004" },
    ],
    settings: {
      currentUserId: "U-ADMIN",
      presalesRoutingRole: "sales",
      sla: { firstContactHours: 2, quoteHours: 24, quoteFollowUpHours: 48, sellerAcceptHours: 12, confirmationHours: 6, advancePaymentHours: 48 },
      advancePct: 30,
    },
  };
  db.tasks = syncTasks(db);
  return db;
}
