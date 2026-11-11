import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerTimedFetch } from "@/lib/supabase/timing.server";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Server configuration is missing the Supabase service role key.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: { fetch: getServerTimedFetch() }
  });
}