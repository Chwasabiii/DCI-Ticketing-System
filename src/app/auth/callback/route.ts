import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = getSafeNextPath(url.searchParams.get("next"));

  if (tokenHash && type === "invite") {
    const acceptUrl = new URL("/accept-invitation", request.url);
    acceptUrl.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(acceptUrl);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/accept-invitation?error=invalid_invitation", request.url)
  );
}
