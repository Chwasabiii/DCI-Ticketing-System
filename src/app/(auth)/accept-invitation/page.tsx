import Link from "next/link";
import { AcceptInvitationForm } from "@/components/forms/accept-invitation-form";
import { VerifyInvitationForm } from "@/components/forms/verify-invitation-form";
import { createClient } from "@/lib/supabase/server";

export default async function AcceptInvitationPage({
  searchParams
}: {
  searchParams: { error?: string; token_hash?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          PMSG Desk invitation
        </p>
        {searchParams.error === "invalid_invitation" && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            This invitation link is invalid or has expired. Ask an administrator to send a new invitation.
          </p>
        )}
        {user ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Set up your account</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose a password and confirm the name you want colleagues to see.
            </p>
            <AcceptInvitationForm
              fullName={
                typeof user.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name
                  : ""
              }
              email={user.email ?? ""}
            />
          </>
        ) : searchParams.token_hash ? (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Accept your invitation</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Continue to verify your invitation and set up your account.
            </p>
            <VerifyInvitationForm tokenHash={searchParams.token_hash} />
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold text-navy">Invitation link needed</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open the invitation link from your email to set your password and profile name.
            </p>
            <Link
              href="/login"
              className="focus-ring mt-6 inline-flex min-h-10 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68]"
            >
              Return to sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
