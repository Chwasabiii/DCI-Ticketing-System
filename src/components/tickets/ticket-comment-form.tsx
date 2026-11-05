"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addComment } from "@/lib/actions";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function TicketCommentForm({
  ticketId,
  allowInternalNotes
}: {
  ticketId: string;
  allowInternalNotes: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const cannedReplies = [
    { label: "We received your request", text: "We’ve received your request and are reviewing it. We’ll update you as soon as we have more information." },
    { label: "Request more information", text: "Could you please provide a little more information so we can continue working on this request?" },
    { label: "Ticket assigned", text: "Your request has been assigned to the appropriate team. We’ll keep you updated on its progress." },
    { label: "Issue resolved", text: "This issue has been resolved. Please let us know if you still need help." }
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

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="ticket_id" value={ticketId} />
      {allowInternalNotes && (
        <label className="mb-3 grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Reusable reply</span>
          <select value={reply} onChange={(event) => setReply(event.target.value)} disabled={isSubmitting} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus-ring">
            <option value="">Choose a reply to edit…</option>
            {cannedReplies.map((item) => <option key={item.label} value={item.text}>{item.label}</option>)}
          </select>
        </label>
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
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-slate-300"
          />
          Internal note
        </label>
      )}
      {error && <div className="mt-3"><FeedbackMessage type="error">{error}</FeedbackMessage></div>}
      {notice && <div className="mt-3"><FeedbackMessage type="success">{notice}</FeedbackMessage></div>}
      <Button type="submit" loading={isSubmitting} className="mt-4">
        <MessageSquare className="h-4 w-4" />
        {isSubmitting ? "Posting..." : "Post comment"}
      </Button>
    </form>
  );
}
