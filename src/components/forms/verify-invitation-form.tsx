"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { verifyInvitation } from "@/lib/actions";

export function VerifyInvitationForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyInvitation(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/accept-invitation");
      router.refresh();
    } catch {
      setError("The invitation could not be verified. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
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
        {submitting ? "Verifying invitation..." : "Accept invitation"}
      </button>
    </form>
  );
}
