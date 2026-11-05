"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateTicketPriority } from "@/lib/utils";
import type {
  Comment,
  EmployeeRole,
  TicketImpact,
  TicketStatus,
  TicketUrgency,
  UserSide
} from "@/lib/types";

const validUserSides: UserSide[] = ["client", "employee", "admin"];

async function getAdminMutationContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as an administrator to manage accounts." } as const;

  const { data: actor, error } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (error || actor?.user_side !== "admin" || actor.status !== "active") {
    return { error: "Only active administrators can manage accounts." } as const;
  }

  try {
    return { actorId: user.id, adminClient: createAdminClient() } as const;
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Account management is not configured."
    } as const;
  }
}

function isUuid(id: string | null): id is string {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function getActiveTicketActor(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_side, status, service_team_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return { error: `Could not verify your account: ${profileError.message}` } as const;
  if (!profile || profile.status !== "active") return { error: "Your account is not active." } as const;
  if (profile.user_side !== "employee") return { profile, roles: [] as string[] } as const;

  const { data: assignments, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);
  if (rolesError) return { error: `Could not verify your employee role: ${rolesError.message}` } as const;
  const roles = (assignments ?? [])
    .map((assignment) => (assignment.roles as { name?: string } | null)?.name)
    .filter((role): role is string => Boolean(role));
  return { profile, roles } as const;
}

export async function signIn(_: unknown, formData: FormData) {
  const email = value(formData, "email");
  const password = value(formData, "password");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
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
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteUser(formData: FormData) {
  const supabase = await createClient();
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
    requestedSide === "client" || requestedSide === "employee" || requestedSide === "admin" ? requestedSide : null;

  if (!fullName || !email || !userSide) {
    return { error: "Enter a name, email, and valid account type." };
  }

  const requestedTeamId = value(formData, "service_team_id");
  const serviceTeamId = userSide === "employee" && requestedTeamId && /^\d+$/.test(requestedTeamId)
    ? Number(requestedTeamId)
    : null;
  if (userSide === "employee" && !serviceTeamId) {
    return { error: "Choose a service team for this service provider." };
  }

  const validRoles: EmployeeRole[] = [
    "Coordinator",
    "Personnel",
    "Manager"
  ];
  const selectedRoles = formData
    .getAll("roles")
    .filter((role): role is EmployeeRole =>
      typeof role === "string" && validRoles.includes(role as EmployeeRole)
    );

  if (userSide === "employee" && selectedRoles.length === 0) {
    return { error: "Select at least one service provider role." };
  }

  if (serviceTeamId) {
    const { data: team, error: teamError } = await supabase.from("service_teams")
      .select("id").eq("id", serviceTeamId).eq("is_active", true).maybeSingle();
    if (teamError || !team) return { error: "Choose an active service team." };
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
      service_team_id: serviceTeamId,
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

  const supabase = await createClient();
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

  const supabase = await createClient();
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

export async function updateManagedUser(formData: FormData) {
  const context = await getAdminMutationContext();
  if ("error" in context) return context;

  const userId = value(formData, "user_id");
  const requestedSide = value(formData, "user_side");
  if (!isUuid(userId) || !requestedSide || !validUserSides.includes(requestedSide as UserSide)) {
    return { error: "Choose a valid account and account type." };
  }

  const userSide = requestedSide as UserSide;
  if (userId === context.actorId && userSide !== "admin") {
    return { error: "You cannot remove your own administrator access." };
  }

  const { data: target, error: targetError } = await context.adminClient
    .from("profiles")
    .select("id, user_side, status")
    .eq("id", userId)
    .maybeSingle();
  if (targetError || !target) return { error: "That account could not be found." };

  const requestedTeamId = value(formData, "service_team_id");
  const serviceTeamId = userSide === "employee" && requestedTeamId && /^\d+$/.test(requestedTeamId)
    ? Number(requestedTeamId)
    : null;
  if (userSide === "employee" && !serviceTeamId) {
    return { error: "Choose a service team for this service provider." };
  }
  if (serviceTeamId) {
    const { data: team, error } = await context.adminClient.from("service_teams")
      .select("id").eq("id", serviceTeamId).eq("is_active", true).maybeSingle();
    if (error || !team) return { error: "Choose an active service team." };
  }

  if (target.user_side === "admin" && target.status === "active" && userSide !== "admin") {
    const { count, error } = await context.adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_side", "admin")
      .eq("status", "active")
      .neq("id", userId);
    if (error) return { error: `Could not verify administrator access: ${error.message}` };
    if (!count) return { error: "You cannot remove the last active administrator." };
  }

  const requestedRoleIds = userSide === "employee"
    ? [...new Set(formData.getAll("role_ids").map((raw) => Number(raw)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  if (userSide === "employee" && requestedRoleIds.length === 0) {
    return { error: "Assign at least one employee role." };
  }

  if (requestedRoleIds.length > 0) {
    const { data: roles, error } = await context.adminClient
      .from("roles")
      .select("id, name")
      .in("id", requestedRoleIds)
      .in("name", ["Coordinator", "Personnel", "Manager"]);
    if (error) return { error: `Could not verify employee roles: ${error.message}` };
    if ((roles?.length ?? 0) !== requestedRoleIds.length) {
      return { error: "One or more selected employee roles are invalid." };
    }
  }

  if (requestedRoleIds.length > 0) {
    const { error } = await context.adminClient.from("user_roles").upsert(
      requestedRoleIds.map((roleId) => ({ user_id: userId, role_id: roleId })),
      { onConflict: "user_id,role_id", ignoreDuplicates: true }
    );
    if (error) return { error: `Could not assign employee roles: ${error.message}` };
  }

  const { error: profileError } = await context.adminClient
    .from("profiles")
    .update({ user_side: userSide, service_team_id: serviceTeamId })
    .eq("id", userId);
  if (profileError) return { error: `Could not update account type: ${profileError.message}` };

  let roleDelete = context.adminClient.from("user_roles").delete().eq("user_id", userId);
  if (requestedRoleIds.length > 0) {
    roleDelete = roleDelete.not("role_id", "in", `(${requestedRoleIds.join(",")})`);
  }
  const { error: roleError } = await roleDelete;
  if (roleError) {
    return { error: `Account type was updated, but employee roles could not be synchronized: ${roleError.message}` };
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  return { success: "Account details updated." };
}

async function setManagedUserStatus(formData: FormData, status: "active" | "inactive") {
  const context = await getAdminMutationContext();
  if ("error" in context) return context;

  const userId = value(formData, "user_id");
  if (!isUuid(userId)) return { error: "Choose a valid account." };
  if (userId === context.actorId && status === "inactive") {
    return { error: "You cannot deactivate your own administrator account." };
  }

  const { data: target, error: targetError } = await context.adminClient
    .from("profiles")
    .select("id, user_side, status")
    .eq("id", userId)
    .maybeSingle();
  if (targetError || !target) return { error: "That account could not be found." };

  if (status === "inactive" && target.user_side === "admin" && target.status === "active") {
    const { count, error } = await context.adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_side", "admin")
      .eq("status", "active")
      .neq("id", userId);
    if (error) return { error: `Could not verify administrator access: ${error.message}` };
    if (!count) return { error: "You cannot deactivate the last active administrator." };
  }

  const { error } = await context.adminClient
    .from("profiles")
    .update({ status })
    .eq("id", userId);
  if (error) return { error: `Could not ${status === "active" ? "restore" : "deactivate"} account: ${error.message}` };

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  return { success: status === "active" ? "Account access restored." : "Account deactivated." };
}

export async function deactivateUser(formData: FormData) {
  return setManagedUserStatus(formData, "inactive");
}

export async function reactivateUser(formData: FormData) {
  return setManagedUserStatus(formData, "active");
}

export async function createTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Please sign in before submitting a ticket." };

  const { data: requesterProfile, error: profileError } = await supabase
    .from("profiles")
    .select("status, user_side")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { error: `Could not verify your support profile: ${profileError.message}` };
  }
  if (!requesterProfile) {
    return {
      error: "Your account is missing its support profile. Ask an administrator to run the latest Supabase migrations."
    };
  }
  if (requesterProfile.status !== "active") {
    return { error: "This account is archived. Contact an administrator to restore access." };
  }
  if (requesterProfile.user_side !== "client") {
    return { error: "Only end users can submit support tickets." };
  }

  const { data: currentSide, error: currentSideError } =
    await supabase.rpc("current_side");
  if (currentSideError) {
    return {
      error: `Could not verify your database access role: ${currentSideError.message}`
    };
  }
  if (!currentSide) {
    return {
      error: `Supabase does not recognize this account as active (profile status: ${requesterProfile.status}, account type: ${requesterProfile.user_side}). Sign out and back in; if this continues, ask an administrator to verify the profile and tickets INSERT policy.`
    };
  }

  const title = value(formData, "title");
  const description = value(formData, "description");
  const teamSlug = value(formData, "service_team_slug") ?? "it-support";
  const requestedType = value(formData, "request_type") ?? "general";
  const requestTypes = ["general", "access_request", "incident_report"] as const;
  const requestType = requestTypes.find((option) => option === requestedType);
  const impacts: TicketImpact[] = ["low", "medium", "high"];
  const urgencies: TicketUrgency[] = ["low", "medium", "high"];
  const impact = impacts.find((option) => option === value(formData, "impact"));
  const urgency = urgencies.find((option) => option === value(formData, "urgency"));

  if (!title || !description) {
    return { error: "Enter a title and details for your request." };
  }
  if (title.length > 200 || description.length > 10000) {
    return { error: "Keep the title to 200 characters and the request details to 10,000 characters or fewer." };
  }
  if (!requestType) return { error: "Choose a valid request type." };
  if (!impact || !urgency) return { error: "Choose a valid impact and urgency." };
  const priority = calculateTicketPriority(impact, urgency);

  const { data: serviceTeam, error: teamError } = await supabase.from("service_teams")
    .select("id, slug, is_in_scope, is_active")
    .eq("slug", teamSlug).maybeSingle();
  if (teamError || !serviceTeam?.is_active || !serviceTeam.is_in_scope) {
    return { error: "Choose an active service team." };
  }
  if (serviceTeam.slug !== "it-support") {
    return { error: "Cost Control Group ticket submission will be available when its workflow is defined." };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title,
      description,
      requester_id: user.id,
      service_team_id: serviceTeam.id,
      request_type: requestType,
      impact,
      urgency,
      is_confidential: formData.get("is_confidential") === "on",
      priority,
      status: "open"
    })
    .select("id")
    .single();

  if (error || !ticket) {
    if (error?.code === "42501") {
      return {
        error: `Supabase rejected ticket creation with row-level security even though the INSERT checks passed (database role: ${currentSide}, profile status: ${requesterProfile.status}, account type: ${requesterProfile.user_side}, requester: authenticated user, status: open, assignee: unassigned). Apply the latest ticket requester read-policy migration, then retry.`
      };
    }
    return { error: error?.message ?? "The ticket could not be created." };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ticketId: String(ticket.id), userId: user.id };
}

export async function linkRelatedTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to link related tickets." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (actor.profile.user_side === "client") {
    return { error: "Only staff can link related tickets." };
  }

  const ticketId = value(formData, "ticket_id");
  const ticketNumber = value(formData, "related_ticket_no")?.toUpperCase();
  if (!ticketId || !/^\d+$/.test(ticketId) || !ticketNumber || ticketNumber.length > 40) {
    return { error: "Enter a valid ticket number." };
  }
  const { data: currentTicket, error: currentError } = await supabase
    .from("tickets").select("id").eq("id", ticketId).maybeSingle();
  if (currentError) return { error: currentError.message };
  if (!currentTicket) return { error: "You cannot access this ticket." };

  const { data: relatedTicket, error: relatedError } = await supabase
    .from("tickets").select("id").eq("ticket_no", ticketNumber).maybeSingle();
  if (relatedError) return { error: relatedError.message };
  if (!relatedTicket) return { error: "That ticket was not found or you do not have access to it." };
  if (Number(relatedTicket.id) === Number(ticketId)) {
    return { error: "A ticket cannot be linked to itself." };
  }

  const smallerId = Math.min(Number(ticketId), Number(relatedTicket.id));
  const largerId = Math.max(Number(ticketId), Number(relatedTicket.id));
  const { error } = await supabase.from("ticket_links").insert({
    ticket_id: smallerId,
    related_ticket_id: largerId,
    created_by: user.id
  });
  if (error?.code === "23505") return { error: "These tickets are already linked." };
  if (error) return { error: `Could not link these tickets: ${error.message}` };

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/${relatedTicket.id}`);
  return { success: "Related ticket linked." };
}

export async function unlinkRelatedTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to unlink tickets." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (actor.profile.user_side === "client") return { error: "Only staff can unlink tickets." };

  const ticketId = value(formData, "ticket_id");
  const relatedTicketId = value(formData, "related_ticket_id");
  if (!ticketId || !/^\d+$/.test(ticketId) || !relatedTicketId || !/^\d+$/.test(relatedTicketId) || ticketId === relatedTicketId) {
    return { error: "Choose a valid related ticket." };
  }

  const smallerId = Math.min(Number(ticketId), Number(relatedTicketId));
  const largerId = Math.max(Number(ticketId), Number(relatedTicketId));
  const { data, error } = await supabase.from("ticket_links")
    .delete()
    .eq("ticket_id", smallerId)
    .eq("related_ticket_id", largerId)
    .select("ticket_id")
    .maybeSingle();
  if (error) return { error: `Could not unlink these tickets: ${error.message}` };
  if (!data) return { error: "The ticket link was not found or you do not have access to both tickets." };

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/${relatedTicketId}`);
  return { success: "Ticket link removed." };
}

export async function addComment(formData: FormData) {
  const supabase = await createClient();
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
  if (body.length > 5000) return { error: "Comments must be 5,000 characters or fewer." };

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

export async function submitTicketFeedback(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to rate this support experience." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (actor.profile.user_side !== "client") {
    return { error: "Only the ticket requester can submit feedback." };
  }

  const ticketId = value(formData, "ticket_id");
  const rawRating = value(formData, "rating");
  const comment = value(formData, "comment");
  const rating = rawRating && /^[1-5]$/.test(rawRating) ? Number(rawRating) : null;
  if (!ticketId || !/^\d+$/.test(ticketId) || !Number.isSafeInteger(Number(ticketId)) || !rating) {
    return { error: "Choose a rating from 1 to 5." };
  }
  if (comment && comment.length > 1000) {
    return { error: "Feedback must be 1,000 characters or fewer." };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("requester_id", user.id)
    .in("status", ["resolved", "closed"])
    .maybeSingle();
  if (ticketError) return { error: ticketError.message };
  if (!ticket) return { error: "Only your own resolved ticket can be rated." };

  const { error } = await supabase.from("ticket_feedback").insert({
    ticket_id: Number(ticketId),
    requester_id: user.id,
    rating,
    comment
  });
  if (error) {
    if (error.code === "23505") return { error: "Feedback has already been submitted for this ticket." };
    return { error: `Feedback could not be submitted: ${error.message}` };
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/reports");
  return { success: "Thank you. Your feedback has been submitted." };
}

export async function updateTicketStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update this ticket." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;

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

  if (actor.profile.user_side === "client") {
    if (status !== "closed") return { error: "Clients can only confirm completion of their own resolved tickets." };
    const { data: closed, error } = await supabase.rpc("close_own_resolved_ticket", {
      p_ticket_id: Number(ticketId)
    });
    if (error) return { error: error.message };
    if (closed !== true) return { error: "Only your own resolved ticket can be closed." };
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath("/tickets");
    revalidatePath("/dashboard");
    revalidatePath("/inbox");
    return { success: "Ticket marked as complete." };
  }
  if (
    actor.profile.user_side !== "admin" &&
    !actor.roles.includes("Personnel")
  ) {
    return { error: "Only Personnel or administrators can update ticket status." };
  }

  const update: { status: TicketStatus; resolution_notes?: string; resolved_at?: string | null } = { status };
  if (status === "resolved") update.resolved_at = new Date().toISOString();
  else update.resolved_at = null;
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
  revalidatePath("/inbox");
  return { success: "Ticket status updated." };
}

export async function routeTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to route this ticket." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (
    actor.profile.user_side !== "admin" &&
    !actor.roles.includes("Coordinator")
  ) {
    return { error: "Only Coordinators or administrators can route tickets." };
  }

  const ticketId = value(formData, "ticket_id");
  const impacts: TicketImpact[] = ["low", "medium", "high"];
  const urgencies: TicketUrgency[] = ["low", "medium", "high"];
  const impact = impacts.find((option) => option === value(formData, "impact"));
  const urgency = urgencies.find((option) => option === value(formData, "urgency"));
  const priority = impact && urgency ? calculateTicketPriority(impact, urgency) : null;
  const assignedTo = value(formData, "assigned_to");
  const dueDate = value(formData, "due_date") || null;
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

  if (!ticketId || !priority || !impact || !urgency || !status) {
    return { error: "Choose valid impact, urgency, assignee, and status values." };
  }
  if (["resolved", "closed", "rejected"].includes(status)) {
    return { error: "Routing cannot resolve, close, or reject a ticket. Use the ticket status action." };
  }
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))) {
    return { error: "Choose a valid due date." };
  }

  const { data: currentTicket, error: ticketError } = await supabase.from("tickets")
    .select("service_team_id").eq("id", ticketId).maybeSingle();
  if (ticketError) return { error: ticketError.message };
  if (!currentTicket) return { error: "You cannot access this ticket." };
  if (actor.profile.user_side === "employee" && actor.profile.service_team_id !== currentTicket.service_team_id) {
    return { error: "You can only assign tickets for your service team." };
  }

  if (assignedTo) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedTo)
      .eq("user_side", "employee")
      .eq("status", "active")
      .eq("service_team_id", currentTicket.service_team_id)
      .maybeSingle();

    if (!assignee) return { error: "Choose an active employee as the assignee." };
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({
      priority,
      impact,
      urgency,
      assigned_to: assignedTo,
      due_date: dueDate,
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null
    })
    .eq("id", ticketId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "You do not have permission to route this ticket." };

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/queue");
  revalidatePath("/inbox");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { success: "Ticket routing and assignment saved." };
}

