"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, LayoutGrid, Search, User, Building2, GitPullRequestArrow, CalendarCheck } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { DB, Role } from "@/lib/types";
import { canAccess } from "@/lib/access";
import { entityHref } from "@/components/common";
import { cn } from "@/lib/utils";

interface Item {
  key: string;
  group: "Pages" | "Leads" | "Requests" | "Bookings" | "Vendors" | "Change requests";
  title: string;
  hint?: string;
  href: string;
}

const ICON = {
  Pages: LayoutGrid,
  Leads: User,
  Requests: FileText,
  Bookings: CalendarCheck,
  Vendors: Building2,
  "Change requests": GitPullRequestArrow,
} as const;

/** Everything the current role may open, searchable by name, id, phone or title. */
function buildItems(db: DB, role: Role, pages: { href: string; label: string }[]): Item[] {
  const items: Item[] = pages.map((p) => ({ key: "p" + p.href, group: "Pages", title: p.label, href: p.href }));
  const ok = (path: string) => canAccess(role, path);
  const name = (leadId: string) => db.leads.find((l) => l.id === leadId)?.customerName ?? "";
  if (ok("/leads")) {
    for (const l of db.leads) items.push({ key: l.id, group: "Leads", title: l.customerName, hint: `${l.id} · ${l.phone} · ${l.source}`, href: entityHref(db, "lead", l.id) ?? "/leads" });
    for (const r of db.requests) items.push({ key: r.id, group: "Requests", title: r.title, hint: `${r.id} · ${name(r.leadId)}`, href: entityHref(db, "request", r.id) ?? "/leads" });
  }
  if (ok("/bookings")) {
    for (const b of db.bookings) items.push({ key: b.id, group: "Bookings", title: `${b.id} · ${name(b.leadId)}`, hint: b.status.replace(/_/g, " "), href: `/bookings/${b.id}` });
  }
  if (ok("/vendors")) {
    for (const v of db.vendors) items.push({ key: v.id, group: "Vendors", title: v.name, hint: `${v.id} · ${v.category} · ${v.status}`, href: "/vendors" });
  }
  if (ok("/change-requests")) {
    for (const c of db.changeRequests) items.push({ key: c.id, group: "Change requests", title: c.description, hint: `${c.id} · ${c.bookingId} · ${c.status}`, href: `/bookings/${c.bookingId}#changes` });
  }
  return items;
}

const score = (it: Item, q: string) => {
  const t = it.title.toLowerCase();
  const h = (it.hint ?? "").toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  if (h.includes(q) || it.key.toLowerCase().includes(q)) return 1;
  return 0;
};

export function CommandPalette({ db, role, pages }: { db: DB | null; role: Role | undefined; pages: { href: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("thirdeye:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("thirdeye:search", onOpen);
    };
  }, []);

  const all = useMemo(() => (db && role ? buildItems(db, role, pages) : []), [db, role, pages]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((i) => i.group === "Pages");
    return all
      .map((i) => ({ i, s: score(i, s) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((x) => x.i);
  }, [all, q]);

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (it: Item) => {
    setOpen(false);
    setQ("");
    router.push(it.href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="text-muted-foreground size-4" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="Search leads, bookings, vendors, pages…"
              className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
            />
            <kbd className="text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">Esc</kbd>
          </div>
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <div className="text-muted-foreground p-6 text-center text-sm">Nothing found for “{q}”.</div>}
            {results.map((it, idx) => {
              const Icon = ICON[it.group];
              const showGroup = idx === 0 || results[idx - 1].group !== it.group;
              return (
                <div key={it.group + it.key}>
                  {showGroup && <div className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">{it.group}</div>}
                  <button
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => go(it)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm", idx === active && "bg-accent text-accent-foreground")}
                  >
                    <Icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{it.title}</span>
                      {it.hint && <span className="text-muted-foreground block truncate text-xs">{it.hint}</span>}
                    </span>
                    {idx === active && <CornerDownLeft className="text-muted-foreground size-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="text-muted-foreground flex items-center gap-3 border-t px-4 py-2 text-[11px]">
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span className="ml-auto">Only shows what your role can open</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
