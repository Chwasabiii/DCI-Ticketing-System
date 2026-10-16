"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Comment,
  EmployeeRole,
  Priority,
  ProjectStatus,
  TicketStatus,
  UserSide
} from "@/lib/types";

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function signIn(_: unknown, formData: FormData) {
  const email = value(formData, "email");
  const password = value(formData, "password");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "inactive") {
      await supabase.auth.signOut();
      return { error: "This account is archived. Contact an administrator to restore access." };
    }
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteUser(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in as an administrator to invite users." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();

  if (actor?.user_side !== "admin" || actor.status !== "active") {
    return { error: "Only active administrators can invite users." };
  }

  const fullName = value(formData, "full_name");
  const email = value(formData, "email")?.toLowerCase();
  const requestedSide = value(formData, "user_side");
  const userSide: UserSide | null =
    requestedSide === "client" || requestedSide === "employee" ? requestedSide : null;

  if (!fullName || !email || !userSide) {
    return { error: "Enter a name, email, and valid account type." };
  }

  const validRoles: EmployeeRole[] = [
    "Coordinator",
    "Discipline Lead",
    "Personnel",
    "Manager"
  ];
  const selectedRoles = formData
    .getAll("roles")
    .filter((role): role is EmployeeRole =>
      typeof role === "string" && validRoles.includes(role as EmployeeRole)
    );

  if (userSide === "employee" && selectedRoles.length === 0) {
    return { error: "Select at least one employee role." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Admin invitations are not configured."
    };
  }

  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : null);
  if (!configuredSiteUrl) {
    return { error: "Set NEXT_PUBLIC_SITE_URL to this app's public URL before sending invitations." };
  }

  let siteUrl: string;
  try {
    const parsedSiteUrl = new URL(configuredSiteUrl);
    if (
      !["http:", "https:"].includes(parsedSiteUrl.protocol) ||
      parsedSiteUrl.username ||
      parsedSiteUrl.password
    ) {
      return { error: "NEXT_PUBLIC_SITE_URL must be a valid http or https app URL." };
    }
    siteUrl = parsedSiteUrl.origin;
  } catch {
    return { error: "NEXT_PUBLIC_SITE_URL must be a valid http or https app URL." };
  }

  const { data: invitation, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${siteUrl}/auth/callback`
    });

  if (inviteError || !invitation.user) {
    return { error: inviteError?.message ?? "The invitation could not be sent." };
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      full_name: fullName,
      email,
      user_side: userSide,
      status: "active",
      invitation_pending: true
    })
    .eq("id", invitation.user.id);

  if (profileError) {
    return { error: `Invitation sent, but profile setup failed: ${profileError.message}` };
  }

  if (userSide === "employee") {
    const { data: roleRows, error: roleLookupError } = await adminClient
      .from("roles")
      .select("id, name")
      .in("name", selectedRoles)
      .returns<Array<{ id: number; name: EmployeeRole }>>();

    if (roleLookupError) {
      return { error: `Invitation sent, but roles could not be loaded: ${roleLookupError.message}` };
    }

    const userRoles = (roleRows ?? []).map((role) => ({
      user_id: invitation.user.id,
      role_id: role.id
    }));

    if (userRoles.length !== selectedRoles.length) {
      return { error: "Invitation sent, but one or more selected roles are not configured." };
    }

    const { error: roleInsertError } = await adminClient.from("user_roles").insert(userRoles);
    if (roleInsertError) {
      return { error: `Invitation sent, but roles could not be assigned: ${roleInsertError.message}` };
    }
  }

  revalidatePath("/admin/users");
  return { success: `Invitation sent to ${email}.` };
}

export async function verifyInvitation(formData: FormData) {
  const tokenHash = value(formData, "token_hash");
  if (!tokenHash || tokenHash.length > 2048) {
    return { error: "The invitation link is missing or invalid. Ask an administrator to send a new invitation." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite"
  });
  if (error) {
    if (error.code === "otp_expired") {
      return { error: "This invitation link has expired or has already been used. Ask an administrator to send a new invitation." };
    }
    return { error: `The invitation could not be verified: ${error.message}` };
  }

  revalidatePath("/accept-invitation");
  return { success: true };
}

export async function completeInvitation(formData: FormData) {
  const fullName = value(formData, "full_name");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (!fullName || fullName.length > 200) {
    return { error: "Enter your name (up to 200 characters)." };
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { error: "Choose a password between 8 and 128 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords do not match." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "This invitation link is invalid or has expired. Ask an administrator to send a new invitation." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("invitation_pending, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { error: `Could not verify your invitation: ${profileError.message}` };
  }
  if (profile?.invitation_pending !== true || profile.status !== "active") {
    return { error: "This account does not have a pending invitation. Sign in or contact an administrator." };
  }

  const { error: authUpdateError } = await supabase.auth.updateUser({
    password,
    data: { full_name: fullName }
  });
  if (authUpdateError) {
    return { error: `Your password could not be saved: ${authUpdateError.message}` };
  }

  const { error: completionError } = await supabase.rpc("complete_invitation", {
    p_full_name: fullName
  });
  if (completionError) {
    return {
      error: `Your password was saved, but your profile could not be completed: ${completionError.message}. Please submit the form again or contact an administrator.`
    };
  }

  revalidatePath("/settings");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function reactivateUser(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (actor?.user_side !== "admin" || actor.status !== "active") return;

  const userId = value(formData, "user_id");
  if (!userId || userId === user.id) return;

  const adminClient = createAdminClient();
  await adminClient
    .from("profiles")
    .update({ status: "active" })
    .eq("id", userId)
    .eq("status", "inactive");

  revalidatePath("/admin/users");
}

export async function createProject(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as an administrator to add projects." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (actor?.user_side !== "admin" || actor.status !== "active") {
    return { error: "Only active administrators can manage projects." };
  }

  const name = value(formData, "name");
  const projectCode = value(formData, "project_code");
  const location = value(formData, "location");
  const requestedStatus = value(formData, "status");
  const status: ProjectStatus | null =
    requestedStatus === "planned" || requestedStatus === "ongoing"
      ? requestedStatus
      : null;

  if (!name || !status) {
    return { error: "Enter a project name and select Planned or Ongoing." };
  }
  if (name.length > 200 || (projectCode?.length ?? 0) > 100 || (location?.length ?? 0) > 200) {
    return { error: "Project name, code, or location is too long." };
  }

  const { error } = await supabase.from("projects").insert({
    name,
    project_code: projectCode,
    location,
    status
  });
  if (error) return { error: `The project could not be added: ${error.message}` };

  revalidatePath("/admin/projects");
  revalidatePath("/api/reference-data");
  revalidatePath("/tickets/new");
  return { success: `Project "${name}" added.` };
}

export async function updateProjectStatus(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as an administrator to update projects." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (actor?.user_side !== "admin" || actor.status !== "active") {
    return { error: "Only active administrators can manage projects." };
  }

  const projectId = value(formData, "project_id");
  const requestedStatus = value(formData, "status");
  const statuses: ProjectStatus[] = ["planned", "ongoing", "completed"];
  const status = statuses.find((option) => option === requestedStatus);
  if (!projectId || !/^\d+$/.test(projectId) || !status) {
    return { error: "Select a valid project and status." };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) return { error: `The project status could not be updated: ${error.message}` };
  if (!project) return { error: "The project was not found or could not be updated." };

  revalidatePath("/admin/projects");
  revalidatePath("/api/reference-data");
  revalidatePath("/tickets/new");
  return { success: "Project status updated." };
}

export async function createTicket(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Please sign in before submitting a ticket." };

  const title = value(formData, "title");
  const description = value(formData, "description");
  const projectId = value(formData, "project_id");
  const requestedPriority = value(formData, "priority");
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];
  const priority = priorities.find((option) => option === requestedPriority) ?? "medium";

  if (!title || !description) {
    return { error: "Enter a title and details for your request." };
  }

  if (projectId) {
    if (!/^\d+$/.test(projectId)) {
      return { error: "Select a valid project." };
    }
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .in("status", ["planned", "ongoing"])
      .maybeSingle();
    if (projectError) {
      return { error: `Could not validate the selected project: ${projectError.message}` };
    }
    if (!project) return { error: "Select a Planned or Ongoing project." };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title,
      description,
      requester_id: user.id,
      department_id: value(formData, "department_id"),
      project_id: projectId,
      category_id: value(formData, "category_id"),
      discipline_id: value(formData, "discipline_id"),
      priority,
      status: "open"
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { error: error?.message ?? "The ticket could not be created." };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ticketId: String(ticket.id), userId: user.id };
}

export async function addComment(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const ticketId = value(formData, "ticket_id");
  const body = value(formData, "body");
  const isInternal = value(formData, "is_internal") === "on";

  if (!ticketId || !body) {
    return { error: "Enter a comment before posting." };
  }

  const { data: comment, error } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      body,
      is_internal: isInternal
    })
    .select("*")
    .single<Comment>();

  if (error || !comment) {
    return { error: error?.message ?? "The comment could not be posted." };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { comment };
}

export async function updateTicketStatus(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update this ticket." };

  const ticketId = value(formData, "ticket_id");
  const requestedStatus = value(formData, "status");
  const allowedStatuses: TicketStatus[] = [
    "open",
    "under_review",
    "assigned",
    "in_progress",
    "waiting_for_info",
    "resolved",
    "closed",
    "rejected"
  ];
  const status = allowedStatuses.find((option) => option === requestedStatus);

  if (!ticketId || !status) return { error: "Choose a valid ticket status." };

  const update: { status: TicketStatus; resolution_notes?: string } = { status };
  const resolutionNotes = value(formData, "resolution_notes");
  if (status === "resolved" && resolutionNotes) {
    update.resolution_notes = resolutionNotes;
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(update)
    .eq("id", ticketId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "You do not have permission to update this ticket." };

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/queue");
  return { success: "Ticket status updated." };
}

export async function routeTicket(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to route this ticket." };

  const ticketId = value(formData, "ticket_id");
  const requestedPriority = value(formData, "priority");
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];
  const priority = priorities.find((option) => option === requestedPriority);
  const assignedTo = value(formData, "assigned_to");
  const requestedStatus = value(formData, "status");
  const allowedStatuses: TicketStatus[] = [
    "open",
    "under_review",
    "assigned",
    "in_progress",
    "waiting_for_info",
    "resolved",
    "closed",
    "rejected"
  ];
  const status = allowedStatuses.find((option) => option === requestedStatus);

  if (!ticketId || !priority || !status) {
    return { error: "Choose a valid discipline, priority, assignee, and status." };
  }

  if (assignedTo) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedTo)
      .eq("user_side", "employee")
      .eq("status", "active")
      .maybeSingle();

    if (!assignee) return { error: "Choose an active employee as the assignee." };
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({
      priority,
      discipline_id: value(formData, "discipline_id"),
      assigned_to: assignedTo,
      status
    })
    .eq("id", ticketId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "You do not have permission to route this ticket." };

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/queue");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { success: "Ticket routing and assignment saved." };
}
