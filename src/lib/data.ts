import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Comment,
  Discipline,
  EmployeeRole,
  Profile,
  ProfileSummary,
  TicketAttachment,
  Ticket,
  UserRole
} from "@/lib/types";

export const getSessionUser = cache(async function getSessionUser() {
  const supabase = createClient();
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

  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return (
    data ?? {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email ?? "PMSG User",
      email: user.email ?? null,
      user_side: "client",
      status: "active"
    }
  );
}

export async function getCurrentRoles() {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, role_id, roles(name)")
    .eq("user_id", user.id)
    .returns<Array<UserRole & { roles: { name: EmployeeRole } | null }>>();

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    role_id: row.role_id,
    role_name: row.roles?.name
  }));
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
  const supabase = createClient();
  const { data } = await supabase
    .from("tickets")
    .select(
      "id, ticket_no, title, description, status, priority, requester_id, assigned_to, discipline_id, category_id, due_date, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Ticket[]>();

  return data ?? [];
}

export async function getTicket(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("tickets")
    .select("*, department:departments(name), project:projects(name)")
    .eq("id", id)
    .single<Ticket>();

  return data;
}

export async function getProfileSummary(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", id)
    .maybeSingle<ProfileSummary>();

  return data;
}

export async function getTicketComments(ticketId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ticket_comments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .returns<Comment[]>();

  return data ?? [];
}

export async function getTicketAttachments(ticketId: string) {
  const supabase = createClient();
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

export async function getDisciplines() {
  const supabase = createClient();
  const { data } = await supabase
    .from("disciplines")
    .select("*")
    .order("name")
    .returns<Discipline[]>();

  return data ?? [];
}

export async function getCategories() {
  const supabase = createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("name")
    .returns<Category[]>();

  return data ?? [];
}

export async function getProfiles() {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .returns<Profile[]>();

  return data ?? [];
}

export async function getAssignableEmployees() {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, user_side, status, department_id, discipline_id")
    .eq("user_side", "employee")
    .eq("status", "active")
    .order("full_name")
    .returns<Profile[]>();

  return data ?? [];
}

export async function getAssignableRoles() {
  const supabase = createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name")
    .order("name")
    .returns<Array<{ id: number; name: EmployeeRole }>>();

  return data ?? [];
}
