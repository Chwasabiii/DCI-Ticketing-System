"use client";

import { useEffect } from "react";

export default function TicketsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Could not load tickets.", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl border border-border bg-surface p-5" role="alert">
      <h1 className="text-lg font-semibold text-ink">Tickets could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
      <button
        type="button"
        onClick={reset}
        className="focus-ring mt-4 inline-flex min-h-9 items-center rounded-control bg-primary px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
      >
        Try again
      </button>
    </section>
  );
}
