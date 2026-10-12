import { SignInForm } from "@/components/forms/sign-in-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-slate-100 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center bg-navy px-8 py-12 text-white lg:px-16">
        <div className="max-w-2xl">
          <div className="mb-8 grid h-14 w-14 place-items-center rounded-md bg-white text-lg font-black text-navy">
            DCI
          </div>
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">
            PMSG Desk
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-blue-100">
            A focused workspace for Design Coordinates, Inc. to receive,
            route, monitor, and close project support requests across every
            discipline.
          </p>
          <div className="mt-10 grid gap-3 text-sm text-blue-50 sm:grid-cols-3">
            <div className="rounded-md bg-white/10 p-4">Client tracking</div>
            <div className="rounded-md bg-white/10 p-4">Discipline routing</div>
            <div className="rounded-md bg-white/10 p-4">Manager reports</div>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            Secure access
          </p>
          <h2 className="mt-2 text-2xl font-bold text-navy">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use the account created for your capstone demo data.
          </p>
          <div className="mt-8">
            <SignInForm />
          </div>
        </div>
      </section>
    </main>
  );
}
