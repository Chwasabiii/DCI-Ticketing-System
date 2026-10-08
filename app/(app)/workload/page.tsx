import { SimpleTable } from "@/components/admin/simple-table";
import { getProfiles, getTickets } from "@/lib/data";

export default async function WorkloadPage() {
  const [people, tickets] = await Promise.all([getProfiles(), getTickets(200)]);
  const rows = people.map((person) => ({
    id: person.id,
    name: person.full_name ?? person.email,
    user_side: person.user_side,
    active_tickets: tickets.filter((ticket) => ticket.assigned_to === person.id).length,
    status: person.status
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <SimpleTable
        title="Workload"
        rows={rows}
        columns={["name", "user_side", "active_tickets", "status"]}
      />
    </div>
  );
}
