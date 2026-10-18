"use client";

import { useState, type FormEvent } from "react";
import { saveNotificationPreferences } from "@/lib/actions";
import type { NotificationPreference } from "@/lib/types";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Button } from "@/components/ui/button";

const options = [
  { type: "ticket_submitted", label: "Ticket submitted", description: "A new ticket is submitted or assigned to you." },
  { type: "ticket_assigned", label: "Ticket assigned", description: "A ticket is assigned or unassigned." },
  { type: "ticket_approved", label: "Approval decisions", description: "A project ticket is approved." },
  { type: "ticket_rejected", label: "Rejections", description: "A project ticket or request is rejected." },
  { type: "ticket_updated", label: "Ticket updates and comments", description: "Ticket details, status, or comments change." }
] as const;

export function NotificationPreferences({ initial }: { initial: NotificationPreference[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.map(({ type }) => [type, initial.find((item) => item.notification_type === type)?.enabled ?? true]))
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      Object.entries(enabled).forEach(([type, isEnabled]) => {
        if (isEnabled) formData.append("enabled_types", type);
      });
      const result = await saveNotificationPreferences(formData);
      setFeedback("error" in result ? { error: result.error } : { success: result.success });
    } catch {
      setFeedback({ error: "Notification preferences could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-navy">In-app notifications</h2>
      <p className="mt-1 text-sm text-slate-600">Choose which ticket events appear in your notification list. Email preferences are managed separately.</p>
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
        {options.map((option) => (
          <label key={option.type} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={enabled[option.type]}
              onChange={(event) => setEnabled((current) => ({ ...current, [option.type]: event.target.checked }))}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus-ring"
            />
            <span><span className="block text-sm font-semibold text-slate-800">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{option.description}</span></span>
          </label>
        ))}
        {feedback?.error && <FeedbackMessage type="error">{feedback.error}</FeedbackMessage>}
        {feedback?.success && <FeedbackMessage type="success">{feedback.success}</FeedbackMessage>}
        <Button type="submit" loading={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </form>
    </section>
  );
}
