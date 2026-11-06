import { redirect } from "next/navigation";
import { FaqManagement } from "@/components/admin/faq-management";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/data";
import type { FaqEntry } from "@/lib/types";

export default async function AdminFaqsPage() {
  const { profile } = await getCurrentContext();
  const isAdmin = profile?.user_side === "admin" && profile.status === "active";
  const isFaqProvider = profile?.user_side === "employee"
    && profile.status === "active"
    && ["it-support", "cost-control", "software-csr"].includes(profile.service_team?.slug ?? "");
  if (!isAdmin && !isFaqProvider) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let query = supabase
    .from("faq_entries")
    .select("id, service_team_id, source_ticket_id, question, answer, display_order, is_published, updated_at")
  if (isFaqProvider) query = query.eq("service_team_id", profile.service_team_id!);
  const { data, error } = await query.order("display_order").order("id").returns<FaqEntry[]>();

  if (error) throw new Error(`Could not load FAQs: ${error.message}`);

  let resolvedQuery = supabase
    .from("tickets")
    .select("id, ticket_no, title, status, resolution_notes, service_team_id, resolved_at")
    .in("status", ["resolved", "closed"])
    .eq("is_confidential", false)
    .not("resolution_notes", "is", null)
    .order("resolved_at", { ascending: false });
  if (isFaqProvider) resolvedQuery = resolvedQuery.eq("service_team_id", profile.service_team_id!);
  const { data: resolvedTickets, error: resolvedError } = await resolvedQuery;
  if (resolvedError) throw new Error(`Could not load resolved tickets: ${resolvedError.message}`);

  const existingSourceIds = new Set(data.flatMap((entry) => entry.source_ticket_id ? [entry.source_ticket_id] : []));
  const availableTickets = (resolvedTickets ?? [])
    .filter((ticket) => ticket.resolution_notes?.trim() && !existingSourceIds.has(ticket.id))
    .map((ticket) => ({
      id: ticket.id,
      ticket_no: ticket.ticket_no,
      title: ticket.title,
      resolution_notes: ticket.resolution_notes ?? "",
      resolved_at: ticket.resolved_at
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-navy">FAQ management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Write and publish help answers for signed-in users.
        </p>
      </header>
      <FaqManagement entries={data} resolvedTickets={availableTickets} />
    </div>
  );
}
