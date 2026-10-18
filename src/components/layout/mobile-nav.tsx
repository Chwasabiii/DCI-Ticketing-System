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
  PlusCircle,
  Shield,
  Users,
  Workflow
} from "lucide-react";
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

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(20,40,75,0.08)] backdrop-blur md:hidden">
      <div className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition-colors ${
              active ? "bg-blue-50 text-accent" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label === "Open a Ticket" ? "Open ticket" : item.label}</span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
