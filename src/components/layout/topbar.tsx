"use client";

import { Calculator, Headphones, LifeBuoy, Monitor } from "lucide-react";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import type { NavItem } from "@/lib/navigation";
import type { EmployeeRole, Notification, Profile } from "@/lib/types";

export function Topbar({
  profile,
  roles,
  items,
  notifications,
  unreadNotificationCount
}: {
  profile: Profile | null;
  roles: EmployeeRole[];
  items: NavItem[];
  notifications: Notification[];
  unreadNotificationCount: number;
}) {
  const pathname = usePathname();
  const currentItem = [...items]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const pageTitle = currentItem?.label ?? "Support center";
  const serviceTeamItems = items.filter((item) => item.href === "/it-support" || item.href === "/cost-control");

  return (
    <header className="sticky top-0 z-20 flex min-h-[4.5rem] items-center gap-3 bg-white/95 px-4 backdrop-blur sm:gap-5 sm:px-6 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent ring-1 ring-inset ring-blue-100">
          <LifeBuoy className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">PMSG Support</p>
          <h1 className="mt-0.5 truncate text-sm font-bold text-navy sm:text-base">{pageTitle}</h1>
        </div>
      </div>
      {serviceTeamItems.length > 0 && <nav aria-label="Service team pages" className="ml-1 hidden h-[4.5rem] items-stretch gap-1 sm:flex md:ml-3 md:gap-2">
        {serviceTeamItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const ServiceIcon = item.href === "/it-support" ? Monitor : Calculator;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`focus-ring relative inline-flex items-center gap-2 px-3 text-xs font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors ${active ? "text-accent after:bg-accent" : "text-slate-500 after:bg-transparent hover:text-navy hover:after:bg-slate-300"}`}
            >
              <ServiceIcon className={`h-4 w-4 ${active ? "text-accent" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>}
      <div className="ml-auto hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 lg:flex">
        <span className="relative grid h-4 w-4 place-items-center"><Headphones className="h-3.5 w-3.5" /><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-50" /></span>
        Support workspace
      </div>
      {items.some((item) => item.href === "/tickets/new") && <Link href="/tickets/new" aria-label="Create a new ticket" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-xs font-bold text-white shadow-[0_3px_9px_rgba(57,105,232,0.2)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_5px_13px_rgba(57,105,232,0.28)] active:translate-y-0"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New ticket</span></Link>}
      {items.some((item) => item.href === "/inbox") && <Link href="/inbox" aria-label="Open triage inbox" title="Triage inbox" className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-accent"><Inbox className="h-4 w-4" /></Link>}
      <NotificationMenu notifications={notifications} unreadCount={unreadNotificationCount} userId={profile?.id ?? ""} />
      <ProfileMenu profile={profile} roles={roles} />
    </header>
  );
}
