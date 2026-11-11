import { SignInForm } from "@/components/forms/sign-in-form";
import { AuthFooter } from "@/components/layout/auth-footer";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <section
          aria-labelledby="sign-in-title"
          className="w-full max-w-[400px] rounded-lg border border-border bg-white p-6 sm:p-8"
        >
          <header className="mb-6">
            <div
              aria-hidden="true"
              className="mb-5 grid h-10 w-10 place-items-center rounded-md border border-border text-xs font-semibold tracking-tight text-neutral-800"
            >
              DCI
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
          <SignInForm />
        </section>
      </main>
      <AuthFooter />
    </div>
  );
}
