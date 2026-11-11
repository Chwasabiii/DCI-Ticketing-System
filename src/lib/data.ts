import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Comment,
  BusinessHoliday,
  EmployeeRole,
  ManagedProfile,
  Notification,
  NotificationPreference,
  Profile,
  ProfileSummary,
  ServiceTeam,
  ServiceDashboardMetrics,
  RelatedTicket,
  TicketAttachment,
  TicketActivity,
  TicketEvent,
  Ticket,
  TicketFeedback,
  TicketFeedbackSummary,
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
      "id, ticket_no, title, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, ccg_request_type, ccg_request_types, ccg_request_scope, ccg_followup_type, ccg_followup_status, ccg_stage_due_at, ccg_vendor_expected_at, ccg_vendor_due_at, ccg_vendor_wait_started_at, is_confidential, requester_id, assigned_to, service_team_id, due_date, created_at, reopened_at, updated_at, resolved_at, first_response_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Ticket[]>();

  if (error) throw new Error(`Could not load tickets: ${error.message}`);
  return data ?? [];
}

const queueTicketSelection = "id, ticket_no, title, status, priority, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, request_type, service_category, ccg_request_type, ccg_request_types, ccg_request_scope, ccg_stage_due_at, ccg_vendor_expected_at, ccg_vendor_due_at, ccg_vendor_wait_started_at, ccg_vendor_wait_seconds, ccg_requester_wait_started_at, ccg_requester_wait_seconds, is_confidential, assigned_to, due_date, created_at, reopened_at, resolved_at, first_response_at, resolution_notes";

const dashboardTicketSelection = "id, ticket_no, title, status, priority, is_confidential, request_type, service_category, ccg_request_type, ccg_request_types, ccg_stage_due_at, due_date, created_at, updated_at, reopened_at, resolved_at, first_response_at, requester_id, requester:profiles!tickets_requester_id_fkey(id, full_name, email), assigned_to, assignee:profiles!tickets_assigned_to_fkey(id, full_name, email), service_team_id";

const performanceTicketSelection = "status, priority, assigned_to, first_response_at, resolved_at, created_at, reopened_at, due_date, ccg_request_type, ccg_stage_due_at, ccg_vendor_due_at, ccg_vendor_expected_at, ccg_vendor_wait_started_at, ccg_vendor_wait_seconds, ccg_requester_wait_started_at, ccg_requester_wait_seconds";
const reportSummarySelection = "status, priority, created_at, first_response_at, reopened_at, resolved_at, service_team_id, ccg_request_type, ccg_stage_due_at";

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
  const [policiesResult, holidaysResult] = await Promise.all([
    supabase.from("ticket_sla_policies")
      .select("priority_group, first_response_business_days, resolution_business_days, updated_at")
      .order("priority_group").returns<TicketSlaPolicy[]>(),
    supabase.from("ticket_sla_holidays")
      .select("holiday_date").order("holiday_date")
  ]);
  if (policiesResult.error) throw new Error(`Could not load ticket SLA policies: ${policiesResult.error.message}`);
  if (holidaysResult.error) throw new Error(`Could not load ticket SLA holidays: ${holidaysResult.error.message}`);
  const holidayDates = (holidaysResult.data ?? []).map(({ holiday_date }) => holiday_date);
  return (policiesResult.data ?? []).map((policy) => ({ ...policy, holiday_dates: holidayDates }));
}

export async function getTicketSlaHolidays(): Promise<BusinessHoliday[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ticket_sla_holidays")
    .select("holiday_date, name").order("holiday_date").returns<BusinessHoliday[]>();
  if (error) throw new Error(`Could not load ticket SLA holidays: ${error.message}`);
  return data ?? [];
}

export async function getCcgBusinessHolidays(): Promise<BusinessHoliday[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ccg_business_holidays")
    .select("holiday_date, name").order("holiday_date").returns<BusinessHoliday[]>();
  if (error) throw new Error(`Could not load CCG holidays: ${error.message}`);
  return data ?? [];
}

