"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { deleteCcgBusinessHoliday, saveCcgBusinessHoliday } from "@/lib/actions";
import type { BusinessHoliday } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CcgBusinessHolidayCalendar({ holidays }: { holidays: BusinessHoliday[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setMessage("");
    const result = await saveCcgBusinessHoliday(new FormData(form));
    setMessage(result.error ?? result.success ?? "");
    if (result.success) { form.reset(); router.refresh(); }
    setBusy(false);
  }

  async function removeHoliday(holidayDate: string) {
    setBusy(true); setMessage("");
    const form = new FormData(); form.set("holiday_date", holidayDate);
    const result = await deleteCcgBusinessHoliday(form);
    setMessage(result.error ?? result.success ?? "");
    if (result.success) router.refresh();
    setBusy(false);
  }

  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.025)] sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent"><CalendarDays className="h-5 w-5" /></span>
      <div><h2 className="font-bold text-navy">CCG business holidays</h2><p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">Vendor search targets count weekdays and skip dates on this calendar. Add your organization’s holidays here; dates use UTC for deadline calculation.</p></div>
    </div>
    <form onSubmit={addHoliday} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Date<input name="holiday_date" type="date" required className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Holiday name<input name="name" required maxLength={120} placeholder="Holiday name" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
      <button disabled={busy} className="self-end rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add holiday</button>
    </form>
    {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
    {holidays.length ? <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
      {holidays.map((holiday) => <li key={holiday.holiday_date} className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-sm"><strong className="text-slate-800">{formatDate(holiday.holiday_date)}</strong><span className="ml-2 text-slate-500">{holiday.name}</span></span>
        <button type="button" disabled={busy} onClick={() => removeHoliday(holiday.holiday_date)} aria-label={`Remove ${holiday.name}`} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
      </li>)}
    </ul> : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No holidays are configured yet. Weekend days are already excluded.</p>}
  </section>;
}
