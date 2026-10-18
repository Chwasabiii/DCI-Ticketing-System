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
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to load ticket options." },
      { status: 401, headers: privateNoCacheHeaders }
    );
  }

  const [
    categoriesResult,
    disciplinesResult,
    departmentsResult,
    projectsResult
  ] = await Promise.all([
    supabase.from("categories").select("id, name, discipline_id").order("name"),
    supabase.from("disciplines").select("id, name, lead_user_id").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase
      .from("projects")
      .select("id, project_code, name, location, status, pm_user_id")
      .in("status", ["planned", "ongoing"])
      .order("name")
  ]);

  if (
    categoriesResult.error ||
    disciplinesResult.error ||
    departmentsResult.error ||
    projectsResult.error
  ) {
    return NextResponse.json(
      { error: "Could not load ticket options." },
      { status: 503, headers: privateNoCacheHeaders }
    );
  }

  const eligibleProjects = await Promise.all((projectsResult.data ?? []).map(async (project) => {
    const { data: eligible, error } = await supabase.rpc("project_has_active_approver", {
      p_project_id: project.id
    });
    return { project, eligible, error };
  }));
  if (eligibleProjects.some((result) => result.error)) {
    return NextResponse.json(
      { error: "Could not verify project approvers." },
      { status: 503, headers: privateNoCacheHeaders }
    );
  }
  const projects = eligibleProjects
    .filter((result) => result.eligible)
    .map(({ project: { pm_user_id: _pmUserId, ...project } }) => project);

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
