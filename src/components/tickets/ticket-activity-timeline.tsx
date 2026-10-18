"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleDot,
  GitBranch,
  MessageSquare,
  Send,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { TicketActivity } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type RealtimeStatus = "connecting" | "live" | "unavailable";

function mergeActivity(...groups: TicketActivity[][]) {
  const activityByKey = new Map<string, TicketActivity>();

  for (const item of groups.flat()) {
    activityByKey.set(`${item.kind}:${item.id}`, item);
  }

  return Array.from(activityByKey.values()).sort((left, right) => {
    const timeDifference =
      Date.parse(left.created_at ?? "") - Date.parse(right.created_at ?? "");
    if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
    if (left.kind !== right.kind) return left.kind === "event" ? -1 : 1;
    return Number(left.id) - Number(right.id);
  });
}

function statusLabel(status?: string | null) {
  return status?.replaceAll("_", " ") ?? "unknown";
}

function getEventDescription(item: Extract<TicketActivity, { kind: "event" }>) {
  switch (item.event_type) {
    case "submitted":
      return `Ticket submitted${item.to_status ? ` with status ${statusLabel(item.to_status)}` : ""}.`;
    case "status_changed":
      return item.from_status && item.to_status
        ? `Status changed from ${statusLabel(item.from_status)} to ${statusLabel(item.to_status)}.`
        : `Status changed to ${statusLabel(item.to_status)}.`;
    case "routed":
    case "assigned":
    case "approval_changed":
      return item.note ?? item.event_type.replaceAll("_", " ");
    default:
      return item.note ?? item.event_type.replaceAll("_", " ");
  }
}

function EventIcon({ eventType }: { eventType: string }) {
  const className = "h-4 w-4";

  if (eventType === "submitted") return <Send className={className} />;
  if (eventType === "status_changed") return <CircleDot className={className} />;
  if (eventType === "routed") return <GitBranch className={className} />;
  if (eventType === "assigned") return <UserRound className={className} />;
  if (eventType === "approval_changed") return <ShieldCheck className={className} />;
  return <CheckCircle2 className={className} />;
}

export function TicketActivityTimeline({
  ticketId,
  initialActivity
}: {
  ticketId: string;
  initialActivity: TicketActivity[];
}) {
  const router = useRouter();
  const [activity, setActivity] = useState(initialActivity);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    setActivity((current) => mergeActivity(current, initialActivity));
  }, [initialActivity]);

  useEffect(() => {
    const supabase = createClient();
    const refreshActivity = () => router.refresh();
    const channel = supabase
      .channel(`ticket-activity:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_events",
          filter: `ticket_id=eq.${ticketId}`
        },
        refreshActivity
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_comments",
          filter: `ticket_id=eq.${ticketId}`
        },
        refreshActivity
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          refreshActivity();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("unavailable");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, ticketId]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Comments, decisions, and ticket updates in order.
          </p>
        </div>
        <p
          aria-live="polite"
          className="flex shrink-0 items-center gap-2 text-xs text-slate-500"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeStatus === "live"
                ? "bg-resolved"
                : realtimeStatus === "unavailable"
                  ? "bg-urgent"
                  : "bg-warning"
            }`}
          />
          {realtimeStatus === "live"
            ? "Live"
            : realtimeStatus === "unavailable"
              ? "Live updates unavailable"
              : "Connecting"}
        </p>
      </div>

      {activity.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No activity has been recorded yet.</p>
      ) : (
        <ol className="mt-6">
          {activity.map((item, index) => {
            const actorName = item.actor?.full_name ?? "Support team";
            const isLast = index === activity.length - 1;

            return (
              <li
                key={`${item.kind}:${item.id}`}
                className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4"
              >
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200"
                  />
                )}
                <span
                  className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    item.kind === "comment"
                      ? "bg-blue-50 text-accent"
                      : item.event_type === "approval_changed"
                        ? "bg-violet-50 text-violet-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.kind === "comment" ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <EventIcon eventType={item.event_type} />
                  )}
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-slate-800">{actorName}</p>
                    {item.kind === "comment" && item.is_internal && (
                      <Badge value="internal note" />
                    )}
                    {item.created_at && (
                      <time
                        dateTime={item.created_at}
                        className="text-xs text-slate-500"
                      >
                        {formatDateTime(item.created_at)}
                      </time>
                    )}
                  </div>
                  {item.kind === "comment" ? (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {item.body}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {getEventDescription(item)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
