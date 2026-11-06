import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Comment,
  EmployeeRole,
  ManagedProfile,
  Notification,
  NotificationPreference,
  Profile,
  ProfileSummary,
  ServiceTeam,
  RelatedTicket,
  TicketAttachment,
  TicketActivity,
  TicketEvent,
  Ticket,
  TicketFeedback,
  TicketSlaPolicy,
  UserRole
} from "@/lib/types";

export const getSessionUser = cache(async function getSessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims || typeof claims.sub !== "string") return null;

  const userMetadata = claims.user_metadata as
    | { full_name?: unknown }
    | undefined;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: {
      full_name:
        typeof userMetadata?.full_name === "string"
          ? userMetadata.full_name
          : null
    }
  };
});

export async function getCurrentProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, service_team:service_teams(id, name, slug)")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error) throw new Error(`Could not load your support profile: ${error.message}`);
  return data;
}

export async function getCurrentRoles() {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, role_id, roles(name)")
    .eq("user_id", user.id)
    .returns<Array<UserRole & { roles: { name: EmployeeRole } | null }>>();

  return (data ?? []).flatMap((row) => {
    const roleName = row.roles?.name;
    if (roleName !== "Coordinator" && roleName !== "Personnel" && roleName !== "Manager") return [];
    return [{
      user_id: row.user_id,
      role_id: row.role_id,
      role_name: roleName
    }];
  });
}

export const getCurrentContext = cache(async function getCurrentContext() {
  const [profile, roles] = await Promise.all([
    getCurrentProfile(),
    getCurrentRoles()
  ]);

  return {
    profile,
    roles,
    roleNames: roles.map((role) => role.role_name).filter(Boolean) as EmployeeRole[]
  };
});

export async function getTickets(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, ticket_no, title, description, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, is_confidential, requester_id, assigned_to, service_team_id, due_date, created_at, reopened_at, updated_at, resolved_at, first_response_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Ticket[]>();

  if (error) throw new Error(`Could not load tickets: ${error.message}`);
  return data ?? [];
}

const reportTicketSelection = "id, ticket_no, title, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, ccg_request_type, ccg_request_scope, ccg_procurement_in_scope, is_confidential, requester_id, assigned_to, service_team_id, due_date, created_at, reopened_at, updated_at, resolved_at, first_response_at";

export async function getServiceTeams({ inScopeOnly = false }: { inScopeOnly?: boolean } = {}): Promise<ServiceTeam[]> {
  const supabase = await createClient();
  let query = supabase.from("service_teams")
    .select("id, name, slug, is_in_scope, is_active")
    .eq("is_active", true)
    .order("name");
  if (inScopeOnly) query = query.eq("is_in_scope", true);
  const { data, error } = await query.returns<ServiceTeam[]>();
  if (error) throw new Error(`Could not load service teams: ${error.message}`);
  return data ?? [];
}

export async function getTicketSlaPolicies(): Promise<TicketSlaPolicy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ticket_sla_policies")
    .select("priority_group, first_response_business_days, resolution_business_days, updated_at")
    .order("priority_group").returns<TicketSlaPolicy[]>();
  if (error) throw new Error(`Could not load ticket SLA policies: ${error.message}`);
  return data ?? [];
}

export async function getAllTickets() {
  const supabase = await createClient();
  const pageSize = 1000;
  const allTickets: Ticket[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("tickets")
      .select(reportTicketSelection)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1)
      .returns<Ticket[]>();
    if (error) throw new Error(`Could not load tickets: ${error.message}`);
    allTickets.push(...(data ?? []));
    if (!data || data.length < pageSize) return allTickets;
  }
}