export async function bulkUpdateTickets(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update tickets." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;

  const ids = Array.from(new Set(formData.getAll("ticket_ids")
    .filter((id): id is string => typeof id === "string" && /^\d+$/.test(id))));
  if (ids.length === 0 || ids.length > 50) return { error: "Select between 1 and 50 tickets." };
  const operation = value(formData, "operation");
  const patch: { assigned_to?: string | null; status?: TicketStatus; resolved_at?: string | null } = {};

  if (operation === "assign") {
    if (actor.profile.user_side !== "admin" && !actor.roles.includes("Coordinator")) {
      return { error: "Only Coordinators or administrators can bulk assign tickets." };
    }
    const assigneeId = value(formData, "assigned_to");
    if (assigneeId) {
      const { data: currentTickets, error: ticketsError } = await supabase.from("tickets")
        .select("id, service_team_id").in("id", ids);
      if (ticketsError) return { error: ticketsError.message };
      if ((currentTickets ?? []).length !== ids.length) return { error: "Some selected tickets are unavailable to you." };
      const teamIds = new Set((currentTickets ?? []).map((ticket) => ticket.service_team_id));
      if (teamIds.size !== 1 || teamIds.has(null)) return { error: "Assign tickets from one service team at a time." };
      const serviceTeamId = [...teamIds][0];
      if (actor.profile.user_side === "employee" && actor.profile.service_team_id !== serviceTeamId) {
        return { error: "You can only assign tickets for your service team." };
      }
      const { data: assignee } = await supabase.from("profiles").select("id")
        .eq("id", assigneeId).eq("user_side", "employee").eq("status", "active")
        .eq("service_team_id", serviceTeamId).maybeSingle();
      if (!assignee) return { error: "Choose an active employee as the assignee." };
    }
    patch.assigned_to = assigneeId;
  } else if (operation === "status") {
    if (actor.profile.user_side !== "admin" && !actor.roles.includes("Personnel")) {
      return { error: "Only Personnel or administrators can bulk update status." };
    }
    const status = value(formData, "status");
    if (!status || !["under_review", "assigned", "in_progress", "waiting_for_info", "resolved"].includes(status)) {
      return { error: "Choose a supported active ticket status." };
    }
    patch.status = status as TicketStatus;
    patch.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  } else return { error: "Choose an assignment or status action." };

  const { data, error } = await supabase.from("tickets").update(patch).in("id", ids).select("id");
  if (error) return { error: error.message };
  if ((data ?? []).length !== ids.length) return { error: `Updated ${data?.length ?? 0} of ${ids.length} selected tickets. Some may be outside your permissions.` };
  revalidatePath("/inbox");
  revalidatePath("/tickets");
  revalidatePath("/queue");
  revalidatePath("/dashboard");
  return { success: `Updated ${ids.length} tickets.` };
}

