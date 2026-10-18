import { Bell } from "lucide-react";
import { NotificationFeed } from "@/components/layout/notification-feed";
import { getNotifications } from "@/lib/data";

export default async function NotificationsPage() {
  const notifications = await getNotifications(100);

  return (
    <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-accent">
          <Bell className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ticket submissions, assignments, approvals, rejections, comments, and updates.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <NotificationFeed notifications={notifications} />
      </div>
    </div>
  );
}
