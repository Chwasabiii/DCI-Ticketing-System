"use client";

import { Headphones } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import type { NavItem } from "@/lib/navigation";
import type { EmployeeRole, Profile } from "@/lib/types";

export function Topbar({
  profile,
  roles,
  items
}: {
  profile: Profile | null;
  roles: EmployeeRole[];
  items: NavItem[];
}) {
  const pathname = usePathname();
  const currentItem = [...items]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const pageTitle = currentItem?.label ?? "Support center";

  return (
    <header className="sticky top-0 z-20 flex min-h-[4.5rem] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-9">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Support center</p>
        <h1 className="mt-0.5 truncate text-sm font-bold text-navy sm:text-base">{pageTitle}</h1>
      </div>
      <div className="ml-auto hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
        <Headphones className="h-3.5 w-3.5" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Support workspace
      </div>
      <NotificationMenu />
      <ProfileMenu profile={profile} roles={roles} />
    </header>
  );
}
