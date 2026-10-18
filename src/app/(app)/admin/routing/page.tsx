import { redirect } from "next/navigation";
import { RoutingRulesManagement } from "@/components/admin/routing-rules-management";
import { getCategories, getCurrentContext, getDisciplines } from "@/lib/data";
import type { Profile, Project, TicketRoutingRule } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function RoutingRulesPage() {
  const [{ profile }, categories, disciplines] = await Promise.all([
    getCurrentContext(),
    getCategories(),
    getDisciplines()
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");

  const supabase = await createClient();
  const [rulesResult, projectsResult, employeesResult] = await Promise.all([
    supabase.from("ticket_routing_rules")
      .select("id, name, project_id, category_id, request_type, discipline_id, assigned_to, rule_priority, is_active")
      .order("rule_priority")
      .order("id")
      .returns<TicketRoutingRule[]>(),
    supabase.from("projects")
      .select("id, project_code, name, location, status, pm_user_id")
      .order("name")
      .returns<Project[]>(),
    supabase.from("profiles")
      .select("id, full_name, email, user_side, status")
      .eq("user_side", "employee")
      .order("full_name")
      .returns<Profile[]>()
  ]);
  if (rulesResult.error) throw new Error(`Could not load routing rules: ${rulesResult.error.message}`);
  if (projectsResult.error) throw new Error(`Could not load projects: ${projectsResult.error.message}`);
  if (employeesResult.error) throw new Error(`Could not load employees: ${employeesResult.error.message}`);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Administration</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Automatic routing</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Automatically route new tickets using project, category, or request type. Tickets without a matching rule remain unassigned in the triage inbox.
        </p>
      </header>
      <RoutingRulesManagement
        rules={rulesResult.data ?? []}
        projects={projectsResult.data ?? []}
        categories={categories}
        disciplines={disciplines}
        employees={employeesResult.data ?? []}
      />
    </div>
  );
}
