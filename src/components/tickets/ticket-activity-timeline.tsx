"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
import { TicketCommentForm } from "@/components/tickets/ticket-comment-form";

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
  initialActivity,
  currentUserId,
  allowInternalNotes,
  canComment,
  canSubmitResolution,
  isIncidentReport,
  actions
}: {
  ticketId: string;
  initialActivity: TicketActivity[];
  currentUserId: string;
  allowInternalNotes: boolean;
  canComment: boolean;
  canSubmitResolution: boolean;
  isIncidentReport: boolean;
  actions: ReactNode;
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
    <section id="ticket-activity" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,40,75,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100/80 text-accent">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-navy">Conversation</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                {activity.length} {activity.length === 1 ? "update" : "updates"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Messages and ticket updates in order</p>
          </div>
        </div>
        <p
          aria-live="polite"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80"
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
        <div className="mx-5 mt-5 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center sm:mx-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
            <MessageSquare className="h-4 w-4" />
          </span>
          <p className="mt-2 text-sm font-semibold text-slate-700">Start the conversation</p>
          <p className="mt-1 text-xs text-slate-500">Send a message here to keep everyone updated.</p>
        </div>
      ) : (
        <ol className="px-5 pt-5 sm:px-6">
          {activity.map((item, index) => {
            const isOwnComment = item.kind === "comment" && item.actor?.id === currentUserId;
            const actorName = isOwnComment
              ? "You"
              : item.actor?.full_name ?? (item.actor?.user_side === "client" ? "Client" : "Support team");
            const isClientComment = item.kind === "comment" && item.actor?.user_side === "client";
            const alignRight = isOwnComment;
            const isLast = index === activity.length - 1;

            return (
              <li
                key={`${item.kind}:${item.id}`}
                className={`relative flex gap-3 pb-6 last:pb-0 sm:gap-4 ${alignRight ? "flex-row-reverse" : ""}`}
              >
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 top-8 w-px bg-slate-200 ${alignRight ? "right-[15px]" : "left-[15px]"}`}
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

                <div className={`min-w-0 flex-1 pt-0.5 ${alignRight ? "text-right" : ""}`}>
                  <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${alignRight ? "justify-end" : ""}`}>
                    <p className="text-sm font-semibold text-slate-800">{actorName}</p>
                    {item.kind === "comment" && item.is_internal && (
                      <Badge value="internal note" />
                    )}
                    {item.kind === "comment" && item.is_internal && item.body.startsWith("Handoff to ") && <Badge value="handoff" />}
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
                    <div className={`mt-2 w-fit max-w-[92%] rounded-2xl border px-4 py-3.5 shadow-sm ${alignRight ? "ml-auto" : ""} ${isClientComment ? "border-blue-100 bg-blue-50/70" : "border-slate-100 bg-slate-50/70"}`}>
                      <p className="whitespace-pre-wrap text-left text-sm leading-6 text-slate-700">
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
      <div className="mt-5 border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6">
        {canComment ? (
          <TicketCommentForm
            ticketId={ticketId}
            allowInternalNotes={allowInternalNotes}
            canSubmitResolution={canSubmitResolution}
            isIncidentReport={isIncidentReport}
          />
        ) : (
          <p className="text-sm text-slate-600">
            This ticket is complete. The requester must reopen it if more help is needed.
          </p>
        )}
      </div>
      {actions}
    </section>
  );
}
