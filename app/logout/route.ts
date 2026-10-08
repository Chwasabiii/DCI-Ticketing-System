import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
