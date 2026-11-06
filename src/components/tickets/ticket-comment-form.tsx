"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addComment, updateTicketStatus } from "@/lib/actions";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function TicketCommentForm({
  ticketId,
  allowInternalNotes,
  canSubmitResolution,
  isIncidentReport
}: {
  ticketId: string;
  allowInternalNotes: boolean;
  canSubmitResolution: boolean;
  isIncidentReport: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const cannedReplies = [
    { label: "Acknowledge request", text: "We've received your request and are reviewing it. We'll update you as soon as we have more information." },
    { label: "Ask for details", text: "Could you please provide a little more information so we can continue working on this request?" },
    { label: "Share an update", text: "Your request is being handled by the service team. We'll keep you updated as work progresses." },
    { label: "Share resolution", text: "We've completed the requested work. Please review the result and let us know if you still need help." }
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await addComment(new FormData(form));
      if ("error" in result) {
        setError(result.error ?? "The comment could not be posted.");
        return;
      }

      form.reset();
      setReply("");
      setNotice("Comment posted.");
      router.refresh();
    } catch {
      setError("The comment could not be posted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitResolution() {
    if (isSubmitting) return;
    const resolution = reply.trim();
    if (!resolution) {
      setError(isIncidentReport
        ? "Add the inspection, root cause, and corrective action before submitting the resolution."
        : "Add a resolution summary before submitting the resolution.");
      return;
    }
    if (isInternalNote) {
      setError("Uncheck Internal note so the resolution is visible to the requester.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.set("ticket_id", ticketId);
    form.set("status", "resolved");
    form.set("resolution_notes", resolution);
    try {
      const result = await updateTicketStatus(form);
      if ("error" in result) {
        setError(result.error ?? "The resolution could not be submitted.");
        return;
      }
      setReply("");
      setNotice("Ticket resolved. The requester has been notified.");
      router.refresh();
    } catch {
      setError("The resolution could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="ticket_id" value={ticketId} />
      {allowInternalNotes && (
        <div className="mb-3 grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Quick replies</span>
          <div className="flex flex-wrap gap-2">
            {cannedReplies.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={isSubmitting}
                onClick={() => setReply(item.text)}
                className="min-h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Choose a button to add editable text to your comment.</p>
        </div>
      )}
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Add comment</span>
        <textarea
          name="body"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={4}
          required
          maxLength={5000}
          disabled={isSubmitting}
          placeholder="Write a message…"
          className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 shadow-sm placeholder:text-slate-400 focus-ring"
        />
      </label>
      {allowInternalNotes && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            name="is_internal"
            type="checkbox"
            checked={isInternalNote}
            onChange={(event) => setIsInternalNote(event.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-slate-300"
          />
          Internal note
        </label>
      )}
      {error && <div className="mt-3"><FeedbackMessage type="error">{error}</FeedbackMessage></div>}
      {notice && <div className="mt-3"><FeedbackMessage type="success">{notice}</FeedbackMessage></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting}>
          <MessageSquare className="h-4 w-4" />
          {isSubmitting ? "Posting..." : "Post comment"}
        </Button>
        {canSubmitResolution && (
          <Button type="button" variant="secondary" loading={isSubmitting} onClick={() => void handleSubmitResolution()}>
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? "Submitting resolution..." : "Resolve & notify requester"}
          </Button>
        )}
      </div>
    </form>
  );
}
