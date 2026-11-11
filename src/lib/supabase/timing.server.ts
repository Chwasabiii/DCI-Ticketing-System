import "server-only";
import { headers } from "next/headers";
import { createTimedSupabaseFetch } from "@/lib/supabase/timing";

async function getRequestRoute() {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-performance-route")
      ?? requestHeaders.get("x-invoke-path")
      ?? "server";
  } catch {
    return "server";
  }
}

export function getServerTimedFetch() {
  return createTimedSupabaseFetch(getRequestRoute);
}
