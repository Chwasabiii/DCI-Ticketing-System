"use client";

import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { submitTicketFeedback } from "@/lib/actions";
import type { TicketFeedback } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function TicketSatisfactionSurvey({
  ticketId,
  feedback
}: {
  ticketId: string;
  feedback: TicketFeedback | null;
}) {
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await submitTicketFeedback(new FormData(event.currentTarget));
      if ("error" in result) setError(result.error ?? "Feedback could not be submitted.");
      else setSuccess(result.success ?? "Thank you for your feedback.");
    } catch {
      setError("Feedback could not be submitted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(20,40,75,0.06)] sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Your feedback</p>
      <h2 className="mt-1 text-lg font-bold text-navy">How was your support experience?</h2>
      <p className="mt-1 text-sm text-slate-600">Your rating helps us improve our support.</p>
      {feedback ? (
        <div className="mt-4">
          <div className="flex items-center gap-1" aria-label={`You rated this support ${feedback.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} aria-hidden="true" className={`h-5 w-5 ${index < feedback.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
            ))}
            <span className="ml-2 text-sm font-semibold text-slate-700">{feedback.rating} out of 5</span>
          </div>
          {feedback.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{feedback.comment}</p>}
          <p className="mt-3 text-xs text-emerald-700">Feedback submitted. Thank you!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="rating" value={rating || ""} />
          <fieldset disabled={loading}>
            <legend className="text-sm font-semibold text-slate-700">Your rating</legend>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                    className="focus-ring rounded-md p-1"
                  >
                    <Star aria-hidden="true" className={`h-7 w-7 transition-colors ${index < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Optional comment
            <textarea name="comment" rows={3} maxLength={1000} disabled={loading} placeholder="Tell us what went well or what we could improve." className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-ring" />
          </label>
          {error && <FeedbackMessage type="error">{error}</FeedbackMessage>}
          {success && <FeedbackMessage type="success">{success}</FeedbackMessage>}
          <div><Button type="submit" loading={loading} disabled={Boolean(success)}>Submit feedback</Button></div>
        </form>
      )}
    </section>
  );
}
