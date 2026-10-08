import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Comment,
  Discipline,
  EmployeeRole,
  Profile,
  Ticket,
  UserRole
} from "@/lib/types";

export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

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

export async function getCurrentContext() {
  const [profile, roles] = await Promise.all([
    getCurrentProfile(),
    getCurrentRoles()
  ]);

  return {
    profile,
    roles,
    roleNames: roles.map((role) => role.role_name).filter(Boolean) as EmployeeRole[]
  };
}

export async function getTickets(limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Ticket[]>();

  return data ?? [];
}

export async function getTicket(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single<Ticket>();

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
