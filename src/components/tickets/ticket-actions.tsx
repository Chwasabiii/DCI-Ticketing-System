"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Forward, RotateCcw, Route, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { PriorityMatrixGuide } from "@/components/tickets/priority-matrix-guide";
import { createFaqDraftFromTicket, escalateIncidentToSoftwareCsr, reviewTicketPriority, routeTicket, updateTicketStatus } from "@/lib/actions";
import { calculateTicketPriority, needsTicketPriorityReview } from "@/lib/utils";
import type { EmployeeRole, Profile, Ticket, TicketImpact, TicketStatus, TicketUrgency } from "@/lib/types";

const ticketStatuses: TicketStatus[] = [
  "open",
  "under_review",
  "assigned",
  "in_progress",
  "waiting_for_info",
  "resolved",
  "closed",
  "rejected"
];

export function TicketActions({
  ticket,
  profile,
  roles,
  people
}: {
  ticket: Ticket;
  profile: Profile;
  roles: EmployeeRole[];
  people: Profile[];
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [routing, setRouting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus>(ticket.status as TicketStatus);
  const [routingMessage, setRoutingMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [routingFailed, setRoutingFailed] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const [impact, setImpact] = useState<TicketImpact>(ticket.impact ?? "medium");
  const [urgency, setUrgency] = useState<TicketUrgency>(ticket.urgency ?? "medium");
  const [reviewImpact, setReviewImpact] = useState<TicketImpact>(ticket.impact ?? "medium");
  const [reviewUrgency, setReviewUrgency] = useState<TicketUrgency>(ticket.urgency ?? "medium");
  const [priorityReviewMessage, setPriorityReviewMessage] = useState<string | null>(null);
  const [priorityReviewFailed, setPriorityReviewFailed] = useState(false);
  const [reviewingPriority, setReviewingPriority] = useState(false);
  const [creatingFaq, setCreatingFaq] = useState(false);
  const [faqMessage, setFaqMessage] = useState<string | null>(null);
  const [faqError, setFaqError] = useState(false);
  const calculatedPriority = calculateTicketPriority(impact, urgency);
  const canRoute =
    profile.user_side === "admin" ||
    roles.includes("Coordinator");
  const canResolve = profile.user_side === "admin"
    || (profile.user_side === "employee"
      && profile.service_team_id === ticket.service_team_id
      && (roles.includes("Personnel") || roles.includes("Coordinator")));
  const canReviewPriority = profile.user_side === "employee"
    && Boolean(profile.service_team_id)
    && profile.service_team_id === ticket.service_team_id
    && roles.includes("Personnel")
    && !canRoute
    && !["resolved", "closed", "rejected"].includes(ticket.status);
  const canCreateFaqDraft = !ticket.is_confidential
    && ["resolved", "closed"].includes(ticket.status)
    && Boolean(ticket.resolution_notes?.trim())
    && (profile.user_side === "admin"
      || (profile.user_side === "employee"
        && profile.service_team_id === ticket.service_team_id
        && ["it-support", "cost-control", "software-csr"].includes(profile.service_team?.slug ?? "")));
  const canEscalateToSoftwareCsr = profile.user_side === "employee"
    && profile.service_team?.slug === "it-support"
    && roles.includes("Personnel")
    && ticket.request_type === "incident_report"
    && ticket.service_category === "software"
    && ticket.status === "in_progress";
  const isClient = profile.user_side === "client";
  const isRequester = ticket.requester_id === profile.id;
  const editableStatuses = canResolve
    ? ticketStatuses
    : ticketStatuses.filter((status) => !["resolved", "closed", "rejected"].includes(status));
  const routingStatus = ["open", "under_review"].includes(ticket.status)
    ? "assigned"
    : ticket.status;

  const canReopen = isClient && isRequester && ["resolved", "closed"].includes(ticket.status);
  if (!canRoute && !canResolve && !(isClient && isRequester && ticket.status === "resolved") && !canReopen && !canCreateFaqDraft) {
    return null;
  }

  async function handleRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (routing) return;

    setRouting(true);
    setRoutingMessage(null);
    setRoutingFailed(false);
    try {
      const result = await routeTicket(new FormData(event.currentTarget));
      if ("error" in result) {
        setRoutingFailed(true);
        setRoutingMessage(result.error ?? "The routing changes could not be saved.");
        return;
      }

      setRoutingMessage(result.success ?? "Routing changes saved.");
      router.refresh();
    } catch {
      setRoutingMessage("The routing changes could not be saved. Please try again.");
    } finally {
      setRouting(false);
    }
  }

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updatingStatus) return;

    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submittingResolution = submitter?.name === "resolve_ticket";
    const nextStatus = submittingResolution ? "resolved" : String(formData.get("status") ?? "");
    if (submittingResolution) formData.set("status", "resolved");
    if (["resolved", "closed", "rejected"].includes(nextStatus) && nextStatus !== ticket.status) {
      const label = nextStatus.replaceAll("_", " ");
      if (!await confirm({ title: `Mark ticket as ${label}?`, description: "This change will be visible to the requester and assigned staff.", confirmLabel: `Mark ${label}`, danger: nextStatus === "rejected" })) return;
    }

    setUpdatingStatus(true);
    setStatusMessage(null);
    setStatusFailed(false);
    try {
      const result = await updateTicketStatus(formData);
      if ("error" in result) {
        setStatusFailed(true);
        setStatusMessage(result.error ?? "The ticket status could not be updated.");
        return;
      }

      setStatusMessage(result.success ?? "Ticket status updated.");
      router.refresh();
    } catch {
      setStatusMessage("The ticket status could not be updated. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSoftwareCsrEscalation() {
    if (updatingStatus) return;
    if (!await confirm({
      title: "Escalate to Software CSR?",
      description: "The Software CSR team will take over this software incident and its investigation notes.",
      confirmLabel: "Escalate incident"
    })) return;

    const formData = new FormData();
    formData.set("ticket_id", String(ticket.id));
    setUpdatingStatus(true);
    setStatusMessage(null);
    setStatusFailed(false);
    try {
      const result = await escalateIncidentToSoftwareCsr(formData);
      if ("error" in result) {
        setStatusFailed(true);
        setStatusMessage(result.error ?? "The incident could not be escalated.");
        return;
      }
      setStatusMessage(result.success ?? "Incident escalated to Software CSR.");
      router.refresh();
    } catch {
      setStatusFailed(true);
      setStatusMessage("The incident could not be escalated. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handlePriorityReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewingPriority) return;
    setReviewingPriority(true);
    setPriorityReviewMessage(null);
    setPriorityReviewFailed(false);
    try {
      const result = await reviewTicketPriority(new FormData(event.currentTarget));
      if ("error" in result) {
        setPriorityReviewFailed(true);
        setPriorityReviewMessage(result.error ?? "Priority review could not be saved.");
        return;
      }
      setPriorityReviewMessage(result.success ?? "Priority review saved.");
      router.refresh();
    } catch {
      setPriorityReviewFailed(true);
      setPriorityReviewMessage("Priority review could not be saved. Please try again.");
    } finally {
      setReviewingPriority(false);
    }
  }

  async function handleCreateFaqDraft() {
    if (creatingFaq) return;
    setCreatingFaq(true);
    setFaqMessage(null);
    setFaqError(false);
    const formData = new FormData();
    formData.set("ticket_id", String(ticket.id));
    try {
      const result = await createFaqDraftFromTicket(formData);
      if ("error" in result) {
        setFaqError(true);
        setFaqMessage(result.error ?? "FAQ draft could not be created.");
        return;
      }
      setFaqMessage(result.success ?? "Unpublished FAQ draft created.");
      router.refresh();
    } catch {
      setFaqError(true);
      setFaqMessage("FAQ draft could not be created. Please try again.");
    } finally {
      setCreatingFaq(false);
    }
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_100px_rgba(20,40,75,0.06)]">
      <div className="h-1.5 bg-gradient-to-r from-accent via-blue-400 to-indigo-300" />
      {confirmDialog}
      <div className="p-5 sm:p-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-navy">Handle this request</h2>
          <Badge value={ticket.status} />
        </div>
        {profile.user_side === "employee" && profile.service_team?.slug === "cost-control" && ticket.ccg_request_type && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-5 text-emerald-950">
            <p className="font-bold">CCG process</p>
            <ol className="mt-1 list-inside list-decimal space-y-1">
              <li>Acknowledge and check the request within 24 hours.</li>
              <li>{ticket.ccg_request_type === "unit_rate"
                ? ticket.ccg_request_scope === "whole_boq"
                  ? "Submit the whole BOQ within 24 hours."
                  : "Check the material database; submit available rates within 24 hours or request a vendor quote (3–6 weeks) if unavailable."
                : ticket.ccg_request_type === "vendor_list"
                  ? "Submit a database match within 24 hours; otherwise search and respond within 3–5 working days."
                  : "Submit an available TOR / contract reference within 24 hours, or notify the requester if none is available."}</li>
              <li>Record the database check and response in the resolution summary; the requester confirms receipt by closing.</li>
            </ol>
          </div>
        )}
        <div className="grid gap-2">
          {canCreateFaqDraft && (
            <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div>
                <h3 className="text-sm font-bold text-navy">Share this solution with the team</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Create an unpublished FAQ draft from this ticket’s title and resolution. Review and edit it before publishing.</p>
              </div>
              {faqMessage && <p role={faqError ? "alert" : "status"} className={`text-sm ${faqError ? "text-red-700" : "text-resolved"}`}>{faqMessage}</p>}
              {faqMessage && !faqError && <a href="/admin/faqs" className="w-fit text-xs font-semibold text-accent hover:underline">Open FAQ management</a>}
              <Button type="button" variant="secondary" loading={creatingFaq} onClick={() => void handleCreateFaqDraft()}>
                <BookOpen className="h-4 w-4" />
                {creatingFaq ? "Creating draft..." : "Create FAQ draft"}
              </Button>
            </div>
          )}
          {canReviewPriority && (
            <form onSubmit={handlePriorityReview} className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <div>
                <h3 className="text-sm font-bold text-navy">Review impact and urgency</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {needsTicketPriorityReview(ticket)
                    ? `Requester reported ${ticket.reported_impact} impact and ${ticket.reported_urgency} urgency. High ratings are held at Medium until reviewed.`
                    : "Confirm or adjust the requester’s impact and urgency to set the ticket’s service level."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Confirmed impact
                  <select name="impact" value={reviewImpact} onChange={(event) => setReviewImpact(event.target.value as TicketImpact)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring">
                    <option value="low">Low — limited impact / workaround available</option><option value="medium">Medium — team or important task affected</option><option value="high">High — critical service or many users affected</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Confirmed urgency
                  <select name="urgency" value={reviewUrgency} onChange={(event) => setReviewUrgency(event.target.value as TicketUrgency)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring">
                    <option value="low">Low — can be scheduled</option><option value="medium">Medium — needs attention soon</option><option value="high">High — work or service is blocked</option>
                  </select>
                </label>
              </div>
              <p className="rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700">Confirmed priority: <strong className="capitalize">{calculateTicketPriority(reviewImpact, reviewUrgency)}</strong></p>
              {priorityReviewMessage && <p role={priorityReviewFailed ? "alert" : "status"} className={`text-sm ${priorityReviewFailed ? "text-red-700" : "text-resolved"}`}>{priorityReviewMessage}</p>}
              <Button type="submit" variant="secondary" loading={reviewingPriority}><Save className="h-4 w-4" />Save priority review</Button>
            </form>
          )}
          {canRoute && (
            <form onSubmit={handleRoute} className="grid gap-3 border-b border-slate-100 pb-4">
              <p className="text-xs leading-5 text-slate-600">
                Review the request, set its priority, and assign an active employee.
              </p>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Assign to
                <select
                  name="assigned_to"
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  defaultValue={ticket.assigned_to ?? ""}
                >
                  <option value="">Leave unassigned</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name ?? person.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Impact
                  <select name="impact" value={impact} onChange={(event) => setImpact(event.target.value as TicketImpact)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring">
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Urgency
                  <select name="urgency" value={urgency} onChange={(event) => setUrgency(event.target.value as TicketUrgency)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring">
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </label>
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:col-span-2">Priority matrix result: <strong className="capitalize">{calculatedPriority}</strong></p>
                <div className="sm:col-span-2"><PriorityMatrixGuide /></div>
              </div>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Due date
                <input
                  name="due_date"
                  type="date"
                  defaultValue={ticket.due_date ?? ""}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                />
              </label>
              <input type="hidden" name="status" value={routingStatus} />
              {routingMessage && (
                <p role={routingFailed ? "alert" : "status"} className={`text-sm ${routingFailed ? "text-red-700" : "text-resolved"}`}>{routingMessage}</p>
              )}
              <Button type="submit" variant="secondary" loading={routing}>
                <Route className="h-4 w-4" />
                {routing ? "Saving..." : "Save assignment"}
              </Button>
            </form>
          )}
          {(canRoute || canResolve) && (
            <form onSubmit={handleStatusUpdate} className="grid gap-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Work status
                <select
                  name="status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                >
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {ticket.request_type === "incident_report" && status === "under_review"
                        ? "IT inspection"
                        : ticket.request_type === "incident_report" && status === "in_progress"
                          ? "Root cause analysis"
                          : status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              {canResolve && (
                ticket.ccg_request_type && !(ticket.ccg_request_type === "unit_rate" && ticket.ccg_request_scope === "whole_boq") && (
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Database check
                    <select name="ccg_database_result" required={nextStatus === "resolved"} defaultValue="" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring">
                      <option value="">Choose when submitting the CCG response</option>
                      <option value="available">Available in the database</option>
                      <option value="unavailable">Not available in the database</option>
                    </select>
                  </label>
                )
              )}
              {canResolve && (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  {ticket.request_type === "incident_report" ? "Inspection and root cause findings" : "Resolution summary"}
                  <textarea
                    name="resolution_notes"
                    rows={3}
                    required={ticket.request_type === "incident_report" && nextStatus === "resolved"}
                    defaultValue={ticket.resolution_notes ?? ""}
                    placeholder={ticket.request_type === "incident_report"
                      ? "Document the investigation, root cause, and corrective action before resolving."
                      : "Record what was done before marking resolved."}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  />
                </label>
              )}
              {statusMessage && (
                <p role={statusFailed ? "alert" : "status"} className={`text-sm ${statusFailed ? "text-red-700" : "text-resolved"}`}>{statusMessage}</p>
              )}
              <Button type="submit" loading={updatingStatus}>
                <Save className="h-4 w-4" />
                {updatingStatus
                  ? "Updating..."
                  : ticket.request_type === "incident_report" && ticket.status === "in_progress"
                    ? "Save investigation notes"
                    : "Update status"}
              </Button>
              {canResolve && !["resolved", "closed", "rejected"].includes(ticket.status) && (
                <Button type="submit" name="resolve_ticket" value="true" loading={updatingStatus}>
                  <CheckCircle2 className="h-4 w-4" />
                  {updatingStatus ? "Submitting resolution..." : "Submit resolution"}
                </Button>
              )}
            </form>
          )}
          {canEscalateToSoftwareCsr && (
            <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div>
                <p className="text-sm font-semibold text-navy">Still unresolved after root cause analysis?</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Save the investigation findings above, then send the incident to Software CSR.</p>
              </div>
              <Button type="button" variant="secondary" loading={updatingStatus} onClick={() => void handleSoftwareCsrEscalation()}>
                <Forward className="h-4 w-4" />
                {updatingStatus ? "Escalating..." : "Escalate to Software CSR"}
              </Button>
              {statusMessage && (
                <p role={statusFailed ? "alert" : "status"} className={`text-sm ${statusFailed ? "text-red-700" : "text-resolved"}`}>{statusMessage}</p>
              )}
            </div>
          )}
          {isClient && isRequester && ticket.status === "resolved" && (
            <form onSubmit={handleStatusUpdate} className="grid">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit" loading={updatingStatus} className="w-full">
                <CheckCircle2 className="h-4 w-4" />
                Confirm completion
              </Button>
            </form>
          )}
          {canReopen && (
            <form onSubmit={handleStatusUpdate} className="grid gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="open" />
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-navy">Still having this problem?</p>
                <p className="text-xs leading-5 text-slate-600">Tell us what still needs attention and we’ll reopen your request.</p>
              </div>
              <label className="sr-only" htmlFor={`reopen-reason-${ticket.id}`}>Tell us what still needs attention</label>
              <textarea
                id={`reopen-reason-${ticket.id}`}
                name="reopen_reason"
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                placeholder="Describe what is still not working or what needs follow-up."
                className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-5 placeholder:text-slate-400 focus-ring"
              />
              <Button type="submit" variant="secondary" loading={updatingStatus} className="w-full">
                <RotateCcw className="h-4 w-4" />
                {updatingStatus ? "Reopening..." : "Reopen ticket"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
