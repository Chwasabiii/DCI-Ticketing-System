import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";

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

export function isTicketOverdue(ticket: { due_date?: string | null; status: string }, today = localDateString()) {
  return Boolean(
    ticket.due_date &&
      ticket.due_date < today &&
      !["resolved", "closed", "rejected"].includes(ticket.status)
  );
}

export function getTicketSlaIndicators(ticket: Ticket, policies: TicketSlaPolicy[], now = Date.now()) {
  const policy = policies.find((item) => item.priority === ticket.priority);
  if (!policy || !ticket.created_at) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const createdAt = Date.parse(ticket.created_at);
  if (!Number.isFinite(createdAt)) return [];
  const indicators: Array<{ key: string; label: string; state: "warning" | "breached" }> = [];
  const responseDeadline = createdAt + policy.first_response_hours * 3_600_000;
  if (ticket.first_response_at) {
    if (Date.parse(ticket.first_response_at) > responseDeadline) indicators.push({ key: "response", label: "Response SLA missed", state: "breached" });
  } else if (now > responseDeadline) {
    indicators.push({ key: "response", label: "Response SLA overdue", state: "breached" });
  } else if (responseDeadline - now <= Math.max(3_600_000, policy.first_response_hours * 3_600_000 * 0.25)) {
    indicators.push({ key: "response", label: "Response due soon", state: "warning" });
  }

  const resolutionDeadline = createdAt + policy.resolution_hours * 3_600_000;
  const finalStates = ["closed", "rejected"];
  if (ticket.resolved_at) {
    if (Date.parse(ticket.resolved_at) > resolutionDeadline) indicators.push({ key: "resolution", label: "Resolution SLA missed", state: "breached" });
  } else if (now > resolutionDeadline && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution SLA overdue", state: "breached" });
  } else if (resolutionDeadline - now <= Math.max(3_600_000, policy.resolution_hours * 3_600_000 * 0.25) && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution due soon", state: "warning" });
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