async function getPagedTickets(selection: string, serviceTeamId?: number, createdAfter?: string) {
  const supabase = await createClient();
  const pageSize = 1000;
  const allTickets: Ticket[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("tickets")
      .select(selection)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (serviceTeamId !== undefined) query = query.eq("service_team_id", serviceTeamId);
    if (createdAfter) query = query.or(`created_at.gte.${createdAfter},reopened_at.gte.${createdAfter}`);
    const { data, error } = await query.returns<Ticket[]>();
    if (error) throw new Error(`Could not load tickets: ${error.message}`);
    allTickets.push(...(data ?? []));
    if (!data || data.length < pageSize) return allTickets;
  }
}

export async function getDashboardTickets(serviceTeamId?: number) {
  return getPagedTickets(dashboardTicketSelection, serviceTeamId);
}

function isServiceDashboardMetrics(value: unknown): value is ServiceDashboardMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metrics = value as Record<string, unknown>;
  const countFields = [
    "total",
    "open_total",
    "unassigned",
    "assigned_to_me",
    "overdue",
    "awaiting_user",
    "resolved_this_week"
  ];
  const categories = metrics.categories;
  return countFields.every((field) => typeof metrics[field] === "number")
    && (metrics.average_first_response_hours === null || typeof metrics.average_first_response_hours === "number")
    && (metrics.average_resolution_days === null || typeof metrics.average_resolution_days === "number")
    && Array.isArray(categories)
    && categories.every((category: unknown) => category
      && typeof category === "object"
      && !Array.isArray(category)
      && typeof (category as Record<string, unknown>).category === "string"
      && typeof (category as Record<string, unknown>).count === "number");
}

export async function getServiceDashboardMetrics(serviceTeamId?: number): Promise<ServiceDashboardMetrics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_service_dashboard_metrics", {
    p_service_team_id: serviceTeamId ?? null
  });
  if (error) throw new Error(`Could not load service dashboard metrics: ${error.message}`);
  const result: unknown = Array.isArray(data) ? data[0] : data;
  if (!isServiceDashboardMetrics(result)) {
    throw new Error("Could not load service dashboard metrics: the database returned an invalid result.");
  }
  return result;
}

export async function getTeamTickets(serviceTeamId: number) {
  return getPagedTickets(queueTicketSelection, serviceTeamId);
}

export async function getInboxTickets({
  serviceTeamId,
  view = "all",
  status,
  priority,
  needsPriorityReview = false,
  search = "",
  page = 1,
  pageSize = 25
}: {
  serviceTeamId?: number;
  view?: "all" | "unassigned" | "mine" | "overdue" | "resolved";
  status?: string;
  priority?: string;
  needsPriorityReview?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .rpc("search_ticket_inbox", {
      p_service_team_id: serviceTeamId ?? null,
      p_view: view,
      p_status: status ?? null,
      p_priority: priority ?? null,
      p_needs_priority_review: needsPriorityReview,
      p_search: search.slice(0, 100)
    }, { count: "exact" })
    .select(queueTicketSelection)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1)
    .returns<Ticket[]>();
  if (error) throw new Error(`Could not load triage inbox: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("Could not load triage inbox: the database returned an invalid result.");
  const tickets = data.filter((ticket): ticket is Ticket =>
    typeof ticket === "object" && ticket !== null && "id" in ticket && "title" in ticket
  );
  return { tickets, totalCount: count ?? 0 };
}

export async function getPerformanceTickets(serviceTeamId: number, createdAfter: string) {
  return getPagedTickets(performanceTicketSelection, serviceTeamId, createdAfter);
}

export async function getMyTicketFeedbackSummary(): Promise<TicketFeedbackSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_ticket_feedback_summary");
  if (error) throw new Error(`Could not load requester rating: ${error.message}`);
  const summary = data?.[0];
  if (!summary) throw new Error("Could not load requester rating: the database returned no summary.");
  return {
    average_rating: summary.average_rating,
    response_count: summary.response_count
  };
}

export async function getReportTickets({
  startDate,
  endDate,
  status,
  serviceTeamId,
  page = 1,
  pageSize = 25
}: {
  startDate?: string;
  endDate?: string;
  status?: string;
  serviceTeamId?: number;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  let query = supabase.from("tickets")
    .select(queueTicketSelection, { count: "exact" })
    .order("created_at", { ascending: false });
  if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
  if (endDate) {
    const dayAfter = new Date(`${endDate}T00:00:00.000Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    query = query.lt("created_at", dayAfter.toISOString());
  }
  if (status) query = query.eq("status", status);
  if (serviceTeamId !== undefined) query = query.eq("service_team_id", serviceTeamId);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1).returns<Ticket[]>();
  if (error) throw new Error(`Could not load ticket report: ${error.message}`);
  return { tickets: data ?? [], totalCount: count ?? 0 };
}

