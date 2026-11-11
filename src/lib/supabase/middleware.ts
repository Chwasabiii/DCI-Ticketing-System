import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createTimedSupabaseFetch, sanitizeTimingRoute } from "@/lib/supabase/timing";

export async function updateSession(request: NextRequest) {
  const buildResponse = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-performance-route", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };
  let response = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = buildResponse();
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = buildResponse();
          response.cookies.set({ name, value: "", ...options });
        }
      },
      global: {
        fetch: createTimedSupabaseFetch(() => request.nextUrl.pathname)
      }
    }
  );

  const authStartedAt = performance.now();
  const { data, error } = await supabase.auth.getClaims();
  const authDurationMs = Math.round(performance.now() - authStartedAt);
  console.log(
    `[supabase-timing] route=${sanitizeTimingRoute(request.nextUrl.pathname)} query=middleware.auth-check duration_ms=${authDurationMs}${authDurationMs > 200 ? " SLOW" : ""}`
  );
  const claims = data?.claims;
  const isAuthenticated = !error && typeof claims?.sub === "string";

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublic =
    isAuthRoute ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname === "/accept-invitation" ||
    request.nextUrl.pathname === "/account-archived";

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
