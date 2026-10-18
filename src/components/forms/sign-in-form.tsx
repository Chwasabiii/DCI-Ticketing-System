"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { signIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" loading={pending}>
      <LockKeyhole className="h-4 w-4" />
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("pmsg-remembered-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const submittedEmail = formData.get("email");

    if (typeof submittedEmail !== "string") return;

    if (rememberEmail) {
      window.localStorage.setItem("pmsg-remembered-email", submittedEmail.trim());
    } else {
      window.localStorage.removeItem("pmsg-remembered-email");
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Email address</span>
        <span className="mt-2 flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
          <Mail aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            autoComplete="email"
            className="w-full border-0 bg-transparent text-sm text-navy outline-none placeholder:text-slate-400"
            placeholder="name@designcoordinates.com"
          />
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-navy outline-none transition-colors placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder="Enter password"
        />
      </label>
      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-600">
        <input
          name="remember_email"
          type="checkbox"
          checked={rememberEmail}
          onChange={(event) => setRememberEmail(event.currentTarget.checked)}
          className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
        />
        Remember me
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
