import type { Ticket } from "@/lib/types";

const cachePrefix = "dci-ticket-list-v1:";

export function readCachedTickets(userId: string): Ticket[] {
  try {
    const value = JSON.parse(localStorage.getItem(`${cachePrefix}${userId}`) ?? "[]");
    return Array.isArray(value) ? value as Ticket[] : [];
  } catch { return []; }
}

export function cacheTickets(userId: string, tickets: Ticket[]) {
  try {
    // Keep only fields used by the ticket list and avoid persisting descriptions or other details.
    const safeList = tickets.map(({ id, ticket_no, title, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, is_confidential, requester_id, assigned_to, service_team_id, due_date, created_at, reopened_at, updated_at, resolved_at, first_response_at }) => ({ id, ticket_no, title, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, is_confidential, requester_id, assigned_to, service_team_id, due_date, created_at, reopened_at, updated_at, resolved_at, first_response_at }));
    localStorage.setItem(`${cachePrefix}${userId}`, JSON.stringify(safeList));
  } catch { /* Storage may be unavailable or full; continue with the live response. */ }
}
