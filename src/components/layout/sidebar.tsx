"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ClipboardList,
  CircleHelp,
  FileBarChart,
  Home,
  Inbox,
  PlusCircle,
  Shield,
  Users,
  Workflow
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavIcon, type NavItem } from "@/lib/navigation";

const icons: Record<NavIcon, typeof Home> = {
  "bar-chart": BarChart3,
  bell: Bell,
  clipboard: ClipboardList,
  "file-chart": FileBarChart,
  home: Home,
  inbox: Inbox,
  plus: PlusCircle,
  shield: Shield,
  users: Users,
  workflow: Workflow
};

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovered || focused;

  return (
    <aside
      aria-label="Primary navigation"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      className={cn(
        "hidden overflow-hidden border-r border-slate-200/80 bg-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:transition-[width] md:duration-[360ms] md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:md:transition-none",
        expanded ? "md:w-[17rem]" : "md:w-[5.25rem]"
      )}
    >
      <div
        className={cn(
          "flex h-[4.5rem] shrink-0 items-center border-b border-slate-100 transition-[gap,padding] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          expanded ? "gap-3 px-5" : "justify-center gap-0 px-3"
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          title="Dashboard"
          className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-sm font-black tracking-tight text-white shadow-sm hover:bg-[#1d3558]"
        >
          DCI
        </Link>
        <div
          aria-hidden={!expanded}
          className={cn(
            "overflow-hidden whitespace-nowrap transition-[max-width,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded
              ? "max-w-40 translate-x-0"
              : "max-w-0 translate-x-1"
          )}
        >
          <div
            className={cn(
              "transition-opacity motion-reduce:transition-none",
              expanded ? "delay-75 duration-200 opacity-100" : "duration-100 opacity-0"
            )}
          >
            <p className="text-sm font-bold tracking-tight text-navy">PMSG Desk</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Support center</p>
          </div>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p
          aria-hidden={!expanded}
          className={cn(
            "overflow-hidden whitespace-nowrap px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 transition-[max-height,margin] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded ? "mb-3 max-h-5" : "mb-0 max-h-0"
          )}
        >
          <span
            className={cn(
              "inline-block transition-opacity motion-reduce:transition-none",
              expanded ? "delay-75 duration-200 opacity-100" : "duration-100 opacity-0"
            )}
          >
            Workspace
          </span>
        </p>
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-11 items-center rounded-xl text-[13px] font-semibold text-slate-600 transition-[gap,padding,background-color,color] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:bg-slate-50 hover:text-navy",
                expanded ? "gap-3 px-3" : "justify-center gap-0 px-0",
                item.href === "/tickets/new" && "mt-2 min-h-12 bg-accent text-white shadow-sm hover:bg-blue-700 hover:text-white",
                item.href === "/tickets/new" && expanded && "mb-4",
                active && item.href !== "/tickets/new" && "bg-blue-50 text-accent",
                active && item.href === "/tickets/new" && "ring-2 ring-blue-100"
              )}
              title={!expanded ? item.label : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active && item.href !== "/tickets/new" && "text-accent")} />
              <span
                aria-hidden={!expanded}
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-[max-width,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  expanded
                    ? "max-w-44 translate-x-0"
                    : "max-w-0 translate-x-1"
                )}
              >
                <span
                  className={cn(
                    "inline-block transition-opacity motion-reduce:transition-none",
                    expanded ? "delay-75 duration-200 opacity-100" : "duration-100 opacity-0"
                  )}
                >
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden={!expanded}
        className={cn(
          "mx-3 overflow-hidden rounded-xl bg-slate-50 transition-[max-height,margin,padding] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          expanded ? "mb-3 max-h-40 p-3.5" : "mb-0 max-h-0 p-0"
        )}
      >
        <div
          className={cn(
            "transition-opacity motion-reduce:transition-none",
            expanded ? "delay-75 duration-200 opacity-100" : "duration-100 opacity-0"
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-navy">
            <CircleHelp className="h-4 w-4 text-accent" />
            Need a hand?
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Find answers in the support guide.</p>
          <Link href="/faqs" className="mt-2 inline-flex text-xs font-bold text-accent hover:underline">
            Browse FAQs
          </Link>
        </div>
      </div>
    </aside>
  );
}