export async function saveTicketSlaPolicies(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as an administrator to manage SLA targets." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (actor.profile.user_side !== "admin") return { error: "Only administrators can manage SLA targets." };

  const priorityGroups = ["high", "standard"] as const;
  const policies = priorityGroups.map((priority_group) => {
    const response = Number(value(formData, `response_${priority_group}`));
    const resolution = Number(value(formData, `resolution_${priority_group}`));
    return { priority_group, first_response_business_days: response, resolution_business_days: resolution, updated_at: new Date().toISOString() };
  });
  if (policies.some((policy) => !Number.isInteger(policy.first_response_business_days) || policy.first_response_business_days < 1 || policy.first_response_business_days > 365 || !Number.isInteger(policy.resolution_business_days) || policy.resolution_business_days < 1 || policy.resolution_business_days > 365)) {
    return { error: "Enter whole business-day targets between 1 and 365 for both priority groups." };
  }
  const { error } = await supabase.from("ticket_sla_policies").upsert(policies, { onConflict: "priority_group" });
  if (error) return { error: error.message };
  revalidatePath("/admin/sla");
  revalidatePath("/inbox");
  return { success: "SLA targets saved." };
}

export async function handoffTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to hand off this ticket." };
  const actor = await getActiveTicketActor(supabase, user.id);
  if ("error" in actor) return actor;
  if (actor.profile.user_side !== "admin" && !actor.roles.includes("Coordinator")) {
    return { error: "Only Coordinators or administrators can hand off tickets." };
  }
  const ticketId = value(formData, "ticket_id");
  const assignedTo = value(formData, "assigned_to");
  const note = value(formData, "note");
  if (!ticketId || !/^\d+$/.test(ticketId)) return { error: "Choose a valid ticket." };
  if (!note || note.length < 5 || note.length > 2000) return { error: "Handoff notes must be between 5 and 2,000 characters." };
  const { error } = await supabase.rpc("create_ticket_handoff", {
    p_ticket_id: Number(ticketId),
    p_assigned_to: assignedTo,
    p_note: note
  });
  if (error) return { error: error.message };
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/inbox");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { success: "Ticket handed off with a staff-only note." };
}

