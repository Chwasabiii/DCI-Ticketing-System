import { Bell, Menu, Search } from "lucide-react";
import type { EmployeeRole, Profile } from "@/lib/types";

export function Topbar({
  profile,
  roles
}: {
  profile: Profile | null;
  roles: EmployeeRole[];
}) {
  const displayRole =
    profile?.user_side === "employee" ? roles.join(", ") || "Employee" : profile?.user_side;

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm lg:px-6">
      <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-navy">PMSG Desk</p>
        <p className="truncate text-xs text-slate-500">
          Centralized request tracking and monitoring
        </p>
      </div>
      <label className="ml-auto hidden h-10 w-full max-w-lg items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 lg:flex">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search tickets, requesters, disciplines..."
        />
      </label>
      <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Notifications">
        <Bell className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-accent">
          {(profile?.full_name ?? "PMSG User").slice(0, 2).toUpperCase()}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-slate-900">
            {profile?.full_name ?? "PMSG User"}
          </p>
          <p className="truncate text-xs capitalize text-slate-500">{displayRole}</p>
        </div>
      </div>
    </header>
  );
}
