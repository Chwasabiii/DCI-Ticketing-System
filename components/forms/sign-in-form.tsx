"use client";

import { useFormState, useFormStatus } from "react-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { signIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LockKeyhole className="h-4 w-4" />
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction] = useFormState(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <span className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <Mail className="h-4 w-4 text-slate-400" />
          <input
            name="email"
            type="email"
            required
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="name@designcoordinates.com"
          />
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-ring"
          placeholder="Enter password"
        />
      </label>
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
