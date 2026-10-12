import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateNoCacheHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie"
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to load ticket options." },
      { status: 401, headers: privateNoCacheHeaders }
    );
  }

  const [categoriesResult, disciplinesResult, departmentsResult, projectsResult] = await Promise.all([
    supabase.from("categories").select("id, name, discipline_id").order("name"),
    supabase.from("disciplines").select("id, name, lead_user_id").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("projects").select("id, project_code, name, location").order("name")
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

  return NextResponse.json(
    {
      categories: categoriesResult.data ?? [],
      disciplines: disciplinesResult.data ?? [],
      departments: departmentsResult.data ?? [],
      projects: projectsResult.data ?? []
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        Vary: "Cookie"
      }
    }
  );
}