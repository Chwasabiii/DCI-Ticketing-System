import { notFound } from "next/navigation";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { AttachmentUploader } from "@/components/tickets/attachment-uploader";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentContext,
  getDisciplines,
  getAssignableEmployees,
  getTicketAttachments,
  getTicket,
  getTicketComments,
  getProfileSummary
} from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default async function TicketDetailPage({
  params
}: {
  params: { id: string };
}) {
  const contextPromise = getCurrentContext();
  const routeOptionsPromise = contextPromise.then(async ({ profile, roleNames }) => {
    const canRoute =
      profile?.user_side === "admin" ||
      roleNames.includes("Coordinator") ||
      roleNames.includes("Discipline Lead");

    if (!canRoute) return { disciplines: [], people: [] };

    const [disciplines, people] = await Promise.all([
      getDisciplines(),
      getAssignableEmployees()
    ]);

    return { disciplines, people };
  });

  const ticketPromise = getTicket(params.id);
  const peoplePromise = ticketPromise.then(async (ticket) => {
    if (!ticket) return { requester: null, assignee: null };

    const [requester, assignee] = await Promise.all([
      ticket.requester_id ? getProfileSummary(ticket.requester_id) : null,
      ticket.assigned_to ? getProfileSummary(ticket.assigned_to) : null
    ]);

    return { requester, assignee };
  });

  const [ticket, people, comments, attachments, context, routeOptions] = await Promise.all([
    ticketPromise,
    peoplePromise,
    getTicketComments(params.id),
    getTicketAttachments(params.id),
    contextPromise,
    routeOptionsPromise
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
          <dl className="mt-6 grid gap-4 border-y border-slate-100 py-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-500">Created</dt>
              <dd className="mt-1 text-slate-800">{formatDate(ticket.created_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Requested by</dt>
              <dd className="mt-1 text-slate-800">
                {people.requester?.full_name ?? people.requester?.email ?? "Not available"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Department</dt>
              <dd className="mt-1 text-slate-800">{ticket.department?.name ?? "Not specified"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Project</dt>
              <dd className="mt-1 text-slate-800">{ticket.project?.name ?? "Not specified"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Due</dt>
              <dd className="mt-1 text-slate-800">{formatDate(ticket.due_date)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Assigned</dt>
              <dd className="mt-1 text-slate-800">
                {people.assignee?.full_name ?? people.assignee?.email ?? "Unassigned"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {ticket.description}
          </p>
        </div>

        <section className="rounded-lg bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-navy">Attachments</h2>
          {attachments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No files have been attached yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="py-3 first:pt-0 last:pb-0">
                  {attachment.signed_url ? (
                    <a
                      href={attachment.signed_url}
                      className="text-sm font-semibold text-accent hover:underline"
                    >
                      {attachment.file_name}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {attachment.file_name} (temporarily unavailable)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <AttachmentUploader
            ticketId={String(ticket.id)}
            userId={context.profile.id}
          />
        </section>

        <TicketComments
          key={String(ticket.id)}
          ticketId={String(ticket.id)}
          initialComments={comments}
        />
      </section>
      <TicketActions
        key={`${ticket.id}-${ticket.updated_at ?? ""}`}
        ticket={ticket}
        profile={context.profile}
        roles={context.roleNames}
        disciplines={routeOptions.disciplines}
        people={routeOptions.people}
      />
    </div>
  );
}
