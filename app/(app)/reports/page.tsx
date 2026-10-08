import { SimpleTable } from "@/components/admin/simple-table";
import { getTickets } from "@/lib/data";

export default async function ReportsPage() {
  const tickets = await getTickets(200);
  const statuses = ["open", "under_review", "assigned", "in_progress", "waiting_for_info", "resolved", "closed", "rejected"];
  const rows = statuses.map((status) => ({
    id: status,
    status,
    count: tickets.filter((ticket) => ticket.status === status).length
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <SimpleTable title="Ticket Status Report" rows={rows} columns={["status", "count"]} />
    </div>
  );
}
