import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import { isTicketResolutionOverdue } from "@/lib/utils";
import { TicketReportExportButton } from "@/components/reports/ticket-report-export-button";

function elapsedHours(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

function Distribution({ title, values }: { title: string; values: Array<[string, number]> }) {
  const max = Math.max(1, ...values.map(([, count]) => count));
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <h3 className="font-bold text-navy">Tickets by {title}</h3>
      {values.length === 0 ? <p className="mt-4 text-sm text-slate-500">No ticket data yet.</p> : (
        <ul className="mt-4 space-y-3">
          {values.map(([label, count]) => (
            <li key={label}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate text-slate-600">{label}</span>
                <span className="font-semibold text-navy">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TicketReports({
  tickets,
  canExport,
  exportHref = "/api/ticket-report.csv",
  slaPolicies = []
}: {
  tickets: Array<Pick<Ticket, "status" | "priority" | "created_at" | "first_response_at" | "reopened_at" | "resolved_at" | "ccg_request_type" | "ccg_stage_due_at">>;
  canExport: boolean;
  exportHref?: string;
  slaPolicies?: TicketSlaPolicy[];
}) {
  const statuses = new Map<string, number>();
  for (const ticket of tickets) statuses.set(ticket.status, (statuses.get(ticket.status) ?? 0) + 1);
  const resolvedDurations = tickets
    .filter((ticket) => ticket.created_at && ticket.resolved_at)
    .map((ticket) => (Date.parse(ticket.resolved_at!) - Date.parse(ticket.created_at!)) / 86_400_000)
    .filter((days) => Number.isFinite(days) && days >= 0);
  const avgDays = resolvedDurations.length
    ? resolvedDurations.reduce((sum, days) => sum + days, 0) / resolvedDurations.length
    : null;
  const responseDurations = tickets.flatMap((ticket) => {
    const hours = elapsedHours(ticket.created_at, ticket.first_response_at);
    return hours === null ? [] : [hours];
  });
  const avgResponseHours = responseDurations.length
    ? responseDurations.reduce((sum, hours) => sum + hours, 0) / responseDurations.length
    : null;
  const reopenedCount = tickets.filter((ticket) => ticket.reopened_at).length;
  const openCount = tickets.filter((ticket) => !["resolved", "closed", "rejected"].includes(ticket.status)).length;
  const overdueCount = tickets.filter((ticket) => isTicketResolutionOverdue(ticket, slaPolicies)).length;
  const sortedStatuses = [...statuses.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <section className="space-y-4" aria-label="Ticket reports">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Reports</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-navy">Ticket workload</h2>
          <p className="mt-1 text-sm text-slate-500">Based on {tickets.length} tickets available to your account.</p>
        </div>
        {canExport && <TicketReportExportButton href={exportHref} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Open tickets</p><p className="mt-2 text-3xl font-bold text-navy">{openCount}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Overdue tickets</p><p className="mt-2 text-3xl font-bold text-urgent">{overdueCount}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Average first response</p><p className="mt-2 text-3xl font-bold text-navy">{avgResponseHours === null ? "—" : `${avgResponseHours.toFixed(1)} hrs`}</p><p className="mt-1 text-xs text-slate-500">{responseDurations.length} tickets · elapsed time from submission</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Average resolution</p><p className="mt-2 text-3xl font-bold text-navy">{avgDays === null ? "—" : `${avgDays.toFixed(1)} days`}</p><p className="mt-1 text-xs text-slate-500">{resolvedDurations.length} resolved tickets · calendar days</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Reopened tickets</p><p className="mt-2 text-3xl font-bold text-navy">{reopenedCount}</p><p className="mt-1 text-xs text-slate-500">Tickets with a recorded reopen timestamp</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Total tickets</p><p className="mt-2 text-3xl font-bold text-navy">{tickets.length}</p></div>
      </div>
      <Distribution title="status" values={sortedStatuses} />
    </section>
  );
}
