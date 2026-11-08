import { TicketTable } from "@/components/tickets/ticket-table";
import { getTicketSlaPolicies, getTickets } from "@/lib/data";
import { isTicketResolutionOverdue } from "@/lib/utils";

export default async function OverduePage() {
  const [allTickets, slaPolicies] = await Promise.all([getTickets(200), getTicketSlaPolicies()]);
  const tickets = allTickets.filter((ticket) => isTicketResolutionOverdue(ticket, slaPolicies));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Overdue Monitoring</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manager view for aging requests that need follow-up.
        </p>
      </div>
      <TicketTable tickets={tickets} slaPolicies={slaPolicies} />
    </div>
  );
}
