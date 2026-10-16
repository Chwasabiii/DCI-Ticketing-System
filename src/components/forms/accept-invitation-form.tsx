"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { completeInvitation } from "@/lib/actions";

export function AcceptInvitationForm({
  fullName,
  email
}: {
  fullName: string;
  email: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await completeInvitation(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Your invitation could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Your name</span>
        <input
          name="full_name"
          required
          maxLength={200}
          defaultValue={fullName}
          autoComplete="name"
          disabled={submitting}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Email address</span>
        <input
          value={email}
          readOnly
          autoComplete="email"
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Create password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={submitting}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
        />
        <span className="text-xs text-slate-500">Use at least 8 characters.</span>
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Confirm password</span>
        <input
          name="confirm_password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={submitting}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="focus-ring min-h-11 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Setting up your account..." : "Set password and continue"}
      </button>
      <Link href="/login" className="text-center text-sm font-medium text-accent hover:underline">
        Return to sign in
      </Link>
    </form>
  );
}
