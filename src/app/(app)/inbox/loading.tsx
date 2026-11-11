export default function InboxLoading() {
  return (
    <div role="status" aria-label="Loading triage inbox" className="mx-auto max-w-[1400px] space-y-5">
      <span className="sr-only">Loading triage inbox...</span>

      <header className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-4 max-w-2xl animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-4/5 max-w-xl animate-pulse rounded bg-slate-100" />
      </header>

      <section aria-label="Loading saved views" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-7 w-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
              ))}
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl border border-slate-100 bg-slate-50 sm:w-44" />
            <div className="h-10 w-24 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
          </div>
        </div>
      </section>

      <section aria-label="Loading inbox views" className="flex gap-2 overflow-hidden pb-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-10 w-28 shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </section>

      <section aria-label="Loading inbox filters" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto]">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-1">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
          </div>
        ))}
        <div className="h-10 self-end animate-pulse rounded-xl bg-slate-200" />
      </section>

      <section aria-label="Loading bulk ticket actions" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-9 w-full animate-pulse rounded-lg border border-slate-100 bg-slate-50 sm:ml-auto sm:w-48" />
        <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200" />
      </section>

      <section aria-label="Loading ticket list" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(13rem,1fr)_auto]">
            <div className="h-10 animate-pulse rounded-xl border border-slate-100 bg-slate-50 sm:w-56" />
            <div className="h-10 animate-pulse rounded-xl border border-slate-100 bg-slate-50 sm:w-36" />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-4/5 max-w-lg animate-pulse rounded bg-slate-100" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:justify-end sm:pl-0">
                <div className="flex gap-2">
                  <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Loading inbox pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-100" />
      </nav>
    </div>
  );
}
