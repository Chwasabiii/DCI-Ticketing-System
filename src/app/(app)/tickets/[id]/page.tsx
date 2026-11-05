import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, LockKeyhole, Paperclip } from "lucide-react";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { AttachmentUploader } from "@/components/tickets/attachment-uploader";
import { TicketActivityTimeline } from "@/components/tickets/ticket-activity-timeline";
import { TicketHandoffForm } from "@/components/tickets/ticket-handoff-form";
import { ProjectApprovalActions } from "@/components/tickets/project-approval-actions";
import { RelatedTickets } from "@/components/tickets/related-tickets";
import { TicketSatisfactionSurvey } from "@/components/tickets/ticket-satisfaction-survey";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentContext,
  getDisciplines,
  getAssignableEmployees,
  getTicketAttachments,
  getTicket,
  getTicketFeedback,
  getTicketActivity,
  getRelatedTickets,
  getProfileSummary,
  canApproveTicket
} from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function TicketDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

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

  const ticketPromise = getTicket(id);
  const peoplePromise = ticketPromise.then(async (ticket) => {
    if (!ticket) return { requester: null, assignee: null };

    const [requester, assignee] = await Promise.all([
      ticket.requester_id ? getProfileSummary(ticket.requester_id, id) : null,
      ticket.assigned_to ? getProfileSummary(ticket.assigned_to, id) : null
    ]);

    return { requester, assignee };
  });
  const approvalAccessPromise = ticketPromise.then((ticket) =>
    ticket?.approval_status === "pending"
      ? canApproveTicket(id)
      : Promise.resolve(false)
  );

  const [ticket, people, activity, attachments, relatedTickets, context, routeOptions, canApprove, feedback] = await Promise.all([
    ticketPromise,
    peoplePromise,
    getTicketActivity(id),
    getTicketAttachments(id),
    getRelatedTickets(id),
    contextPromise,
    routeOptionsPromise,
    approvalAccessPromise,
    getTicketFeedback(id)
  ]);

  if (!ticket || !context.profile) notFound();

  const showHandoff =
    (context.profile.user_side === "admin" || context.roleNames.some((role) => ["Coordinator", "Discipline Lead"].includes(role))) &&
    !["resolved", "closed", "rejected"].includes(ticket.status);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>
      <div className={`grid items-start gap-6 ${showHandoff ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"}`}>
      <section className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,40,75,0.06)]">
          <div className="h-1.5 bg-gradient-to-r from-accent via-blue-400 to-indigo-300" />
          <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-accent">
                  {ticket.ticket_no ?? `Ticket #${ticket.id}`}
                </span>
                {ticket.is_confidential && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    <LockKeyhole className="h-3 w-3" /> Confidential
                  </span>
                )}
              </div>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-navy sm:text-3xl">{ticket.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {ticket.request_type && ticket.request_type !== "general" && (
                <Badge value={ticket.request_type} />
              )}
              <Badge value={ticket.status} />
              <Badge value={ticket.priority} />
            </div>
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Created", formatDateTime(ticket.created_at)],
              ["Requested by", people.requester?.full_name ?? people.requester?.email ?? "Not available"],
              ["Department", ticket.department?.name ?? "Not specified"],
              ["Project", ticket.project?.name ?? "Not specified"],
              ["Project approval", ticket.approval_status === "not_required" ? "Not required" : ticket.approval_status ?? "Not set"],
              ["Due date", formatDate(ticket.due_date)],
              ["Assigned to", people.assignee?.full_name ?? people.assignee?.email ?? "Unassigned"]
            ].map(([label, value]) => (
              <div key={label} className="min-h-[76px] rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 px-3.5 py-3 shadow-sm">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                <dd className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-7 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <FileText className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-[0.12em]">Request details</h2>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {ticket.description}
            </p>
          </div>
          {ticket.approval_status === "rejected" && ticket.approval_comment && (
            <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              <span className="font-semibold">Reason for rejection:</span>{" "}
              {ticket.approval_comment}
            </p>
          )}
          {ticket.approval_status === "pending" && !canApprove && (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              This project-linked request is waiting for approval from its PM or a designated project approver.
            </p>
          )}
          {canApprove && ticket.approval_status === "pending" && (
            <div className="mt-4">
              <ProjectApprovalActions ticketId={String(ticket.id)} />
            </div>
          )}
        </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(20,40,75,0.06)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Paperclip className="h-5 w-5" /></span>
              <div><h2 className="text-base font-bold text-navy">Attachments</h2><p className="mt-0.5 text-xs text-slate-500">Files shared with this request</p></div>
            </div>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{attachments.length}</span>
          </div>
          {attachments.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
              <p className="text-sm font-medium text-slate-600">No files attached yet</p>
              <p className="mt-1 text-xs text-slate-500">Add a document or image if it helps explain the request.</p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                  <Paperclip aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                  {attachment.signed_url ? (
                    <a
                      href={attachment.signed_url}
                      className="truncate text-sm font-semibold text-accent hover:underline"
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

        <RelatedTickets
          ticketId={String(ticket.id)}
          tickets={relatedTickets}
          canManage={context.profile.user_side === "employee" || context.profile.user_side === "admin"}
        />

        <TicketActivityTimeline
          key={String(ticket.id)}
          ticketId={String(ticket.id)}
          initialActivity={activity}
          currentUserId={context.profile.id}
          allowInternalNotes={context.profile.user_side !== "client"}
          actions={(
            <TicketActions
              key={`${ticket.id}-${ticket.updated_at ?? ""}`}
              ticket={ticket}
              profile={context.profile}
              roles={context.roleNames}
              disciplines={routeOptions.disciplines}
              people={routeOptions.people}
            />
          )}
        />
        {context.profile.user_side === "client" && ticket.requester_id === context.profile.id && ["resolved", "closed"].includes(ticket.status) && (
          <TicketSatisfactionSurvey ticketId={String(ticket.id)} feedback={feedback} />
        )}
      </section>
      {showHandoff && <TicketHandoffForm ticketId={String(ticket.id)} employees={routeOptions.people} />}
      </div>
    </div>
  );
}
