import { TicketTable } from "@/components/tickets/ticket-table";
import { getTickets } from "@/lib/data";

export default async function QueuePage() {
  const tickets = (await getTickets(100)).filter((ticket) =>
    ["open", "under_review"].includes(ticket.status) &&
    !["pending", "rejected"].includes(ticket.approval_status ?? "")
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Incoming Queue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review new requests, set priority, assign an active employee, and route work to a discipline.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
