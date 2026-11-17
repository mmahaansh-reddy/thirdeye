// Who can see which pages. One place to change it. Founder (admin) sees everything.
// This hides pages for now; real enforcement happens on the server once login and a database are added.

import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Founder",
  finance: "Finance",
  sales: "Sales",
  presales: "Pre-sales",
  seller: "Seller",
};

/** Page prefixes each role may open. Admin is handled separately (everything). */
const ACCESS: Record<Exclude<Role, "admin">, string[]> = {
  finance: ["/finance-desk", "/finance", "/bookings", "/vendors", "/change-requests", "/tasks"],
  sales: ["/leads", "/bookings", "/change-requests", "/tasks"],
  presales: ["/leads", "/tasks"],
  seller: ["/bookings", "/tasks"],
};

/** Where each role lands after switching to them. */
export const HOME: Record<Role, string> = {
  admin: "/",
  finance: "/finance-desk",
  sales: "/leads",
  presales: "/leads",
  seller: "/bookings",
};

export function canAccess(role: Role, pathname: string): boolean {
  if (role === "admin") return true;
  return ACCESS[role].some((p) => pathname === p || pathname.startsWith(p + "/"));
}
