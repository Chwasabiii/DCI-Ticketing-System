import { redirect } from "next/navigation";
import { ProjectManagement } from "@/components/admin/project-management";
import { getCurrentContext } from "@/lib/data";
import type { Profile, Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const { profile } = await getCurrentContext();
  if (profile?.user_side !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [projectsResult, approversResult, peopleResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, project_code, name, location, status, pm_user_id")
      .order("name")
      .returns<Project[]>(),
    supabase
      .from("project_approvers")
      .select("project_id, user_id")
      .returns<Array<{ project_id: number; user_id: string }>>(),
    supabase
      .from("profiles")
      .select("id, full_name, email, user_side, status")
      .eq("status", "active")
      .order("full_name")
      .returns<Profile[]>()
  ]);
  if (projectsResult.error) throw new Error(`Could not load projects: ${projectsResult.error.message}`);
  if (approversResult.error) throw new Error(`Could not load project approvers: ${approversResult.error.message}`);
  if (peopleResult.error) throw new Error(`Could not load active profiles: ${peopleResult.error.message}`);

  const approversByProject = new Map<string, string[]>();
  for (const approver of approversResult.data ?? []) {
    const projectId = String(approver.project_id);
    approversByProject.set(projectId, [
      ...(approversByProject.get(projectId) ?? []),
      approver.user_id
    ]);
  }
  const projects = (projectsResult.data ?? []).map((project) => ({
    ...project,
    approver_ids: approversByProject.get(String(project.id)) ?? []
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">Project Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep the PMSG project list up to date for clients and employees.
        </p>
      </header>
      <ProjectManagement projects={projects} people={peopleResult.data ?? []} />
    </div>
  );
}
