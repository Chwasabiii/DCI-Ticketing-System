import { notFound } from "next/navigation";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentContext,
  getDisciplines,
  getProfiles,
  getTicket,
  getTicketComments
} from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default async function TicketDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [ticket, comments, context, disciplines, people] = await Promise.all([
    getTicket(params.id),
    getTicketComments(params.id),
    getCurrentContext(),
    getDisciplines(),
    getProfiles()
  ]);

  if (!ticket || !context.profile) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">
                {ticket.ticket_no ?? "Ticket"}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-navy">{ticket.title}</h1>
            </div>
            <div className="flex gap-2">
              <Badge value={ticket.status} />
              <Badge value={ticket.priority} />
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-y border-slate-100 py-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-500">Created</dt>
              <dd className="mt-1 text-slate-800">{formatDate(ticket.created_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Due</dt>
              <dd className="mt-1 text-slate-800">{formatDate(ticket.due_date)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Assigned</dt>
              <dd className="mt-1 text-slate-800">{ticket.assigned_to ?? "Unassigned"}</dd>
            </div>
          </dl>
          <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {ticket.description}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-navy">Timeline</h2>
          <div className="mt-5 space-y-4">
            {comments.length === 0 && (
              <p className="text-sm text-slate-500">No comments have been added yet.</p>
            )}
            {comments.map((comment) => (
              <article key={comment.id} className="border-l-2 border-blue-100 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {comment.author_id}
                  </p>
                  {comment.is_internal && <Badge value="internal" />}
                  <p className="text-xs text-slate-500">{formatDate(comment.created_at)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {comment.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <TicketActions
        ticket={ticket}
        profile={context.profile}
        roles={context.roleNames}
        disciplines={disciplines}
        people={people}
      />
    </div>
  );
}
