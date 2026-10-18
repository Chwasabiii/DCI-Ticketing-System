import { TicketTable } from "@/components/tickets/ticket-table";
import { getTickets } from "@/lib/data";
import { isTicketOverdue } from "@/lib/utils";

export default async function OverduePage() {
  const tickets = (await getTickets(200)).filter(
    (ticket) => isTicketOverdue(ticket)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Overdue Monitoring</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manager view for aging requests that need follow-up.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
