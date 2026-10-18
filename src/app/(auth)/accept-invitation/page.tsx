import Link from "next/link";
import { AcceptInvitationForm } from "@/components/forms/accept-invitation-form";
import { VerifyInvitationForm } from "@/components/forms/verify-invitation-form";
import { createClient } from "@/lib/supabase/server";

export default async function AcceptInvitationPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string; token_hash?: string }>;
}) {
  const invitationParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = user
    ? await supabase
        .from("profiles")
        .select("full_name, invitation_pending, status")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  const hasPendingInvitation =
    !profileError &&
    profile?.invitation_pending === true &&
    profile.status === "active";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          PMSG Desk invitation
        </p>
        {invitationParams.token_hash ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Accept your invitation</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Continue to verify your invitation and set up your account.
            </p>
            <VerifyInvitationForm tokenHash={invitationParams.token_hash} />
          </>
        ) : user && hasPendingInvitation ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Set up your account</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose a password and confirm the name you want colleagues to see.
            </p>
            <AcceptInvitationForm
              fullName={
                typeof user.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name
                  : profile?.full_name ?? ""
              }
              email={user.email ?? ""}
            />
          </>
        ) : user && profileError ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Account setup needs attention</h1>
            <p role="alert" className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              We could not verify that this account has a pending invitation. Please try again
              or ask an administrator to check the account setup.
            </p>
            <Link
              href="/logout"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68]"
            >
              Sign out
            </Link>
          </>
        ) : user ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">This is not a pending invite</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You are currently signed in as{" "}
              <span className="font-semibold text-navy">{user.email}</span>, and this account
              does not have a pending invitation. Sign out, then open the latest invitation
              email for the invited address.
            </p>
            <Link
              href="/logout"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68]"
            >
              Sign out
            </Link>
          </>
        ) : invitationParams.reason ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">
              {invitationParams.reason === "missing"
                ? "Invitation link incomplete"
                : invitationParams.reason === "profile_check_failed"
                  ? "Account setup needs attention"
                  : "Invitation link unavailable"}
            </h1>
            <p role="alert" className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {invitationParams.reason === "missing"
                ? "The email link reached the app without its one-time verification token. In Supabase, open Authentication > Email Templates > Invite user and make the link use {{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite. Adding the callback to the Redirect URLs allow-list alone does not add this token. Save the template, then have an administrator send a new invitation."
                : invitationParams.reason === "profile_check_failed"
                  ? "Your invitation was verified, but the app could not check your account setup status. Ask your administrator to confirm the invitation/profile migrations are applied. You may not need a new invitation."
                  : "This invitation link may have expired or already been used. Ask your administrator to send a new invitation, then open it once in the same browser."}
            </p>
            <Link
              href="/login"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68]"
            >
              Return to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Invitation link needed</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open the latest invitation email link to set your password and profile name.
            </p>
            <Link
              href="/login"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68]"
            >
              Return to sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
