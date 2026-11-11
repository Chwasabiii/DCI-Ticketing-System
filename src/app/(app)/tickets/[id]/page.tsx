import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, LockKeyhole, Paperclip } from "lucide-react";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { TicketQueueActions } from "@/components/tickets/ticket-queue-actions";
import { TicketPriorityReview } from "@/components/tickets/ticket-priority-review";
import { AttachmentUploader } from "@/components/tickets/attachment-uploader";
import { TicketActivityTimeline } from "@/components/tickets/ticket-activity-timeline";
import { RelatedTickets } from "@/components/tickets/related-tickets";
import { TicketSatisfactionSurvey } from "@/components/tickets/ticket-satisfaction-survey";
import { TicketFeedbackDisplay } from "@/components/tickets/ticket-feedback-display";
import { CcgTicketStatusBar } from "@/components/tickets/ccg-ticket-status-bar";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentContext,
  getAssignableEmployees,
  getCcgAssignableEmployees,
  getTicketAttachments,
  getTicket,
  getTicketFeedback,
  getTicketActivity,
  getRelatedTickets,
  getProfileSummary,
  getTicketSlaPolicies,
} from "@/lib/data";
import { formatDate, formatDateTime, getTicketResolutionDueLabel, needsTicketPriorityReview } from "@/lib/utils";

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return days ? `${days}d ${remainingHours}h` : `${hours}h`;
}

