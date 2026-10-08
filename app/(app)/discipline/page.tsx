import { TicketTable } from "@/components/tickets/ticket-table";
import { getTickets } from "@/lib/data";

export default async function DisciplinePage() {
  const tickets = await getTickets(100);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Discipline Tickets</h1>
        <p className="mt-2 text-sm text-slate-600">
          Discipline lead view for reviewing requests and assigning work to team members.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
