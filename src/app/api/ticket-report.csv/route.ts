import { getCurrentContext, getServiceTeams, getTicketSlaPolicies } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getTicketResolutionDueLabel } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

const pageSize = 1000;
const allowedStatuses = new Set([
  "open", "under_review", "assigned", "in_progress", "waiting_for_info", "resolved", "closed", "rejected"
]);

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const [{ profile }, supabase, slaPolicies, serviceTeams] = await Promise.all([
    getCurrentContext(),
    createClient(),
    getTicketSlaPolicies(),
    getServiceTeams({ inScopeOnly: true })
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const startDate = validDate(params.get("start"));
  const endDate = validDate(params.get("end"));
  const statusValue = params.get("status");
  const status = statusValue && allowedStatuses.has(statusValue) ? statusValue : undefined;
  const serviceTeamNames = new Map(serviceTeams.map((team) => [team.id, team.name]));
  const teamValue = params.get("team");
  const serviceTeamId = teamValue && /^\d+$/.test(teamValue) && Number.isSafeInteger(Number(teamValue)) && Number(teamValue) > 0
    ? Number(teamValue)
    : undefined;
  let offset = 0;
  let finished = false;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("\uFEFFTicket,Title,Service team,Status,Priority,Created,First response,Resolution target,Resolved,Reopened\r\n"));
    },
    async pull(controller) {
      if (finished) return;
      let query = supabase
        .from("tickets")
        .select("id, ticket_no, title, service_team_id, status, priority, created_at, first_response_at, reopened_at, resolved_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
      if (endDate) {
        const dayAfter = new Date(`${endDate}T00:00:00.000Z`);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        query = query.lt("created_at", dayAfter.toISOString());
      }
      if (status) query = query.eq("status", status);
      if (serviceTeamId !== undefined) query = query.eq("service_team_id", serviceTeamId);

      const { data, error } = await query;
      if (error) {
        finished = true;
        controller.error(new Error(`Could not export ticket report: ${error.message}`));
        return;
      }

      const rows = data ?? [];
      if (rows.length) {
        const lines = rows.map((ticket) => [
          ticket.ticket_no ?? ticket.id,
          ticket.title,
          serviceTeamNames.get(ticket.service_team_id) ?? ticket.service_team_id ?? "",
          ticket.status,
          ticket.priority,
          ticket.created_at,
          ticket.first_response_at,
          getTicketResolutionDueLabel(ticket as Ticket, slaPolicies),
          ticket.resolved_at,
          ticket.reopened_at
        ].map(csvCell).join(",")).join("\r\n");
        controller.enqueue(new TextEncoder().encode(`${lines}\r\n`));
      }
      offset += rows.length;
      if (rows.length < pageSize) {
        finished = true;
        controller.close();
      }
    }
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ticket-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store"
    }
  });
}
