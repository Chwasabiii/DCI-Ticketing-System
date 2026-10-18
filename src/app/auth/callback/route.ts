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
  const authError = url.searchParams.get("error");
  const authErrorCode = url.searchParams.get("error_code");

  if (authError || authErrorCode) {
    const reason =
      authErrorCode === "otp_expired" || authErrorCode === "email_not_confirmed"
        ? "expired"
        : "invalid";
    return NextResponse.redirect(
      new URL(`/accept-invitation?reason=${reason}`, request.url)
    );
  }

  if (tokenHash && type === "invite") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite"
    });
    if (error) {
      const reason = error.code === "otp_expired" ? "expired" : "invalid";
      return NextResponse.redirect(
        new URL(`/accept-invitation?reason=${reason}`, request.url)
      );
    }

    return NextResponse.redirect(new URL("/accept-invitation", request.url));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === "invite") {
        return NextResponse.redirect(new URL("/accept-invitation", request.url));
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.redirect(
          new URL("/accept-invitation?reason=invalid", request.url)
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("invitation_pending")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) {
        return NextResponse.redirect(
          new URL("/accept-invitation?reason=profile_check_failed", request.url)
        );
      }
      if (profile?.invitation_pending === true) {
        return NextResponse.redirect(new URL("/accept-invitation", request.url));
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
    const reason = error.code === "otp_expired" ? "expired" : "invalid";
    return NextResponse.redirect(
      new URL(`/accept-invitation?reason=${reason}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/accept-invitation?reason=missing", request.url)
  );
}
