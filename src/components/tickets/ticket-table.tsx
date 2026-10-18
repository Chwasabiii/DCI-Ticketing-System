import Link from "next/link";
import { AlertCircle, ArrowUpRight, LockKeyhole, Ticket as TicketIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function requestTypeLabel(type: Ticket["request_type"]) {
  if (type === "access_request") return "Access request";
  if (type === "incident_report") return "Incident report";
  return "General request";
}

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-accent">
          <TicketIcon className="h-5 w-5" />
        </span>
        <h3 className="mt-4 font-bold text-navy">No tickets to show</h3>
        <p className="mt-1 text-sm text-slate-500">
          Tickets you can access will appear here when they’re opened.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <ul className="divide-y divide-slate-100">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/tickets/${ticket.id}`}
              className="group grid gap-3 p-4 transition-colors hover:bg-slate-50/80 focus-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-accent">
                  <TicketIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs font-bold text-accent">
                      {ticket.ticket_no ?? `Ticket #${ticket.id}`}
                    </span>
                    {ticket.is_confidential && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                        <LockKeyhole className="h-3 w-3" /> Confidential
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-navy group-hover:text-accent">
                    {ticket.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{requestTypeLabel(ticket.request_type)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Opened {formatDate(ticket.created_at)}</span>
                    {ticket.due_date && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          {new Date(ticket.due_date) < new Date() &&
                            !["resolved", "closed", "rejected"].includes(ticket.status) && (
                              <AlertCircle className="h-3 w-3 text-urgent" />
                            )}
                          Due {formatDate(ticket.due_date)}
                        </span>
                      </>
                    )}
                    {ticket.project?.name && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{ticket.project.name}</span>
                      </>
                    )}
                  </span>
                  {ticket.approval_status === "pending" && (
                    <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      Waiting for project approval
                    </span>
                  )}
                  {ticket.approval_status === "rejected" && (
                    <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800">
                      Project request rejected
                    </span>
                  )}
                </span>
              </div>
              <span className="flex items-center justify-between gap-3 pl-[3.25rem] sm:justify-end sm:pl-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge value={ticket.status} />
                  <Badge value={ticket.priority} />
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-accent" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
