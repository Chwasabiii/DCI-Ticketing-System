"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { Profile } from "@/lib/types";
import { handoffTicket } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function TicketHandoffForm({ ticketId, employees }: { ticketId: string; employees: Profile[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await handoffTicket(new FormData(form));
      if ("error" in result) setFeedback({ type: "error", text: result.error ?? "Ticket handoff failed." });
      else { setFeedback({ type: "success", text: result.success ?? "Ticket handed off." }); form.reset(); router.refresh(); }
    } catch {
      setFeedback({ type: "error", text: "Ticket handoff failed. Please try again." });
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><ArrowRightLeft className="h-5 w-5" /></span><div><h2 className="font-bold text-navy">Hand off ticket</h2><p className="mt-1 text-sm text-slate-600">Reassign it and leave a private summary for the next staff member.</p></div></div>
    <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Next owner<select name="assigned_to" required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring"><option value="">Select an employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email || "Employee"}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Handoff notes <span className="text-xs font-normal text-slate-500">What’s been tried, what remains, or the next step?</span><textarea name="note" required minLength={5} maxLength={2000} rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-ring" placeholder="Summarize the current state and recommended next action." /></label>
      {feedback && <FeedbackMessage type={feedback.type}>{feedback.text}</FeedbackMessage>}
      <Button type="submit" loading={busy} className="sm:w-fit">Hand off ticket</Button>
    </form>
  </section>;
}
