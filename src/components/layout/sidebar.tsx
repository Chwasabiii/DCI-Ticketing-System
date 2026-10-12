"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FileBarChart,
  Home,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Shield,
  Users,
  Workflow
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/lib/navigation";

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden border-r border-slate-200 bg-navy text-white md:flex md:flex-col",
        collapsed ? "md:w-20" : "md:w-72"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          title="Dashboard"
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-sm font-black text-navy hover:bg-blue-50"
        >
          DCI
        </Link>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold">PMSG Desk</p>
            <p className="text-xs text-blue-100">Support Operations</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href) &&
              !(item.href === "/tickets" && pathname === "/tickets/new"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-blue-50 transition-colors duration-100 motion-reduce:transition-none hover:bg-white/10",
                active && "bg-white text-navy shadow-sm"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="m-3 flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 text-sm font-medium text-blue-50 hover:bg-white/10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <>
            <PanelLeftClose className="h-5 w-5" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
