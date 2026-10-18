"use client";

import { Download } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { isTicketOverdue } from "@/lib/utils";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportTickets(tickets: Ticket[]) {
  const columns = ["Ticket", "Title", "Status", "Priority", "Project", "Created", "Due date", "Resolved"];
  const rows = tickets.map((ticket) => [
    ticket.ticket_no ?? ticket.id,
    ticket.title,
    ticket.status,
    ticket.priority,
    ticket.project?.name ?? "No project",
    ticket.created_at,
    ticket.due_date,
    ticket.resolved_at
  ]);
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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

export function TicketReports({ tickets, canExport }: { tickets: Ticket[]; canExport: boolean }) {
  const statuses = new Map<string, number>();
  const projects = new Map<string, number>();
  for (const ticket of tickets) {
    statuses.set(ticket.status, (statuses.get(ticket.status) ?? 0) + 1);
    const projectName = ticket.project?.name ?? "No project";
    projects.set(projectName, (projects.get(projectName) ?? 0) + 1);
  }
  const resolvedDurations = tickets
    .filter((ticket) => ticket.created_at && ticket.resolved_at)
    .map((ticket) => (Date.parse(ticket.resolved_at!) - Date.parse(ticket.created_at!)) / 86_400_000)
    .filter((days) => Number.isFinite(days) && days >= 0);
  const avgDays = resolvedDurations.length
    ? resolvedDurations.reduce((sum, days) => sum + days, 0) / resolvedDurations.length
    : null;
  const sortCounts = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <section className="space-y-4" aria-label="Ticket reports">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Reports</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-navy">Ticket workload</h2>
          <p className="mt-1 text-sm text-slate-500">Based on {tickets.length} tickets available to your account.</p>
        </div>
        {canExport && (
          <button type="button" onClick={() => exportTickets(tickets)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Open tickets</p><p className="mt-2 text-3xl font-bold text-navy">{tickets.filter((ticket) => !["resolved", "closed", "rejected"].includes(ticket.status)).length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Overdue tickets</p><p className="mt-2 text-3xl font-bold text-urgent">{tickets.filter(isTicketOverdue).length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Average resolution</p><p className="mt-2 text-3xl font-bold text-navy">{avgDays === null ? "—" : `${avgDays.toFixed(1)} days`}</p><p className="mt-1 text-xs text-slate-500">{resolvedDurations.length} resolved tickets with timestamps</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-sm font-semibold text-slate-500">Total tickets</p><p className="mt-2 text-3xl font-bold text-navy">{tickets.length}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Distribution title="status" values={sortCounts(statuses)} />
        <Distribution title="project" values={sortCounts(projects)} />
      </div>
    </section>
  );
}
