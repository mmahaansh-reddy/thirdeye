"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarCheck, GitPullRequestArrow, Building2, IndianRupee, ListTodo, ScrollText, Settings, RotateCcw, Eye, Wallet, ShieldAlert, Search,
} from "lucide-react";
import { actions, currentUser, useDB } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/toast";
import { CommandPalette } from "@/components/command-palette";
import { HOME, ROLE_LABEL, canAccess } from "@/lib/access";
import type { DB } from "@/lib/types";
import { isOverdue } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads and Bookings", icon: Users },
  { href: "/bookings", label: "Ongoing Bookings", icon: CalendarCheck },
  { href: "/change-requests", label: "Change Requests", icon: GitPullRequestArrow },
  { href: "/vendors", label: "Vendors", icon: Building2 },
  { href: "/finance-desk", label: "Finance Desk", icon: Wallet },
  { href: "/finance", label: "Finance & Margins", icon: IndianRupee },
  { href: "/tasks", label: "Follow-ups", icon: ListTodo },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Rules & Settings", icon: Settings },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const db = useDB();
  const me = db ? currentUser(db) : null;
  // Only show pages the current role may open. The founder (admin) sees everything.
  const nav = me ? NAV.filter((n) => canAccess(me.role, n.href)) : [];
  const pages = useMemo(() => nav.map((n) => ({ href: n.href, label: n.label })), [me?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = db && me ? db.tasks.filter((t) => isOverdue(t) && (me.role === "admin" || t.assigneeId === me.id)).length : 0;
  const switchUser = (id: string) => {
    if (!db) return;
    const role = db.users.find((u) => u.id === id)?.role;
    actions.setCurrentUser(id);
    if (role) router.push(HOME[role]);
  };

  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Eye className="size-5" />
          <div className="text-base font-semibold tracking-tight text-white">ThirdEye</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                isActive(pathname, href) && "bg-sidebar-accent text-white shadow-[inset_2px_0_0_var(--brand)]"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {href === "/tasks" && overdue > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{overdue}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-2">
          <button
            onClick={() => window.dispatchEvent(new Event("thirdeye:search"))}
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm opacity-70 transition hover:opacity-100"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-sidebar-border px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
        </div>
        <div className="space-y-2 border-t border-sidebar-border p-4">
          <label className="block text-xs opacity-60" htmlFor="acting-as">
            Acting as (demo login)
          </label>
          <UserSwitcher db={db} onChange={switchUser} id="acting-as" />
          {me && <div className="text-xs opacity-60">{me.role === "admin" ? "Founder view: all pages" : `${ROLE_LABEL[me.role]} view: ${nav.length} pages`}</div>}
          <ThemeToggle />
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
        <MobileNav pathname={pathname} nav={nav} db={db} onSwitch={switchUser} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          {me && !canAccess(me.role, pathname) ? (
            <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
              <ShieldAlert className="text-muted-foreground mx-auto mb-3 size-8" />
              <h1 className="text-lg font-semibold">No access to this page</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {me.name} ({ROLE_LABEL[me.role]}) can&apos;t open this page. Only the Founder can see everything.
              </p>
              <Link href={HOME[me.role]} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Go to my home
              </Link>
            </div>
          ) : (
            <div key={pathname} className="page-in">
              {children}
            </div>
          )}
        </main>
        <Toaster />
        <CommandPalette db={db} role={me?.role} pages={pages} />
      </div>
    </div>
  );
}

function UserSwitcher({ db, onChange, id, className }: { db: DB | null; onChange: (id: string) => void; id?: string; className?: string }) {
  return (
    <select
      id={id}
      className={cn("w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-white", className)}
      value={db?.settings.currentUserId ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {db?.users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

function MobileNav({ pathname, nav, db, onSwitch }: { pathname: string; nav: typeof NAV; db: DB | null; onSwitch: (id: string) => void }) {
  return (
    <div className="bg-sidebar space-y-2 px-2 py-2 md:hidden">
      <div className="flex gap-2">
        <UserSwitcher db={db} onChange={onSwitch} className="text-xs" />
        <button
          aria-label="Search"
          onClick={() => window.dispatchEvent(new Event("thirdeye:search"))}
          className="border-sidebar-border text-sidebar-foreground rounded-md border px-2.5"
        >
          <Search className="size-4" />
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn("text-sidebar-foreground rounded px-2 py-1 text-xs whitespace-nowrap", isActive(pathname, href) && "bg-sidebar-accent text-white")}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