export default async function TicketDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const contextPromise = getCurrentContext();
  const ticketPromise = getTicket(id);
  const routeOptionsPromise = Promise.all([contextPromise, ticketPromise]).then(async ([{ profile, roleNames }, ticket]) => {
    const canRoute =
      profile?.user_side === "admin" ||
      roleNames.includes("Coordinator") ||
      profile?.service_team?.slug === "it-support";

    if (!canRoute || !ticket) return { people: [] };

    const people = ticket.ccg_request_type
      ? await getCcgAssignableEmployees(ticket.service_team_id)
      : await getAssignableEmployees(ticket.service_team_id);

    return { people };
  });

  const peoplePromise = ticketPromise.then(async (ticket) => {
    if (!ticket) return { requester: null, assignee: null };

    const [requester, assignee] = await Promise.all([
      ticket.requester_id ? getProfileSummary(ticket.requester_id, id) : null,
      ticket.assigned_to ? getProfileSummary(ticket.assigned_to, id) : null
    ]);

    return { requester, assignee };
  });
  const [ticket, people, activity, attachments, relatedTickets, context, routeOptions, feedback, slaPolicies] = await Promise.all([
    ticketPromise,
    peoplePromise,
    getTicketActivity(id),
    getTicketAttachments(id),
    getRelatedTickets(id),
    contextPromise,
    routeOptionsPromise,
    getTicketFeedback(id),
    getTicketSlaPolicies()
  ]);
  const resolvedEvent = [...activity].reverse().find((item) =>
    item.kind === "event" && item.event_type === "status_changed" && item.to_status === "resolved"
  );
  const resolvedBy = resolvedEvent?.kind === "event"
    ? resolvedEvent.actor?.full_name?.trim() || resolvedEvent.actor?.email || "Support team member"
    : null;
  const lastStaffActivity = [...activity].reverse().find((item) =>
    item.actor?.user_side === "employee" || item.actor?.user_side === "admin"
  );
  const lastWorkerName = lastStaffActivity?.actor?.full_name?.trim()
    || lastStaffActivity?.actor?.email
    || people.assignee?.full_name?.trim()
    || people.assignee?.email
    || "No staff activity yet";
  if (!ticket || !context.profile) notFound();

  const ccgRequestTypes = ticket.ccg_request_types?.length
    ? ticket.ccg_request_types
    : ticket.ccg_request_type ? [ticket.ccg_request_type] : [];
  const ccgRequestLabels = ccgRequestTypes.map((type) => ({
    unit_rate: "Unit rate",
    vendor_list: "Vendor list",
    tor_contracts: "TOR / contracts"
  }[type]));
  const ccgFollowupLabel = ccgRequestTypes.includes("unit_rate")
    && ticket.ccg_request_scope === "per_material"
    && ccgRequestTypes.includes("vendor_list")
    ? "Vendor quote and search"
    : ccgRequestTypes.includes("unit_rate") && ticket.ccg_request_scope === "per_material"
      ? "Vendor quote"
      : ccgRequestTypes.includes("vendor_list") ? "Vendor search" : "Vendor follow-up";

  const canSubmitResolution =
    context.profile.user_side === "admin" ||
    (context.profile.user_side === "employee" &&
      context.profile.service_team_id === ticket.service_team_id &&
      (context.roleNames.includes("Personnel") || context.roleNames.includes("Coordinator")) &&
      (!ticket.is_confidential || ticket.assigned_to === context.profile.id));
  const ticketIsActive = !["resolved", "closed", "rejected"].includes(ticket.status);
  const canReviewTicketPriority = context.profile.user_side === "employee"
    && Boolean(context.profile.service_team_id)
    && context.profile.service_team_id === ticket.service_team_id
    && context.roleNames.includes("Personnel")
    && !context.roleNames.includes("Coordinator")
    && ticketIsActive;
  const isCcgTicket = ticket.service_team?.slug === "cost-control" && Boolean(ticket.ccg_request_type);
  const canWorkCcgTicket = context.profile.user_side === "admin"
    || (context.profile.user_side === "employee"
      && context.profile.service_team_id === ticket.service_team_id
      && (context.roleNames.includes("Personnel") || context.roleNames.includes("Coordinator")));
  const ticketListHref = context.profile.user_side === "client" ? "/tickets" : "/inbox";
  const ticketListLabel = context.profile.user_side === "client" ? "Back to my tickets" : "Back to triage inbox";
  const canUseQuickActions = ticketIsActive && (
    (ticket.service_team?.slug === "it-support"
      && (context.profile.user_side === "admin"
        || (context.profile.user_side === "employee" && context.profile.service_team_id === ticket.service_team_id)))
    || (isCcgTicket && canWorkCcgTicket)
  );
  const canQuickAssign = context.profile.user_side === "admin"
    || (context.profile.user_side === "employee"
      && context.profile.service_team_id === ticket.service_team_id
      && !ticket.is_confidential
      && (context.profile.service_team?.slug === "it-support" || context.roleNames.includes("Coordinator")));
  const canQuickChangeStatus = context.profile.user_side === "admin"
    || (context.profile.user_side === "employee"
      && context.profile.service_team_id === ticket.service_team_id
      && (!ticket.is_confidential || ticket.assigned_to === context.profile.id)
      && (context.profile.service_team?.slug === "it-support"
        || context.roleNames.includes("Personnel")
        || context.roleNames.includes("Coordinator")));

  const canViewTicketActions = context.profile.user_side === "admin"
    || (context.profile.user_side === "employee"
      && context.profile.service_team_id === ticket.service_team_id
      && (context.roleNames.includes("Personnel") || context.roleNames.includes("Coordinator")))
    || (context.profile.user_side === "employee"
      && context.profile.service_team_id === ticket.service_team_id
      && context.roleNames.includes("Personnel")
      && !context.roleNames.includes("Coordinator")
      && !["resolved", "closed", "rejected"].includes(ticket.status))
    || (context.profile.user_side === "client"
      && ticket.requester_id === context.profile.id
      && ["resolved", "closed"].includes(ticket.status))
    || (!ticket.is_confidential
      && ["resolved", "closed"].includes(ticket.status)
      && Boolean(ticket.resolution_notes?.trim())
      && (context.profile.user_side === "employee"
          && context.profile.service_team_id === ticket.service_team_id
          && ["it-support", "cost-control", "software-csr"].includes(context.profile.service_team?.slug ?? "")));

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link
        href={ticketListHref}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        {ticketListLabel}
      </Link>
      <div className="grid grid-cols-1 items-start gap-6">
      <section className="space-y-5">
        {isCcgTicket && <CcgTicketStatusBar ticket={ticket} />}
        <div className={`grid items-stretch gap-5 ${canViewTicketActions || canUseQuickActions ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
        <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,40,75,0.06)]">
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
              {ticket.request_type && (
                <Badge value={ticket.request_type === "general" ? "service_request" : ticket.request_type} />
              )}
              {ticket.service_category && <Badge value={ticket.service_category} />}
              <Badge value={ticket.status} />
              <Badge value={ticket.priority} />
            </div>
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Created", formatDateTime(ticket.created_at)],
              ["Requested by", people.requester?.full_name ?? people.requester?.email ?? "Not available"],
              ["Service team", ticket.service_team?.name ?? "Unassigned"],
              ["Reported impact / urgency", ticket.reported_impact && ticket.reported_urgency ? `${ticket.reported_impact} impact · ${ticket.reported_urgency} urgency` : "Not recorded"],
              ["Priority review", needsTicketPriorityReview(ticket) ? "Pending service team review" : ticket.priority_reviewed_at ? "Reviewed by service team" : "No elevated rating to review"],
              ["Resolution target", getTicketResolutionDueLabel(ticket, slaPolicies)],
              ["Last worked by", lastWorkerName]
            ].map(([label, value]) => (
              <div key={label} className="min-h-[76px] rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 px-3.5 py-3 shadow-sm">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                <dd className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          {ticket.ccg_request_type && (
            <section className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">CCG request workflow</h2>
              <p className="mt-2 text-sm font-semibold text-navy">
                {ccgRequestLabels.join(" + ")}
                {ticket.ccg_request_scope ? ` · ${ticket.ccg_request_scope === "whole_boq" ? "Whole BOQ" : "Per material / system"}` : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {ccgRequestTypes.length > 1
                  ? "CCG will use one shared database result and complete any required vendor follow-up for the selected services."
                  : ticket.ccg_request_type === "unit_rate"
                  ? ticket.ccg_request_scope === "whole_boq"
                    ? "CCG reviews and submits a whole BOQ request within 24 hours. Per-material requests are checked against the database; if unavailable, vendor quotation may take 3–6 weeks."
                    : "CCG checks the material against the database. Available rates are submitted within 24 hours; if unavailable, CCG requests a vendor quotation, which may take 3–6 weeks."
                  : ticket.ccg_request_type === "vendor_list"
                    ? "If the vendor list is in the database, CCG submits it within 24 hours. Otherwise CCG searches for vendors and contact details, targeting 3–5 working days."
                    : "CCG checks whether a TOR / contracts sample is in the database. Available references are submitted within 24 hours; if none is available, the requester is notified."}
              </p>
              {ticket.ccg_database_result && <p className="mt-2 text-xs font-semibold text-emerald-900">Database result: {ticket.ccg_database_result === "not_required" ? "not required for a whole BOQ" : ticket.ccg_database_result}</p>}
              {ticket.ccg_followup_type && <p className="mt-1 text-xs font-semibold text-emerald-900">{ccgFollowupLabel}: {(ticket.ccg_followup_status ?? "pending").replaceAll("_", " ")}</p>}
              <div className="mt-3 grid gap-2 rounded-lg border border-emerald-100 bg-white/80 p-3 text-xs sm:grid-cols-2">
                <p><span className="font-bold text-slate-700">CCG service target: </span>{getTicketResolutionDueLabel(ticket, slaPolicies)}</p>
                {ticket.ccg_vendor_expected_at && <p><span className="font-bold text-slate-700">Vendor expected in: </span>{getTicketResolutionDueLabel({ ...ticket, ccg_stage_due_at: ticket.ccg_vendor_expected_at }, slaPolicies)}</p>}
                {ticket.ccg_vendor_due_at && <p><span className="font-bold text-slate-700">Vendor target limit: </span>{getTicketResolutionDueLabel({ ...ticket, ccg_stage_due_at: ticket.ccg_vendor_due_at }, slaPolicies)} (CCG clock paused)</p>}
                {ticket.ccg_vendor_wait_started_at && <p className="text-amber-800"><span className="font-bold">Waiting on vendor since: </span>{formatDateTime(ticket.ccg_vendor_wait_started_at)}</p>}
                {(ticket.ccg_vendor_wait_seconds ?? 0) > 0 && <p><span className="font-bold text-slate-700">Recorded vendor wait: </span>{formatElapsed(ticket.ccg_vendor_wait_seconds ?? 0)}</p>}
              </div>
              {context.profile.user_side !== "client" && <p className="mt-2 text-xs leading-5 text-emerald-900">Acknowledge and review the ticket first. Record the database check, vendor quotation or unavailable reference in the resolution summary before submitting the response. The requester confirms receipt by closing the resolved ticket.</p>}
              <p className="mt-2 text-xs leading-5 text-slate-500">PMG requests with Procurement in scope are excluded. CCG cannot guarantee a vendor’s responsiveness or suitability for the work’s scope and complexity.</p>
            </section>
          )}
          <div className="mt-7 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <FileText className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-[0.12em]">Request details</h2>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {ticket.description}
            </p>
          </div>
          {ticket.resolution_notes && (
            <div className="mt-4 rounded-xl border border-green-100 bg-green-50/60 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-green-800">
                <FileText className="h-4 w-4" />
                <h2 className="text-xs font-bold uppercase tracking-[0.12em]">
                  {ticket.request_type === "incident_report" ? "Inspection and root cause findings" : "Resolution summary"}
                </h2>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{ticket.resolution_notes}</p>
            </div>
          )}
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
                      <a href={attachment.signed_url} className="truncate text-sm font-semibold text-accent hover:underline">
                        {attachment.file_name}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-500">{attachment.file_name} (temporarily unavailable)</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <AttachmentUploader ticketId={String(ticket.id)} userId={context.profile.id} />
          </section>
        </div>
        </div>
        {(canUseQuickActions || canViewTicketActions) && <aside className="h-full space-y-5 xl:sticky xl:top-5">
          {canUseQuickActions && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,40,75,0.08)]">
            <div className="h-1.5 bg-gradient-to-r from-accent via-blue-400 to-indigo-300" />
            <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Ticket workspace</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Manage request</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{isCcgTicket ? "Review the CCG request, record its database and vendor decisions, and prepare the response." : "Assign ownership, move the request forward, and send the completed response."}</p>
            </div>
            {isCcgTicket ? (
              <>
                <TicketQueueActions
                  ticket={ticket}
                  employees={routeOptions.people}
                  canAssign={false}
                  canChangeStatus={false}
                  canClaim={context.profile.user_side === "employee"
                    && context.profile.service_team_id === ticket.service_team_id
                    && (context.roleNames.includes("Personnel") || context.roleNames.includes("Coordinator"))}
                  currentUserId={context.profile.id}
                  slaPolicies={slaPolicies}
                  variant="panel"
                  claimOnly
                />
                {canViewTicketActions && <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                  <TicketActions
                    key={`${ticket.id}-${ticket.updated_at ?? ""}`}
                    ticket={ticket}
                    profile={context.profile}
                    roles={context.roleNames}
                    people={routeOptions.people}
                    resolvedBy={resolvedBy}
                    workspace
                  />
                </div>}
              </>
            ) : (
              <>
                <TicketQueueActions
                  ticket={ticket}
                  employees={routeOptions.people}
                  canAssign={canQuickAssign}
                  canChangeStatus={canQuickChangeStatus}
                  canClaim={context.profile.user_side === "employee" && context.profile.service_team_id === ticket.service_team_id}
                  currentUserId={context.profile.id}
                  slaPolicies={slaPolicies}
                  variant="panel"
                />
                {canViewTicketActions && <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                  <TicketActions
                    key={`${ticket.id}-${ticket.updated_at ?? ""}`}
                    ticket={ticket}
                    profile={context.profile}
                    roles={context.roleNames}
                    people={routeOptions.people}
                    resolvedBy={resolvedBy}
                    compact
                  />
                </div>}
              </>
            )}
          </div>}
          {canViewTicketActions && !canUseQuickActions && <TicketActions
            key={`${ticket.id}-${ticket.updated_at ?? ""}`}
            ticket={ticket}
            profile={context.profile}
            roles={context.roleNames}
            people={routeOptions.people}
            resolvedBy={resolvedBy}
          />}
          {canReviewTicketPriority && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(20,40,75,0.06)] sm:p-5">
            <TicketPriorityReview ticket={ticket} />
          </section>}
        </aside>}
        </div>

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
          canComment={ticketIsActive}
          canSubmitResolution={canSubmitResolution && ticketIsActive}
          isIncidentReport={ticket.request_type === "incident_report"}
          actions={null}
        />
        {context.profile.user_side === "client" && ticket.requester_id === context.profile.id && ["resolved", "closed"].includes(ticket.status) && (
          <TicketSatisfactionSurvey ticketId={String(ticket.id)} feedback={feedback} />
        )}
        {(context.profile.user_side === "employee" || context.profile.user_side === "admin")
          && ["resolved", "closed"].includes(ticket.status) && (
            <TicketFeedbackDisplay feedback={feedback} />
          )}
      </section>
      </div>
    </div>
  );
}
