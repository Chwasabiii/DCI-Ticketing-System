import { TicketTable } from "@/components/tickets/ticket-table";
import { getTickets } from "@/lib/data";

export default async function TicketsPage() {
  const tickets = await getTickets(100);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Tickets</h1>
        <p className="mt-2 text-sm text-slate-600">
          RLS limits this list to the requests this signed-in user can access.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