export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update notifications." };

  const notificationId = value(formData, "notification_id");
  if (!notificationId || !/^\d+$/.test(notificationId)) {
    return { error: "Choose a valid notification." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { error: `The notification could not be marked as read: ${error.message}` };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update notifications." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) return { error: `Notifications could not be marked as read: ${error.message}` };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveNotificationPreferences(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update notification preferences." };

  const allowedTypes = ["ticket_submitted", "ticket_assigned", "ticket_updated"] as const;
  const enabledTypes = new Set(formData.getAll("enabled_types").filter((item): item is string => typeof item === "string"));
  if ([...enabledTypes].some((type) => !allowedTypes.includes(type as typeof allowedTypes[number]))) {
    return { error: "One or more notification options are invalid." };
  }

  const { error } = await supabase.from("notification_preferences").upsert(
    allowedTypes.map((notification_type) => ({
      user_id: user.id,
      notification_type,
      enabled: enabledTypes.has(notification_type),
      updated_at: new Date().toISOString()
    })),
    { onConflict: "user_id,notification_type" }
  );
  if (error) return { error: `Notification preferences could not be saved: ${error.message}` };

  revalidatePath("/settings");
  revalidatePath("/notifications");
  return { success: "Notification preferences saved." };
}

export async function saveFaq(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage FAQs." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status, service_team_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!actor || actor.status !== "active") return { error: "An active account is required to manage FAQs." };
  let serviceTeamId: number | null = null;
  if (actor.user_side === "employee") {
    if (!actor.service_team_id) return { error: "Your account is not assigned to an FAQ-enabled service team." };
    const { data: team } = await supabase.from("service_teams")
      .select("id").eq("id", actor.service_team_id).eq("is_active", true)
      .in("slug", ["it-support", "cost-control"]).maybeSingle();
    if (!team) return { error: "Only IT Support and Cost Control Group providers can manage FAQs." };
    serviceTeamId = team.id;
  } else if (actor.user_side !== "admin") {
    return { error: "Only administrators and IT Support or Cost Control Group providers can manage FAQs." };
  }

  const id = value(formData, "faq_id");
  const question = value(formData, "question");
  const answer = value(formData, "answer");
  const displayOrderRaw = value(formData, "display_order") ?? "0";
  const displayOrder = Number(displayOrderRaw);
  if ((id && !/^\d+$/.test(id)) || !question || !answer) {
    return { error: "Enter a question and answer." };
  }
  if (question.length > 300 || answer.length > 5000) {
    return { error: "Questions are limited to 300 characters and answers to 5000 characters." };
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) {
    return { error: "Display order must be a whole number from 0 to 10000." };
  }

  const entry = {
    question,
    answer,
    display_order: displayOrder,
    is_published: formData.get("is_published") === "on"
  };
  let result;
  if (id) {
    let query = supabase.from("faq_entries").update(entry).eq("id", Number(id));
    if (serviceTeamId !== null) query = query.eq("service_team_id", serviceTeamId);
    result = await query.select("id").maybeSingle();
  } else {
    result = await supabase.from("faq_entries").insert({ ...entry, service_team_id: serviceTeamId }).select("id").single();
  }

  if (result.error) return { error: `FAQ could not be saved: ${result.error.message}` };
  if (!result.data) return { error: "The FAQ was not found or could not be saved." };

  revalidatePath("/faqs");
  revalidatePath("/admin/faqs");
  return { success: id ? "FAQ updated." : "FAQ added." };
}

