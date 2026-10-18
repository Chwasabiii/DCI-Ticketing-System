import { SignInForm } from "@/components/forms/sign-in-form";
import { ArrowUpRight, CheckCircle2, Headphones, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fa] p-0 sm:p-5 lg:p-8">
      <div className="grid min-h-screen w-full max-w-[1320px] overflow-hidden bg-white shadow-[0_24px_80px_rgba(18,33,58,0.12)] sm:min-h-[min(860px,calc(100vh-2.5rem))] sm:rounded-[2rem] lg:min-h-[min(820px,calc(100vh-4rem))] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative isolate flex min-h-[340px] flex-col overflow-hidden bg-[#172b4d] px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-full lg:px-14 lg:py-12">
          <div className="absolute -right-20 -top-24 -z-10 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-32 left-[25%] -z-10 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
          <header className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-sm font-black tracking-tight text-navy shadow-sm">
              DCI
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">PMSG Desk</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-blue-200">
                Support center
              </p>
            </div>
          </header>

          <div className="my-auto max-w-xl py-10 lg:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <Headphones className="h-3.5 w-3.5" />
              Project support, all in one place
            </div>
            <h1 className="mt-6 max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Keep every project moving forward.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-blue-100/85 sm:text-base sm:leading-7">
              Raise a request, follow its progress, and get connected with the
              right team from one focused workspace.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Track support requests",
                "Route by discipline",
                "Coordinate project approvals",
                "Find answers in FAQs"
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-3 text-xs font-medium text-blue-50 sm:text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="hidden items-center justify-between border-t border-white/10 pt-5 text-xs text-blue-200 sm:flex">
            <span>Design Coordinates, Inc.</span>
            <span className="inline-flex items-center gap-1.5">
              Support that stays on track
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-[390px]">
            <div className="mb-8 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
              Secure access
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sign in to your support workspace to continue.
            </p>
            <div className="mt-8">
              <SignInForm />
            </div>
            <div className="mt-7 flex items-start gap-2.5 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Your account is protected. Sign in with the credentials provided
              by your organization.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
