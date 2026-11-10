import { Check, CircleCheck, ClipboardList, FileCheck2, Search, UserRound } from "lucide-react";
import type { Ticket } from "@/lib/types";

const stages = [
  { label: "New request", icon: ClipboardList },
  { label: "Assigned", icon: UserRound },
  { label: "CCG review", icon: Search },
  { label: "CCG work", icon: ClipboardList },
  { label: "Response sent", icon: FileCheck2 },
  { label: "Completed", icon: CircleCheck }
];

function getStageIndex(status: Ticket["status"]) {
  switch (status) {
    case "open":
      return 0;
    case "assigned":
      return 1;
    case "under_review":
      return 2;
    case "in_progress":
    case "waiting_for_info":
      return 3;
    case "resolved":
      return 4;
    case "closed":
    case "rejected":
      return 5;
    default:
      return 0;
  }
}

function getStageDescription(ticket: Ticket) {
  if (ticket.status === "waiting_for_info") return "Waiting for information from the requester.";
  if (ticket.status === "rejected") return "This request was rejected.";
  if (ticket.status === "closed") return "The requester confirmed the response.";
  if (ticket.status === "resolved") return "CCG sent a response. Waiting for requester confirmation.";
  if (ticket.status === "in_progress" && ticket.ccg_followup_status === "pending") {
    return "CCG work or vendor follow-up is in progress.";
  }
  if (ticket.status === "under_review") return "CCG is reviewing the request and checking references.";
  if (ticket.status === "assigned") return "The request has an owner and is awaiting CCG review.";
  return "Your request has been submitted to CCG.";
}

export function CcgTicketStatusBar({ ticket }: { ticket: Ticket }) {
  const activeIndex = getStageIndex(ticket.status);
  const rejected = ticket.status === "rejected";

  return (
    <section
      aria-label="CCG ticket progress"
      className="mt-5 rounded-xl border border-emerald-100 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-navy">Request progress</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">{getStageDescription(ticket)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${rejected ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
          {ticket.status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="relative mt-5">
        <div aria-hidden="true" className="absolute left-[8.333%] right-[8.333%] top-5 hidden h-1 rounded-full bg-slate-200 sm:block">
          <div
            className={`h-full rounded-full ${rejected ? "bg-rose-400" : "bg-emerald-500"}`}
            style={{ width: `${(activeIndex / (stages.length - 1)) * 100}%` }}
          />
        </div>
        <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
          {stages.map(({ label, icon: Icon }, index) => {
            const complete = index < activeIndex || (ticket.status === "closed" && index === activeIndex);
            const current = index === activeIndex && ticket.status !== "closed";
            const finalLabel = rejected && index === stages.length - 1 ? "Rejected" : label;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className="relative z-10 flex min-w-0 flex-col items-center text-center"
              >
                <span className={`grid h-10 w-10 place-items-center rounded-full ring-4 ring-white ${
                  rejected && current
                    ? "bg-rose-100 text-rose-700"
                    : complete
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-emerald-100 text-emerald-800 ring-emerald-50"
                        : "bg-slate-100 text-slate-400"
                }`}>
                  {complete ? <Check className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className={`mt-2 text-[11px] leading-4 sm:text-xs ${current ? "font-bold text-navy" : complete ? "font-semibold text-emerald-800" : "font-medium text-slate-500"}`}>
                  {finalLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
