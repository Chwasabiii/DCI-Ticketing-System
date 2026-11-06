import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Priority, Ticket, TicketImpact, TicketSlaPolicy, TicketUrgency } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTicketOverdue(ticket: Ticket, today = localDateString()) {
  if (ticket.ccg_request_type) {
    return Boolean(ticket.ccg_stage_due_at
      && ticket.status !== "waiting_for_info"
      && !["resolved", "closed", "rejected"].includes(ticket.status)
      && Date.parse(ticket.ccg_stage_due_at) < Date.now());
  }
  return Boolean(
    ticket.due_date &&
      ticket.due_date < today &&
      !["resolved", "closed", "rejected"].includes(ticket.status)
  );
}

export function addBusinessDays(start: number, businessDays: number) {
  const deadline = new Date(start);
  let addedDays = 0;
  while (addedDays < businessDays) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
    const weekday = deadline.getUTCDay();
    if (weekday !== 0 && weekday !== 6) addedDays += 1;
  }
  return deadline.getTime();
}

export function calculateTicketPriority(impact: TicketImpact, urgency: TicketUrgency): Priority {
  const matrix: Record<TicketImpact, Record<TicketUrgency, Priority>> = {
    high: { high: "urgent", medium: "high", low: "medium" },
    medium: { high: "high", medium: "medium", low: "low" },
    low: { high: "medium", medium: "low", low: "low" }
  };
  return matrix[impact][urgency];
}

export function needsTicketPriorityReview(ticket: Ticket) {
  return !ticket.priority_reviewed_at
    && (ticket.reported_impact === "high" || ticket.reported_urgency === "high");
}

export function getTicketSlaIndicators(ticket: Ticket, policies: TicketSlaPolicy[], now = Date.now()) {
  if (ticket.ccg_request_type) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const priorityGroup = ticket.priority === "high" || ticket.priority === "urgent" ? "high" : "standard";
  const policy = policies.find((item) => item.priority_group === priorityGroup);
  const slaStartedAt = ticket.reopened_at ?? ticket.created_at;
  if (!policy || !slaStartedAt) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const createdAt = Date.parse(slaStartedAt);
  if (!Number.isFinite(createdAt)) return [];
  const indicators: Array<{ key: string; label: string; state: "warning" | "breached" }> = [];
  const responseDeadline = addBusinessDays(createdAt, policy.first_response_business_days);
  if (ticket.first_response_at) {
    if (Date.parse(ticket.first_response_at) > responseDeadline) indicators.push({ key: "response", label: "Response SLA missed", state: "breached" });
  } else if (now > responseDeadline) {
    indicators.push({ key: "response", label: "Response SLA overdue", state: "breached" });
  } else if (responseDeadline - now <= Math.max(3_600_000, policy.first_response_business_days * 86_400_000 * 0.25)) {
    indicators.push({ key: "response", label: "Response due soon", state: "warning" });
  }

  const resolutionDeadline = addBusinessDays(createdAt, policy.resolution_business_days);
  const finalStates = ["closed", "rejected"];
  if (ticket.resolved_at) {
    if (Date.parse(ticket.resolved_at) > resolutionDeadline) indicators.push({ key: "resolution", label: "Resolution SLA missed", state: "breached" });
  } else if (now > resolutionDeadline && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution SLA overdue", state: "breached" });
  } else if (resolutionDeadline - now <= Math.max(3_600_000, policy.resolution_business_days * 86_400_000 * 0.25) && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution due soon", state: "warning" });
  }
  return indicators;
}

export function getCcgDeadlineIndicators(ticket: Ticket, now = Date.now()) {
  if (!ticket.ccg_request_type || ["resolved", "closed", "rejected"].includes(ticket.status)) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const indicators: Array<{ key: string; label: string; state: "warning" | "breached" }> = [];
  const stageDue = Date.parse(ticket.ccg_stage_due_at ?? "");
  if (Number.isFinite(stageDue) && ticket.status !== "waiting_for_info") {
    if (now >= stageDue) indicators.push({ key: "ccg-stage", label: "CCG response overdue", state: "breached" });
    else if (stageDue - now <= 8 * 60 * 60 * 1000) indicators.push({ key: "ccg-stage", label: "CCG response due soon", state: "warning" });
  }
  const vendorDue = Date.parse(ticket.ccg_vendor_due_at ?? "");
  if (Number.isFinite(vendorDue) && ticket.ccg_followup_status === "pending") {
    if (now >= vendorDue) indicators.push({ key: "ccg-vendor", label: "Vendor response overdue · CCG clock paused", state: "warning" });
    else if (vendorDue - now <= 7 * 24 * 60 * 60 * 1000) indicators.push({ key: "ccg-vendor", label: "Vendor response due within a week", state: "warning" });
  }
  return indicators;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function titleCase(value?: string | null) {
  if (!value) return "Unassigned";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
