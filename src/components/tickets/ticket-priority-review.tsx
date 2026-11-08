"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewTicketPriority } from "@/lib/actions";
import { calculateTicketPriority, needsTicketPriorityReview } from "@/lib/utils";
import type { Ticket, TicketImpact, TicketUrgency } from "@/lib/types";

export function TicketPriorityReview({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const [impact, setImpact] = useState<TicketImpact>(ticket.impact ?? "medium");
  const [urgency, setUrgency] = useState<TicketUrgency>(ticket.urgency ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setFailed(false);
    try {
      const result = await reviewTicketPriority(new FormData(event.currentTarget));
      if ("error" in result) {
        setFailed(true);
        setMessage(result.error ?? "Priority review could not be saved.");
        return;
      }
      setMessage(result.success ?? "Priority review saved.");
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("Priority review could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <input type="hidden" name="ticket_id" value={ticket.id} />
      <div>
        <h2 className="text-sm font-bold text-navy">Review impact and urgency</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {needsTicketPriorityReview(ticket)
            ? `Requester reported ${ticket.reported_impact} impact and ${ticket.reported_urgency} urgency. High ratings are held at Medium until reviewed.`
            : "Confirm or adjust the requester’s impact and urgency to set the ticket’s service level."}
        </p>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700">
          Confirmed impact
          <select name="impact" value={impact} onChange={(event) => setImpact(event.target.value as TicketImpact)} disabled={saving} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring disabled:bg-slate-50">
            <option value="low">Low — limited impact</option>
            <option value="medium">Medium — team affected</option>
            <option value="high">High — critical service or many users</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700">
          Confirmed urgency
          <select name="urgency" value={urgency} onChange={(event) => setUrgency(event.target.value as TicketUrgency)} disabled={saving} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring disabled:bg-slate-50">
            <option value="low">Low — can be scheduled</option>
            <option value="medium">Medium — needs attention soon</option>
            <option value="high">High — work or service is blocked</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700">Confirmed priority: <strong className="capitalize">{calculateTicketPriority(impact, urgency)}</strong></p>
        <Button type="submit" variant="secondary" loading={saving}>
          <Save className="h-4 w-4" />
          Save priority review
        </Button>
      </div>
      {message && <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-700" : "text-resolved"}`}>{message}</p>}
    </form>
  );
}
