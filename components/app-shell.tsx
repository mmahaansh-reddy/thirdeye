"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarCheck, GitPullRequestArrow, Building2, IndianRupee, ListTodo, ScrollText, Settings, RotateCcw, Eye,
} from "lucide-react";
import { actions, useDB } from "@/lib/store";
import { isOverdue } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads and Bookings", icon: Users },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/change-requests", label: "Change Requests", icon: GitPullRequestArrow },
  { href: "/vendors", label: "Vendors", icon: Building2 },
  { href: "/finance", label: "Finance & Margins", icon: IndianRupee },
  { href: "/tasks", label: "Follow-ups", icon: ListTodo },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Rules & Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const db = useDB();
  const overdue = db ? db.tasks.filter((t) => isOverdue(t)).length : 0;

  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Eye className="size-5" />
          <div className="text-base font-semibold tracking-tight text-white">ThirdEye</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                  active && "bg-sidebar-accent text-white"
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                {href === "/tasks" && overdue > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{overdue}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-4">
          <label className="block text-xs opacity-60" htmlFor="acting-as">
            Acting as (demo login)
          </label>
          <select
            id="acting-as"
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-white"
            value={db?.settings.currentUserId ?? ""}
            onChange={(e) => actions.setCurrentUser(e.target.value)}
          >
            {db?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100"
            onClick={() => {
              if (window.confirm("Reset all local data to the demo dataset?")) actions.resetDemo();
            }}
          >
            <RotateCcw className="size-3" /> Reset demo data
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav pathname={pathname} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <div className="bg-sidebar flex gap-1 overflow-x-auto px-2 py-2 md:hidden">
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "text-sidebar-foreground rounded px-2 py-1 text-xs whitespace-nowrap",
            (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "bg-sidebar-accent text-white"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
