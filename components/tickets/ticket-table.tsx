import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No tickets are visible for this account yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50">
                <td className="max-w-sm px-4 py-4">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-semibold text-navy hover:text-accent"
                  >
                    {ticket.ticket_no ?? ticket.title}
                  </Link>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {ticket.ticket_no ? ticket.title : ticket.description}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Badge value={ticket.status} />
                </td>
                <td className="px-4 py-4">
                  <Badge value={ticket.priority} />
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {formatDate(ticket.due_date)}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {formatDate(ticket.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
