import { SignInForm } from "@/components/forms/sign-in-form";
import { AuthFooter } from "@/components/layout/auth-footer";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reason?: string;
    session?: string;
    expired?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const sessionExpired = [params.error, params.reason, params.session].some(
    (value) =>
      value &&
      ["expired", "session_expired", "session-expired"].includes(
        value.toLowerCase()
      )
  ) || params.expired === "1" || params.expired === "true";

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <section
          aria-labelledby="sign-in-title"
          className="w-full max-w-[400px] rounded-lg border border-border bg-white p-6 sm:p-8"
        >
          <header className="mb-6">
            <div className="mb-5 flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-sm font-black tracking-tight text-white"
              >
                DCI
              </div>
              <span className="text-sm font-bold tracking-tight text-navy">
                PMSG Desk
              </span>
            </div>
            <h1
              id="sign-in-title"
              className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl"
            >
              Sign in to PMSG Desk
            </h1>
            <p className="mt-2 text-sm leading-5 text-neutral-600">
              Use the account provided by your organization.
            </p>
          </header>
          {(sessionExpired || params.next) && (
            <p
              role="status"
              className="mb-4 rounded-control border border-border bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
            >
              {sessionExpired
                ? "Your session expired. Sign in again."
                : "Sign in to continue."}
            </p>
          )}
          <SignInForm />
        </section>
      </main>
      <AuthFooter />
    </div>
  );
}
