import type { TicketPriority } from "@/lib/types";

export const TICKET_REOPEN_DAYS = {
  urgent: 30,
  standard: 15
} as const;

export function getTicketReopenWindowDays(priority?: TicketPriority | string | null) {
  return priority === "urgent" ? TICKET_REOPEN_DAYS.urgent : TICKET_REOPEN_DAYS.standard;
}

export function getTicketReopenDeadline(ticket: {
  priority?: TicketPriority | string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
}) {
  const resolutionTime = ticket.resolved_at ?? ticket.closed_at;
  if (!resolutionTime) return null;
  const timestamp = Date.parse(resolutionTime);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + getTicketReopenWindowDays(ticket.priority) * 24 * 60 * 60 * 1000).toISOString();
}
