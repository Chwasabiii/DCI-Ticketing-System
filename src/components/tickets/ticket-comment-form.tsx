"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addComment } from "@/lib/actions";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await addComment(new FormData(form));
      if ("error" in result) {
        setError(result.error ?? "The comment could not be posted.");
        return;
      }

      form.reset();
      router.refresh();
    } catch {
      setError("The comment could not be posted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Add comment</span>
        <textarea
          name="body"
          rows={4}
          required
          disabled={isSubmitting}
          className="rounded-xl border border-slate-200 px-3 py-3 text-sm focus-ring"
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
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="mt-4">
        <MessageSquare className="h-4 w-4" />
        {isSubmitting ? "Posting..." : "Post comment"}
      </Button>
    </form>
  );
}