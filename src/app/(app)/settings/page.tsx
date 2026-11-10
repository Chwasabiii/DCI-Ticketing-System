import { Bell, Building2, CircleUserRound, Settings, ShieldCheck } from "lucide-react";
import { getCcgBusinessHolidays, getCurrentContext, getNotificationPreferences } from "@/lib/data";
import { NotificationPreferences } from "@/components/layout/notification-preferences";
import { ProfileSecurityForm } from "@/components/layout/profile-security-form";
import { CcgBusinessHolidayCalendar } from "@/components/layout/ccg-business-holiday-calendar";

export default async function SettingsPage() {
  const [{ profile, roleNames }, preferences] = await Promise.all([
    getCurrentContext(),
    getNotificationPreferences()
  ]);
  const holidays = profile?.user_side === "admin" ? await getCcgBusinessHolidays() : [];
  const displayName = profile?.full_name ?? profile?.email ?? "PMSG user";
  const accountType = profile?.user_side === "client" ? "End user" : profile?.user_side === "employee" ? "Service provider" : "Administrator";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#172b4d] via-[#203d69] to-[#31578d] px-6 py-7 text-white shadow-[0_18px_48px_rgba(23,43,77,0.18)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[36px] border-white/[0.06]" />
        <div className="pointer-events-none absolute right-28 -bottom-32 h-64 w-64 rounded-full bg-blue-300/[0.08] blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-blue-100 ring-1 ring-white/15"><Settings className="h-6 w-6" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Account preferences</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Settings</h1><p className="mt-1 text-sm text-blue-100/80">Manage your profile, security, and notifications.</p></div>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 backdrop-blur-sm sm:self-auto">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-[#244a7c]">{displayName.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0"><span className="block max-w-52 truncate text-sm font-semibold">{displayName}</span><span className="mt-0.5 block text-xs text-blue-100/75">{profile?.email}</span></span>
          </div>
        </div>
      </header>

      {profile?.user_side !== "client" && <section aria-label="Account overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Account type", value: accountType, icon: CircleUserRound },
          { label: "Service team", value: profile?.service_team?.name ?? "Not assigned", icon: Building2 },
          { label: "Roles", value: roleNames.join(", ") || "None", icon: ShieldCheck },
          { label: "Account status", value: profile?.status ?? "active", icon: Bell }
        ].map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.025)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500"><Icon className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0"><span className="block text-xs font-medium text-slate-500">{label}</span><span className="mt-0.5 block truncate text-sm font-bold capitalize text-navy">{value}</span></span>
        </div>)}
      </section>}

      {profile && <ProfileSecurityForm fullName={profile.full_name ?? ""} nameChangeUsed={profile.full_name_change_used ?? false} />}
      <NotificationPreferences initial={preferences} />
      {profile?.user_side === "admin" && <CcgBusinessHolidayCalendar holidays={holidays} />}
    </div>
  );
}
