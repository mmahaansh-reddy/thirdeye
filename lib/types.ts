// Core domain model. Every record has a stable ID and links back to its parent,
// so any number on the dashboard can be traced to the records behind it.

export type Role = "admin" | "sales" | "seller" | "presales" | "finance";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type LeadStatus = "new" | "contacted" | "converted" | "lost";

/** Raw intake from any CRM. Only OTP-verified intake counts as a Lead; the rest are Enquiries. */
export interface Lead {
  id: string;
  source: string; // CRM / channel name
  customerName: string;
  phone: string;
  email?: string;
  otpVerified: boolean;
  status: LeadStatus;
  ownerId: string;
  duplicateOf?: string;
  createdAt: string;
}

export type VendorStatus = "approved" | "pending" | "rejected";

export interface Vendor {
  id: string;
  name: string;
  category: string;
  gstin: string;
  pan: string;
  tdsRate: number; // % deducted on vendor payments
  status: VendorStatus;
  createdAt: string;
}

export type RequestStage = "open" | "quoted" | "won" | "lost";

/** A booking request raised by a customer (child of a Lead). */
export interface BookingRequest {
  id: string;
  leadId: string;
  title: string;
  details: string;
  ownerId: string;
  stage: RequestStage;
  presales?: { routedBy: string; routedAt: string; assigneeId?: string };
  createdAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  vendorId: string;
  vendorQuoteRef: string; // vendor's own quote / reference number
  cost: number; // vendor cost, pre-GST
  price: number; // price to customer, pre-GST
  gstRate: number; // % GST charged to customer
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "superseded";

export interface Quote {
  id: string;
  requestId: string;
  number: number; // 1, 2, 3… per request
  items: LineItem[];
  status: QuoteStatus;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  decidedAt?: string;
  /** Set when a non-approved vendor was used with explicit admin sign-off. */
  vendorOverride?: { approvedBy: string; reason: string; at: string };
}

export type BookingStatus =
  | "pending_seller"
  | "seller_accepted"
  | "confirmed"
  | "advance_paid"
  | "fully_paid"
  | "fulfilled"
  | "vendor_settled"
  | "closed"
  | "cancelled";

export interface BookingVersion {
  version: number;
  items: LineItem[];
  at: string;
  changeRequestId?: string;
}

export interface CustomerPayment {
  id: string;
  amount: number; // incl. GST
  mode: string;
  reference: string;
  at: string;
}

export interface VendorInvoice {
  id: string;
  vendorId: string;
  invoiceNo: string;
  amount: number; // actual vendor cost, pre-GST
  at: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  gross: number;
  tds: number;
  net: number;
  at: string;
}

export interface Booking {
  id: string;
  requestId: string;
  leadId: string;
  quoteId: string;
  ownerId: string;
  status: BookingStatus;
  version: number;
  items: LineItem[]; // current version
  versions: BookingVersion[];
  statusHistory: { status: BookingStatus; at: string; by: string }[];
  payments: CustomerPayment[];
  vendorInvoices: VendorInvoice[];
  vendorPayments: VendorPayment[];
  createdAt: string;
}

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  bookingId: string;
  raisedBy: "customer" | "client" | "internal";
  description: string;
  proposedItems: LineItem[];
  valueDelta: number;
  marginDelta: number;
  status: ChangeRequestStatus;
  createdBy: string;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export type EntityType = "lead" | "request" | "quote" | "booking" | "change_request" | "vendor" | "task" | "settings";

export interface Task {
  id: string;
  ruleId: string; // automation rule that created it ("manual" for user-created)
  entityType: EntityType;
  entityId: string;
  title: string;
  assigneeId: string;
  dueAt: string;
  status: "open" | "done" | "auto_closed";
  createdAt: string;
  closedAt?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  details?: string;
  severity?: "info" | "warning" | "blocked";
}

export interface Settings {
  currentUserId: string;
  /** The ONLY role allowed to route a request to pre-sales (one-way routing). */
  presalesRoutingRole: Exclude<Role, "presales">;
  sla: {
    firstContactHours: number;
    quoteHours: number;
    quoteFollowUpHours: number;
    sellerAcceptHours: number;
    confirmationHours: number;
    advancePaymentHours: number;
  };
  advancePct: number; // % of booking value required as advance
}

export interface DB {
  users: User[];
  leads: Lead[];
  vendors: Vendor[];
  requests: BookingRequest[];
  quotes: Quote[];
  bookings: Booking[];
  changeRequests: ChangeRequest[];
  tasks: Task[];
  audit: AuditEntry[];
  settings: Settings;
}
