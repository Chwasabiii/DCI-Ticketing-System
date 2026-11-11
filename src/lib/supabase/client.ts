"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/env";
import { createTimedSupabaseFetch } from "@/lib/supabase/timing";

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey, {
    global: {
      fetch: createTimedSupabaseFetch(() => window.location.pathname)
    }
  });
}
