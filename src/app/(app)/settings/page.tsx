import { Settings } from "lucide-react";
import { getCurrentContext, getNotificationPreferences } from "@/lib/data";
import { NotificationPreferences } from "@/components/layout/notification-preferences";

export default async function SettingsPage() {
  const [{ profile, roleNames }, preferences] = await Promise.all([
    getCurrentContext(),
    getNotificationPreferences()
  ]);

  return (
    <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-accent">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as {profile?.full_name ?? profile?.email ?? "PMSG user"}.
          </p>
        </div>
      </div>
      <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-slate-200 p-4">
          <dt className="font-semibold text-slate-500">Account type</dt>
          <dd className="mt-1 text-slate-900">{profile?.user_side === "client" ? "End user" : profile?.user_side === "employee" ? "Service provider" : "Admin"}</dd>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <dt className="font-semibold text-slate-500">Service team</dt>
          <dd className="mt-1 text-slate-900">{profile?.service_team?.name ?? "Not assigned"}</dd>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <dt className="font-semibold text-slate-500">Roles</dt>
          <dd className="mt-1 text-slate-900">{roleNames.join(", ") || "None"}</dd>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <dt className="font-semibold text-slate-500">Status</dt>
          <dd className="mt-1 capitalize text-slate-900">{profile?.status ?? "active"}</dd>
        </div>
      </dl>
      <NotificationPreferences initial={preferences} />
    </div>
  );
}
