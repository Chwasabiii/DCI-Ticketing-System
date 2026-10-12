import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-accent">
          <Bell className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ticket updates, assignments, and client confirmations will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
