import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to check for similar tickets." }, { status: 401, headers: noStore });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
  }

  const body = payload as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const projectId = typeof body.projectId === "string" && /^\d+$/.test(body.projectId)
    ? Number(body.projectId)
    : null;

  if (title.length < 8 || title.length > 200 || description.length > 10000) {
    return NextResponse.json({ tickets: [] }, { headers: noStore });
  }

  const { data, error } = await supabase.rpc("find_similar_open_tickets", {
    p_title: title,
    p_description: description,
    p_project_id: projectId
  });
  if (error) {
    return NextResponse.json({ error: "Similar tickets could not be checked." }, { status: 503, headers: noStore });
  }

  return NextResponse.json({ tickets: data ?? [] }, { headers: noStore });
}
