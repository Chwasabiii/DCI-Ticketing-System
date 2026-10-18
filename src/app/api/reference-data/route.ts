import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateNoCacheHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie"
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to load ticket options." },
      { status: 401, headers: privateNoCacheHeaders }
    );
  }

  const [
    categoriesResult,
    disciplinesResult,
    departmentsResult,
    projectsResult,
    projectApproversResult,
    activeProfilesResult
  ] = await Promise.all([
    supabase.from("categories").select("id, name, discipline_id").order("name"),
    supabase.from("disciplines").select("id, name, lead_user_id").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase
      .from("projects")
      .select("id, project_code, name, location, status, pm_user_id")
      .in("status", ["planned", "ongoing"])
      .order("name"),
    supabase.from("project_approvers").select("project_id, user_id"),
    supabase.from("profiles").select("id").eq("status", "active")
  ]);

  if (
    categoriesResult.error ||
    disciplinesResult.error ||
    departmentsResult.error ||
    projectsResult.error ||
    projectApproversResult.error ||
    activeProfilesResult.error
  ) {
    return NextResponse.json(
      { error: "Could not load ticket options." },
      { status: 503, headers: privateNoCacheHeaders }
    );
  }

  const activeIds = new Set((activeProfilesResult.data ?? []).map((profile) => profile.id));
  const activeApproverProjectIds = new Set(
    (projectApproversResult.data ?? [])
      .filter((approver) => activeIds.has(approver.user_id))
      .map((approver) => String(approver.project_id))
  );
  const projects = (projectsResult.data ?? [])
    .filter((project) =>
      (project.pm_user_id !== null && activeIds.has(project.pm_user_id)) ||
      activeApproverProjectIds.has(String(project.id))
    )
    .map(({ pm_user_id: _pmUserId, ...project }) => project);

  return NextResponse.json(
    {
      categories: categoriesResult.data ?? [],
      disciplines: disciplinesResult.data ?? [],
      departments: departmentsResult.data ?? [],
      projects
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        Vary: "Cookie"
      }
    }
  );
}