"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationFeed } from "@/components/layout/notification-feed";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

export function NotificationMenu({ notifications, unreadCount, userId }: { notifications: Notification[]; unreadCount: number; userId: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`
      }, () => router.refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls="notifications-menu"
        onClick={() => setMenuOpen((open) => !open)}
        className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {menuOpen && (
        <section
          id="notifications-menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-navy">Notifications</h2>
            {unreadCount > 0 ? <span className="text-xs font-semibold text-accent">{unreadCount} unread</span> : <Bell className="h-4 w-4 text-slate-400" />}
          </div>
          <NotificationFeed notifications={notifications} compact onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-slate-100 p-2">
            <Link
              href="/notifications"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-10 items-center justify-center rounded-md text-sm font-semibold text-accent hover:bg-blue-50"
            >
              View all notifications
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