export async function deleteFaq(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage FAQs." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("user_side, status, service_team_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!actor || actor.status !== "active") return { error: "An active account is required to manage FAQs." };
  let serviceTeamId: number | null = null;
  if (actor.user_side === "employee") {
    if (!actor.service_team_id) return { error: "Your account is not assigned to an FAQ-enabled service team." };
    const { data: team } = await supabase.from("service_teams")
      .select("id").eq("id", actor.service_team_id).eq("is_active", true)
      .in("slug", ["it-support", "cost-control"]).maybeSingle();
    if (!team) return { error: "Only IT Support and Cost Control Group providers can manage FAQs." };
    serviceTeamId = team.id;
  } else if (actor.user_side !== "admin") {
    return { error: "Only administrators and IT Support or Cost Control Group providers can manage FAQs." };
  }

  const id = value(formData, "faq_id");
  if (!id || !/^\d+$/.test(id)) return { error: "Choose a valid FAQ." };

  let query = supabase.from("faq_entries").delete().eq("id", Number(id));
  if (serviceTeamId !== null) query = query.eq("service_team_id", serviceTeamId);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { error: `FAQ could not be deleted: ${error.message}` };
  if (!data) return { error: "The FAQ was not found or could not be deleted." };

  revalidatePath("/faqs");
  revalidatePath("/admin/faqs");
  return { success: "FAQ deleted." };
}
