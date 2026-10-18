"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { saveTicketSlaPolicies } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { TicketSlaPolicy } from "@/lib/types";

const priorities = ["urgent", "high", "medium", "low"] as const;

export function SlaManagement({ policies }: { policies: TicketSlaPolicy[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const targets = new Map(policies.map((policy) => [policy.priority, policy]));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveTicketSlaPolicies(new FormData(event.currentTarget));
      if ("error" in result) setFeedback({ type: "error", text: result.error ?? "SLA targets could not be saved." });
      else { setFeedback({ type: "success", text: result.success ?? "SLA targets saved." }); router.refresh(); }
    } catch {
      setFeedback({ type: "error", text: "SLA targets could not be saved. Please try again." });
    } finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Administration</p><h1 className="mt-1 text-3xl font-bold text-navy">SLA targets</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Set first response and resolution targets in elapsed hours by ticket priority. The inbox warns staff when a target is approaching or has been missed.</p></header>
    <form onSubmit={(event) => void submit(event)} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Priority</th><th className="px-4 py-3">First response (hours)</th><th className="px-4 py-3">Resolution (hours)</th></tr></thead><tbody className="divide-y divide-slate-100">
        {priorities.map((priority) => <tr key={priority}><th scope="row" className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${priority === "urgent" ? "bg-rose-50 text-rose-700" : priority === "high" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{priority}</span></th><td className="px-4 py-3"><label className="sr-only" htmlFor={`response-${priority}`}>{priority} first response hours</label><input id={`response-${priority}`} name={`response_${priority}`} type="number" min="1" max="8760" step="1" required defaultValue={targets.get(priority)?.first_response_hours ?? ({ urgent: 1, high: 4, medium: 8, low: 24 }[priority])} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td><td className="px-4 py-3"><label className="sr-only" htmlFor={`resolution-${priority}`}>{priority} resolution hours</label><input id={`resolution-${priority}`} name={`resolution_${priority}`} type="number" min="1" max="8760" step="1" required defaultValue={targets.get(priority)?.resolution_hours ?? ({ urgent: 8, high: 24, medium: 72, low: 120 }[priority])} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td></tr>)}
      </tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">{feedback ? <FeedbackMessage type={feedback.type}>{feedback.text}</FeedbackMessage> : <p className="inline-flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" /> Targets use calendar hours, including weekends.</p>}<Button type="submit" loading={saving} className="shrink-0">Save targets</Button></div>
    </form>
  </div>;
}
