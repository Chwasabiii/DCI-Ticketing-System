"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ClipboardList,
  Clock3,
  FileBarChart,
  Home,
  Inbox,
  PlusCircle,
  Shield,
  Users,
  Workflow
} from "lucide-react";
import { isNavItemActive, type NavIcon, type NavItem } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";

const icons: Record<NavIcon, typeof Home> = {
  "bar-chart": BarChart3,
  bell: Bell,
  clipboard: ClipboardList,
  clock: Clock3,
  "file-chart": FileBarChart,
  home: Home,
  inbox: Inbox,
  plus: PlusCircle,
  shield: Shield,
  users: Users,
  workflow: Workflow
};

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryPaths = ["/dashboard", "/inbox", "/tickets/new", "/tickets"];
  const primary = primaryPaths.map((path) => items.find((item) => item.href === path)).filter((item): item is NavItem => Boolean(item)).slice(0, 4);
  const secondary = items.filter((item) => !primary.includes(item));

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <>
    {moreOpen && secondary.length > 0 && <div className="fixed inset-0 z-30 bg-slate-950/20 md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreOpen(false); }}>
      <nav id="mobile-more-menu" aria-label="More navigation" className="animate-modal-in absolute inset-x-3 bottom-20 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">More pages</p>
        {secondary.map((item) => { const Icon = icons[item.icon]; const active = isNavItemActive(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMoreOpen(false)} className={`focus-ring flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-blue-50 text-accent" : "text-slate-700 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{item.label}</Link>; })}
      </nav>
    </div>}
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(20,40,75,0.08)] backdrop-blur md:hidden">
      <div className="flex gap-1">
      {primary.map((item) => {
        const Icon = icons[item.icon];
        const active = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`focus-ring flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition-colors ${
              active ? "bg-blue-50 text-accent" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label === "Open a Ticket" ? "Open ticket" : item.label}</span>
          </Link>
        );
      })}
      {secondary.length > 0 && <button type="button" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((open) => !open)} className={`focus-ring flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition-colors ${moreOpen || secondary.some((item) => isNavItemActive(pathname, item.href)) ? "bg-blue-50 text-accent" : "text-slate-500 hover:bg-slate-50"}`}><span className="grid h-5 place-items-center">{moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}</span><span>More</span></button>}
      </div>
    </nav>
    </>
  );
}
