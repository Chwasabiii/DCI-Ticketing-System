"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitationCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    async function continueInvitation() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const authError = params.get("error_description") ?? params.get("error");

      // Remove one-time credentials from the address bar/history as soon as
      // they have been read.
      window.history.replaceState(null, "", window.location.pathname);

      if (authError) {
        if (!cancelled) {
          setError("Supabase could not verify this invitation. Ask an administrator to send a new one.");
        }
        return;
      }

      const supabase = createClient();
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (sessionError) {
          if (!cancelled) setError("This invitation link has expired or has already been used. Ask an administrator to send a new one.");
          return;
        }
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (!cancelled) setError("The invitation link did not include a valid session. Ask an administrator to send a new invitation.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("invitation_pending, status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || profile?.invitation_pending !== true || profile.status !== "active") {
        if (!cancelled) setError("This account does not have an active pending invitation. Contact an administrator.");
        return;
      }

      router.replace("/accept-invitation");
      router.refresh();
    }

    void continueInvitation();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">PMSG Desk invitation</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Verifying your invitation</h1>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600">Please wait while we securely verify your invitation.</p>
        )}
      </section>
    </main>
  );
}
