import Link from "next/link";
import { TicketReports } from "@/components/reports/ticket-reports";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getCurrentContext, getReportSummaryTickets, getReportTickets, getTicketSlaPolicies } from "@/lib/data";
import type { TicketStatus } from "@/lib/types";

const statuses: TicketStatus[] = ["open", "under_review", "assigned", "in_progress", "waiting_for_info", "resolved", "closed", "rejected"];
const pageSize = 25;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const startValue = validDate(params.start) ? params.start : undefined;
  const endValue = validDate(params.end) ? params.end : undefined;
  const statusValue = typeof params.status === "string" && statuses.includes(params.status as TicketStatus)
    ? params.status
    : undefined;
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [{ profile }, reportPage, summaryTickets, slaPolicies] = await Promise.all([
    getCurrentContext(),
    getReportTickets({ startDate: startValue, endDate: endValue, status: statusValue, page, pageSize }),
    getReportSummaryTickets({ startDate: startValue, endDate: endValue, status: statusValue }),
    getTicketSlaPolicies()
  ]);
  const totalPages = Math.max(1, Math.ceil(reportPage.totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTickets = currentPage === page ? reportPage.tickets : (await getReportTickets({ startDate: startValue, endDate: endValue, status: statusValue, page: currentPage, pageSize })).tickets;
  const makePageUrl = (nextPage: number) => {
    const next = new URLSearchParams();
    if (startValue) next.set("start", startValue);
    if (endValue) next.set("end", endValue);
    if (statusValue) next.set("status", statusValue);
    next.set("page", String(nextPage));
    return `/reports?${next.toString()}`;
  };
  const exportParams = new URLSearchParams();
  if (startValue) exportParams.set("start", startValue);
  if (endValue) exportParams.set("end", endValue);
  if (statusValue) exportParams.set("status", statusValue);
  const exportHref = `/api/ticket-report.csv${exportParams.size ? `?${exportParams.toString()}` : ""}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Analytics</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy">Ticket reports</h1>
        <p className="mt-2 text-sm text-slate-600">Filter tickets by submission date and status. Results follow your account’s ticket access.</p>
      </header>

      <form method="get" className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Submitted from<input type="date" name="start" defaultValue={startValue} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 focus-ring" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Submitted through<input type="date" name="end" defaultValue={endValue} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 focus-ring" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Status<select name="status" defaultValue={statusValue ?? "all"} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 focus-ring"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        <button className="focus-ring min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-blue-700" type="submit">Apply filters</button>
        <Link href="/reports" className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear</Link>
      </form>

      <TicketReports tickets={summaryTickets} canExport={profile?.user_side === "admin" && profile.status === "active"} exportHref={exportHref} slaPolicies={slaPolicies} />

      <section className="space-y-3" aria-label="Ticket report results">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-bold text-navy">Matching tickets</h2><p className="mt-1 text-sm text-slate-500">{reportPage.totalCount} results · page {currentPage} of {totalPages}</p></div>
          <nav aria-label="Ticket report pages" className="flex items-center gap-2">
            {currentPage > 1 ? <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold hover:bg-white" href={makePageUrl(currentPage - 1)}>Previous</Link> : <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-100 px-3 text-sm text-slate-400">Previous</span>}
            {currentPage < totalPages ? <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold hover:bg-white" href={makePageUrl(currentPage + 1)}>Next</Link> : <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-100 px-3 text-sm text-slate-400">Next</span>}
          </nav>
        </div>
        <TicketTable tickets={visibleTickets} slaPolicies={slaPolicies} />
      </section>
    </div>
  );
}
