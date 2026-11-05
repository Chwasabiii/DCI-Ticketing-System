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
    && (profile.service_team?.slug === "it-support" || profile.service_team?.slug === "cost-control");
  if (!isAdmin && !isFaqProvider) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let query = supabase
    .from("faq_entries")
    .select("id, service_team_id, question, answer, display_order, is_published, updated_at")
  if (isFaqProvider) query = query.eq("service_team_id", profile.service_team_id!);
  const { data, error } = await query.order("display_order").order("id").returns<FaqEntry[]>();

  if (error) throw new Error(`Could not load FAQs: ${error.message}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-navy">FAQ management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Write and publish help answers for signed-in users.
        </p>
      </header>
      <FaqManagement entries={data} />
    </div>
  );
}
