"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Comment } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type RealtimeStatus = "connecting" | "live" | "unavailable";

function mergeComments(...groups: Comment[][]) {
  const commentsById = new Map<string, Comment>();

  for (const comment of groups.flat()) {
    commentsById.set(String(comment.id), comment);
  }

  return Array.from(commentsById.values()).sort(
    (left, right) =>
      Date.parse(left.created_at ?? "") - Date.parse(right.created_at ?? "")
  );
}

export function TicketComments({
  ticketId,
  initialComments
}: {
  ticketId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    setComments((current) => mergeComments(current, initialComments));
  }, [initialComments]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-comments:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_comments",
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          const newComment = payload.new as Comment;
          setComments((current) => mergeComments(current, [newComment]));
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          const { data, error } = await supabase
            .from("ticket_comments")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true })
            .returns<Comment[]>();

          if (!error && data) {
            setComments((current) => mergeComments(current, data));
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("unavailable");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return (
    <section className="rounded-lg bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">Timeline</h2>
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-xs text-slate-500"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeStatus === "live"
                ? "bg-resolved"
                : realtimeStatus === "unavailable"
                  ? "bg-slate-300"
                  : "bg-warning"
            }`}
          />
          {realtimeStatus === "live"
            ? "Live updates"
            : realtimeStatus === "unavailable"
              ? "Live updates unavailable"
              : "Connecting"}
        </p>
      </div>
      <div className="mt-5 space-y-4">
        {comments.length === 0 && (
          <p className="text-sm text-slate-500">No comments have been added yet.</p>
        )}
        {comments.map((comment) => (
          <article key={comment.id} className="border-l-2 border-blue-100 pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {comment.author_id}
              </p>
              {comment.is_internal && <Badge value="internal" />}
              <p className="text-xs text-slate-500">{formatDate(comment.created_at)}</p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {comment.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}