export async function getReportTickets({
  startDate,
  endDate,
  status
}: {
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const supabase = await createClient();
  const pageSize = 1000;
  const tickets: Ticket[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("tickets")
      .select(reportTicketSelection)
      .order("created_at", { ascending: false });
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    if (endDate) {
      const dayAfter = new Date(`${endDate}T00:00:00.000Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      query = query.lt("created_at", dayAfter.toISOString());
    }
    if (status) query = query.eq("status", status);
    const { data, error } = await query.range(offset, offset + pageSize - 1).returns<Ticket[]>();
    if (error) throw new Error(`Could not load ticket report: ${error.message}`);
    tickets.push(...(data ?? []));
    if (!data || data.length < pageSize) return tickets;
  }
}

export async function getTicket(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("id, ticket_no, title, description, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, is_confidential, request_type, service_category, ccg_request_type, ccg_request_scope, ccg_procurement_in_scope, requester_id, assigned_to, service_team_id, service_team:service_teams(id, name, slug), resolution_notes, due_date, created_at, reopened_at, resolved_at, first_response_at, updated_at")
    .eq("id", id)
    .single<Ticket>();

  return data;
}

export async function getTicketFeedback(ticketId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_feedback")
    .select("id, ticket_id, requester_id, rating, comment, created_at")
    .eq("ticket_id", ticketId)
    .maybeSingle<TicketFeedback>();
  if (error) throw new Error(`Could not load ticket feedback: ${error.message}`);
  return data;
}

export async function getRelatedTickets(ticketId: string): Promise<RelatedTicket[]> {
  const supabase = await createClient();
  const id = Number(ticketId);
  const { data: links, error: linksError } = await supabase
    .from("ticket_links")
    .select("ticket_id, related_ticket_id")
    .or(`ticket_id.eq.${id},related_ticket_id.eq.${id}`);
  if (linksError) throw new Error(`Could not load related tickets: ${linksError.message}`);

  const relatedIds = (links ?? []).map((link) =>
    Number(link.ticket_id) === id ? link.related_ticket_id : link.ticket_id
  );
  if (!relatedIds.length) return [];

  const { data, error } = await supabase
    .from("tickets")
    .select("id, ticket_no, title, status, priority")
    .in("id", relatedIds)
    .order("created_at", { ascending: false })
    .returns<RelatedTicket[]>();
  if (error) throw new Error(`Could not load related tickets: ${error.message}`);
  return data ?? [];
}

export async function getProfileSummary(id: string, ticketId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ticket_profile_summary", {
    p_ticket_id: Number(ticketId),
    p_profile_id: id
  });
  if (error) throw new Error(`Could not load ticket participant: ${error.message}`);
  return (data?.[0] as ProfileSummary | undefined) ?? null;
}

export async function getTicketActivity(ticketId: string): Promise<TicketActivity[]> {
  const supabase = await createClient();
  const [eventsResult, commentsResult] = await Promise.all([
    supabase
      .from("ticket_events")
      .select("id, ticket_id, actor_id, event_type, from_status, to_status, note, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .returns<TicketEvent[]>(),
    supabase
      .from("ticket_comments")
      .select("id, ticket_id, author_id, body, is_internal, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .returns<Comment[]>()
  ]);

  if (eventsResult.error) {
    throw new Error(`Could not load ticket activity: ${eventsResult.error.message}`);
  }
  if (commentsResult.error) {
    throw new Error(`Could not load ticket comments: ${commentsResult.error.message}`);
  }

  const events = eventsResult.data ?? [];
  const comments = commentsResult.data ?? [];
  const actorIds = Array.from(
    new Set([
      ...events.map((event) => event.actor_id),
      ...comments.map((comment) => comment.author_id)
    ].filter((id): id is string => Boolean(id)))
  );

  const profilesResult = actorIds.length
    ? await supabase.rpc("get_ticket_activity_profiles", { p_ticket_id: Number(ticketId) })
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error(`Could not load ticket activity authors: ${profilesResult.error.message}`);
  }

  const profilesById = new Map(
    ((profilesResult.data ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile])
  );
  const activity: TicketActivity[] = [
    ...events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      created_at: event.created_at,
      actor: event.actor_id ? profilesById.get(event.actor_id) ?? null : null,
      event_type: event.event_type,
      from_status: event.from_status,
      to_status: event.to_status,
      note: event.note
    })),
    ...comments.map((comment) => ({
      kind: "comment" as const,
      id: comment.id,
      created_at: comment.created_at,
      actor: profilesById.get(comment.author_id) ?? null,
      body: comment.body,
      is_internal: comment.is_internal
    }))
  ];

  return activity.sort((left, right) => {
    const timeDifference =
      Date.parse(left.created_at ?? "") - Date.parse(right.created_at ?? "");
    if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
    if (left.kind !== right.kind) return left.kind === "event" ? -1 : 1;
    return Number(left.id) - Number(right.id);
  });
}

export async function getTicketAttachments(ticketId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, ticket_id, uploaded_by, file_name, file_path, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .returns<TicketAttachment[]>();

  return Promise.all(
    (data ?? []).map(async (attachment) => {
      const { data: signedFile } = await supabase.storage
        .from("ticket-attachments")
        .createSignedUrl(attachment.file_path, 300, {
          download: attachment.file_name
        });

      return { ...attachment, signed_url: signedFile?.signedUrl ?? null };
    })
  );
}

export async function getProfiles() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .returns<Profile[]>();

  return data ?? [];
}

export async function getManagedProfiles(): Promise<ManagedProfile[]> {
  const supabase = await createClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, user_side, status, invitation_pending, service_team_id, service_team:service_teams(id, name, slug)")
    .order("full_name")
    .returns<Array<Omit<ManagedProfile, "employee_roles">>>();

  if (profilesError || !profiles?.length) return [];

  const { data: assignments, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", profiles.map((profile) => profile.id))
    .returns<Array<{ user_id: string; roles: { name: EmployeeRole } | null }>>();

  if (rolesError) return profiles.map((profile) => ({ ...profile, employee_roles: [] }));

  const roleMap = new Map<string, EmployeeRole[]>();
  for (const assignment of assignments ?? []) {
    const roleName = assignment.roles?.name;
    if (roleName !== "Coordinator" && roleName !== "Personnel" && roleName !== "Manager") continue;
    roleMap.set(assignment.user_id, [...(roleMap.get(assignment.user_id) ?? []), roleName]);
  }

  return profiles.map((profile) => ({
    ...profile,
    employee_roles: roleMap.get(profile.id) ?? []
  }));
}

export async function getNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, ticket_id, type, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Notification[]>();

  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) throw new Error(`Could not count unread notifications: ${error.message}`);
  return count ?? 0;
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("notification_type, enabled");
  if (error) throw new Error(`Could not load notification preferences: ${error.message}`);
  return (data ?? []) as NotificationPreference[];
}

export async function getAssignableEmployees(serviceTeamId?: number | null) {
  if (serviceTeamId === null) return [];
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, user_side, status, service_team_id")
    .eq("user_side", "employee")
    .eq("status", "active")
    .order("full_name");
  if (serviceTeamId !== undefined) query = query.eq("service_team_id", serviceTeamId);
  const { data } = await query.returns<Profile[]>();

  return data ?? [];
}

export async function getAssignableRoles() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name")
    .in("name", ["Coordinator", "Personnel", "Manager"])
    .order("name")
    .returns<Array<{ id: number; name: EmployeeRole }>>();

  return data ?? [];
}
