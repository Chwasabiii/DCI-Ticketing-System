import { redirect } from "next/navigation";
import { ProjectManagement } from "@/components/admin/project-management";
import { getCurrentContext } from "@/lib/data";
import type { Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const { profile } = await getCurrentContext();
  if (profile?.user_side !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_code, name, location, status")
    .order("name")
    .returns<Project[]>();
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Project Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep the PMSG project list up to date for clients and employees.
        </p>
      </header>
      <ProjectManagement projects={data ?? []} />
    </div>
  );
}
