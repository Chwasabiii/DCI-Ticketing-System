"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTicket(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const title = value(formData, "title");
  const description = value(formData, "description");

  if (!title || !description) return;

  await supabase.from("tickets").insert({
    title,
    description,
    requester_id: user.id,
    category_id: value(formData, "category_id"),
    discipline_id: value(formData, "discipline_id"),
    priority: "medium",
    status: "open"
  });

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect("/tickets");
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

  if (!ticketId || !body) return;

  await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: user.id,
    body,
    is_internal: isInternal
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateTicketStatus(formData: FormData) {
  const supabase = createClient();
  const ticketId = value(formData, "ticket_id");
  const status = value(formData, "status");

  if (!ticketId || !status) return;

  await supabase.from("tickets").update({ status }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/dashboard");
}

export async function routeTicket(formData: FormData) {
  const supabase = createClient();
  const ticketId = value(formData, "ticket_id");

  if (!ticketId) return;

  await supabase
    .from("tickets")
    .update({
      priority: value(formData, "priority"),
      discipline_id: value(formData, "discipline_id"),
      assigned_to: value(formData, "assigned_to"),
      status: value(formData, "status") ?? "assigned"
    })
    .eq("id", ticketId);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/queue");
}
