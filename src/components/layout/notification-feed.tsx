"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { Notification } from "@/lib/types";

export function NotificationFeed({
  notifications,
  compact = false,
  onNavigate
}: {
  notifications: Notification[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  async function openNotification(event: MouseEvent<HTMLAnchorElement>, notification: Notification) {
    event.preventDefault();
    setError(null);
    if (!notification.is_read) {
      const formData = new FormData();
      formData.set("notification_id", String(notification.id));
      try {
        const result = await markNotificationRead(formData);
        if ("error" in result) setError(result.error);
      } catch {
        setError("The notification could not be marked as read.");
      }
    }
    onNavigate?.();
    router.push(notification.ticket_id ? `/tickets/${notification.ticket_id}` : "/notifications");
    router.refresh();
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);
    try {
      const result = await markAllNotificationsRead();
      if ("error" in result) setError(result.error);
      else router.refresh();
    } catch {
      setError("Notifications could not be marked as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You’re all caught up."}
          </p>
          {unreadCount > 0 && (
            <button type="button" onClick={() => void markAllRead()} disabled={markingAll} className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {markingAll ? "Updating..." : "Mark all as read"}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {notifications.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <p className="text-sm font-semibold text-slate-800">No notifications yet</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Ticket submissions, assignments, decisions, and updates will appear here.</p>
        </div>
      ) : (
        <ul className={compact ? "max-h-96 divide-y divide-slate-100 overflow-y-auto" : "divide-y divide-slate-100 rounded-lg border border-slate-100"}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={notification.ticket_id ? `/tickets/${notification.ticket_id}` : "/notifications"}
                onClick={(event) => void openNotification(event, notification)}
                className={`focus-ring flex gap-3 px-4 py-3 hover:bg-slate-50 ${notification.is_read ? "bg-white" : "bg-blue-50/60"}`}
              >
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.is_read ? "bg-transparent" : "bg-accent"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-5 text-slate-800">{notification.message ?? "Ticket update"}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{new Date(notification.created_at).toLocaleString()}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
