"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, Trash2 } from "lucide-react";
import { deleteTicketSlaHoliday, saveTicketSlaHoliday, saveTicketSlaPolicies } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { BusinessHoliday, TicketSlaPolicy } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const priorityGroups = ["high", "standard"] as const;

export function SlaManagement({ policies, holidays }: { policies: TicketSlaPolicy[]; holidays: BusinessHoliday[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState("");
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

  async function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setHolidayBusy(true);
    setHolidayMessage("");
    try {
      const result = await saveTicketSlaHoliday(new FormData(form));
      setHolidayMessage(result.error ?? result.success ?? "");
      if (result.success) {
        form.reset();
        router.refresh();
      }
    } catch {
      setHolidayMessage("SLA holiday could not be saved. Please try again.");
    } finally {
      setHolidayBusy(false);
    }
  }

  async function removeHoliday(holidayDate: string) {
    setHolidayBusy(true);
    setHolidayMessage("");
    try {
      const form = new FormData();
      form.set("holiday_date", holidayDate);
      const result = await deleteTicketSlaHoliday(form);
      setHolidayMessage(result.error ?? result.success ?? "");
      if (result.success) router.refresh();
    } catch {
      setHolidayMessage("SLA holiday could not be removed. Please try again.");
    } finally {
      setHolidayBusy(false);
    }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Administration</p><h1 className="mt-1 text-3xl font-bold text-navy">SLA targets</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Set first response and resolution targets in business days. High includes high and urgent tickets; Standard includes medium and low tickets.</p></header>
    <form onSubmit={(event) => void submit(event)} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Priority group</th><th className="px-4 py-3">First response (business days)</th><th className="px-4 py-3">Resolution (business days)</th></tr></thead><tbody className="divide-y divide-slate-100">
        {priorityGroups.map((group) => <tr key={group}><th scope="row" className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${group === "high" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{group === "high" ? "High (high / urgent)" : "Standard (medium / low)"}</span></th><td className="px-4 py-3"><label className="sr-only" htmlFor={`response-${group}`}>{group} first response business days</label><input id={`response-${group}`} name={`response_${group}`} type="number" min="1" max="365" step="1" required defaultValue={targets.get(group)?.first_response_business_days ?? 1} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td><td className="px-4 py-3"><label className="sr-only" htmlFor={`resolution-${group}`}>{group} resolution business days</label><input id={`resolution-${group}`} name={`resolution_${group}`} type="number" min="1" max="365" step="1" required defaultValue={targets.get(group)?.resolution_business_days ?? (group === "high" ? 1 : 3)} disabled={saving} className="min-h-10 w-full max-w-40 rounded-lg border border-slate-200 px-3 focus-ring" /></td></tr>)}
      </tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">{feedback ? <FeedbackMessage type={feedback.type}>{feedback.text}</FeedbackMessage> : <p className="inline-flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" /> SLA time runs 9 a.m.–5 p.m. Asia/Manila, Monday–Friday. Configured holiday dates are excluded.</p>}<Button type="submit" loading={saving} className="shrink-0">Save targets</Button></div>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-bold text-navy">SLA holidays</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Add specific dates when SLA time should not accrue. Weekend days are already excluded. Add each year’s date separately.</p>
          </div>
        </div>
        <form onSubmit={(event) => void addHoliday(event)} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Date
            <input name="holiday_date" type="date" required disabled={holidayBusy} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm focus-ring" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Holiday name
            <input name="name" type="text" required maxLength={120} disabled={holidayBusy} placeholder="Holiday name" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm focus-ring" />
          </label>
          <button type="submit" disabled={holidayBusy} className="min-h-10 self-end rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white focus-ring disabled:opacity-50">
            {holidayBusy ? "Saving..." : "Add holiday"}
          </button>
        </form>
        {holidayMessage && <p role="status" className="mt-3 text-sm text-slate-600">{holidayMessage}</p>}
      </div>
      {holidays.length ? <ul className="divide-y divide-slate-100">
        {holidays.map((holiday) => <li key={holiday.holiday_date} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="text-sm"><strong className="text-slate-800">{formatDate(holiday.holiday_date)}</strong><span className="ml-2 text-slate-500">{holiday.name}</span></span>
          <button
            type="button"
            disabled={holidayBusy}
            onClick={() => void removeHoliday(holiday.holiday_date)}
            aria-label={`Remove ${holiday.name}`}
            className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-ring disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </li>)}
      </ul> : <p className="p-4 text-sm text-slate-500 sm:px-5">No SLA holidays configured.</p>}
    </section>
  </div>;
}
