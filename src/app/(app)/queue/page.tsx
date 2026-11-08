import { TicketTable } from "@/components/tickets/ticket-table";
import { getTicketSlaPolicies, getTickets } from "@/lib/data";

export default async function QueuePage() {
  const [allTickets, slaPolicies] = await Promise.all([getTickets(100), getTicketSlaPolicies()]);
  const tickets = allTickets.filter((ticket) =>
    ["open", "under_review"].includes(ticket.status)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Incoming Queue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review new requests, set priority, and assign an active employee.
        </p>
      </div>
      <TicketTable tickets={tickets} slaPolicies={slaPolicies} />
    </div>
  );
}
