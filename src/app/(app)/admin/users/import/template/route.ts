import { createBulkUserTemplate } from "@/lib/bulk-user-import-server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return new Response("Sign in as an administrator to download the template.", { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.user_side !== "admin" || profile.status !== "active") {
    return new Response("Only active administrators can download the template.", { status: 403 });
  }

  const [teamResult, roleResult] = await Promise.all([
    supabase.from("service_teams")
      .select("id, name, slug, is_in_scope, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase.from("roles")
      .select("id, name")
      .in("name", ["Coordinator", "Personnel", "Manager"])
      .order("name")
  ]);
  if (teamResult.error || roleResult.error) {
    const reason = teamResult.error?.message ?? roleResult.error?.message ?? "No details available.";
    return new Response(`Could not load the current import options: ${reason}`, { status: 500 });
  }

  try {
    const file = await createBulkUserTemplate(
      teamResult.data ?? [],
      (roleResult.data ?? []).map((role) => role.name)
    );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="pmsg-desk-users-template.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The workbook could not be generated.";
    return new Response(`Could not generate the import template: ${reason}`, { status: 500 });
  }
}