export async function getReportSummaryTickets({
  startDate,
  endDate,
  status,
  serviceTeamId
}: {
  startDate?: string;
  endDate?: string;
  status?: string;
  serviceTeamId?: number;
}) {
  const supabase = await createClient();
  const pageSize = 1000;
  const tickets: Array<Pick<Ticket, "status" | "priority" | "created_at" | "first_response_at" | "reopened_at" | "resolved_at" | "service_team_id" | "ccg_request_type" | "ccg_stage_due_at">> = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from("tickets").select(reportSummarySelection).order("created_at", { ascending: false });
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    if (endDate) {
      const dayAfter = new Date(`${endDate}T00:00:00.000Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      query = query.lt("created_at", dayAfter.toISOString());
    }
    if (status) query = query.eq("status", status);
    if (serviceTeamId !== undefined) query = query.eq("service_team_id", serviceTeamId);
    const { data, error } = await query.range(offset, offset + pageSize - 1)
      .returns<typeof tickets>();
    if (error) throw new Error(`Could not load ticket report summary: ${error.message}`);
    tickets.push(...(data ?? []));
    if (!data || data.length < pageSize) return tickets;
  }
}

export async function getTicket(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("id, ticket_no, title, description, status, priority, impact, urgency, reported_impact, reported_urgency, priority_reviewed_at, priority_reviewed_by, is_confidential, request_type, service_category, ccg_request_type, ccg_request_types, ccg_request_scope, ccg_procurement_in_scope, ccg_database_result, ccg_followup_type, ccg_followup_status, ccg_stage_due_at, ccg_vendor_expected_at, ccg_vendor_due_at, ccg_vendor_wait_started_at, ccg_vendor_wait_seconds, ccg_requester_wait_started_at, ccg_requester_wait_seconds, requester_id, assigned_to, service_team_id, service_team:service_teams(id, name, slug), resolution_notes, due_date, created_at, reopened_at, resolved_at, first_response_at, updated_at")
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
  const [eventsResult, commentsResult, profilesResult] = await Promise.all([
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
      .returns<Comment[]>(),
    supabase.rpc("get_ticket_activity_profiles", { p_ticket_id: Number(ticketId) })
  ]);

  if (eventsResult.error) {
    throw new Error(`Could not load ticket activity: ${eventsResult.error.message}`);
  }
  if (commentsResult.error) {
    throw new Error(`Could not load ticket comments: ${commentsResult.error.message}`);
  }

  const events = eventsResult.data ?? [];
  const comments = commentsResult.data ?? [];
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

  const attachments = data ?? [];
  if (!attachments.length) return [];

  const { data: signedFiles } = await supabase.storage
    .from("ticket-attachments")
    .createSignedUrls(attachments.map((attachment) => attachment.file_path), 300);
  const signedUrls = new Map(
    (signedFiles ?? []).flatMap((file) => file.path && file.signedUrl ? [[file.path, file.signedUrl] as const] : [])
  );

  return attachments.map((attachment) => {
    const signedUrl = signedUrls.get(attachment.file_path);
    if (!signedUrl) return { ...attachment, signed_url: null };
    const url = new URL(signedUrl);
    url.searchParams.set("download", attachment.file_name);
    return { ...attachment, signed_url: url.toString() };
  });
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

export async function getCcgAssignableEmployees(serviceTeamId?: number | null) {
  const employees = await getAssignableEmployees(serviceTeamId);
  if (employees.length === 0) return employees;
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_roles").select("user_id, roles(name)")
    .in("user_id", employees.map((employee) => employee.id));
  if (error) throw new Error(`Could not load CCG assignees: ${error.message}`);
  const eligible = new Set((data ?? []).flatMap((assignment) => {
    const roleName = (assignment.roles as { name?: string } | null)?.name;
    return roleName === "Personnel" || roleName === "Coordinator" ? [assignment.user_id] : [];
  }));
  return employees.filter((employee) => eligible.has(employee.id));
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
