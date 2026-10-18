"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { reviewProjectTicket } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ProjectApprovalActions({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await reviewProjectTicket(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Your decision was recorded.");
      router.refresh();
    } catch {
      setError("Your approval decision could not be recorded. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-950">Project approval required</h3>
      <p className="mt-1 text-sm text-amber-900">
        Approve this request to let PMSG route it, or reject it with a reason.
      </p>
      <div className="mt-3 grid gap-2">
        <form onSubmit={handleReview}>
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="decision" value="approved" />
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving..." : "Approve"}
          </Button>
        </form>
        <form onSubmit={handleReview} className="grid gap-2">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="decision" value="rejected" />
          <label className="grid gap-1 text-xs font-semibold text-amber-950">
            Reason for rejection (required)
            <textarea
              name="comment"
              required
              maxLength={2000}
              rows={3}
              disabled={submitting}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus-ring"
            />
          </label>
          <Button type="submit" variant="secondary" loading={submitting}>
            Reject request
          </Button>
        </form>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-resolved">{message}</p>}
    </section>
  );
}
