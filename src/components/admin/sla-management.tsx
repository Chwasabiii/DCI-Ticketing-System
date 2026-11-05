"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { saveTicketSlaPolicies } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { TicketSlaPolicy } from "@/lib/types";

const priorityGroups = ["high", "standard"] as const;

export function SlaManagement({ policies }: { policies: TicketSlaPolicy[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const targets = new Map(policies.map((policy) => [policy.priority_group, policy]));

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
    <header><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Administration</p><h1 className="mt-1 text-3xl font-bold text-navy">SLA targets</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Set first response and resolution targets in business days. High includes high and urgent tickets; Standard includes medium and low tickets.</p></header>
    <form onSubmit={(event) => void submit(event)} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Priority group</th><th className="px-4 py-3">First response (business days)</th><th className="px-4 py-3">Resolution (business days)</th></tr></thead><tbody className="divide-y divide-slate-100">
        {priorityGroups.map((group) => <tr key={group}><th scope="row" className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${group === "high" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{group === "high" ? "High (high / urgent)" : "Standard (medium / low)"}</span></th><td className="px-4 py-3"><label className="sr-only" htmlFor={`response-${group}`}>{group} first response business days</label><input id={`response-${group}`} name={`response_${group}`} type="number" min="1" max="365" step="1" required defaultValue={targets.get(group)?.first_response_business_days ?? 1} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td><td className="px-4 py-3"><label className="sr-only" htmlFor={`resolution-${group}`}>{group} resolution business days</label><input id={`resolution-${group}`} name={`resolution_${group}`} type="number" min="1" max="365" step="1" required defaultValue={targets.get(group)?.resolution_business_days ?? (group === "high" ? 1 : 3)} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td></tr>)}
      </tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">{feedback ? <FeedbackMessage type={feedback.type}>{feedback.text}</FeedbackMessage> : <p className="inline-flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" /> Weekends are skipped in UTC; public holidays are not configured.</p>}<Button type="submit" loading={saving} className="shrink-0">Save targets</Button></div>
    </form>
  </div>;
}
