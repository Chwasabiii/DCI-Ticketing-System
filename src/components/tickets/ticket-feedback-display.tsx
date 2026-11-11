import { Star } from "lucide-react";
import type { TicketFeedback } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function TicketFeedbackDisplay({ feedback }: { feedback: TicketFeedback | null }) {
  return (
    <section aria-labelledby="requester-feedback-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(20,40,75,0.06)] sm:p-6">
      <h2 id="requester-feedback-title" className="text-lg font-bold text-navy">Requester feedback</h2>
      {feedback ? (
        <div className="mt-3">
          <div
            className="flex items-center gap-1"
            aria-label={`Requester rated this support ${feedback.rating} out of 5 stars`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                aria-hidden="true"
                className={`h-5 w-5 ${index < feedback.rating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
              />
            ))}
            <span className="ml-2 text-sm font-semibold text-slate-800">{feedback.rating} out of 5</span>
          </div>
          {feedback.comment && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{feedback.comment}</p>
          )}
          <p className="mt-3 text-xs text-slate-600">Submitted {formatDateTime(feedback.created_at)}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-700">The requester has not submitted feedback yet.</p>
      )}
    </section>
  );
}
