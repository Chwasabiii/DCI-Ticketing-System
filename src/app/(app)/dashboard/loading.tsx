export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mx-auto max-w-[1400px] space-y-6">
      <span className="sr-only">Loading dashboard...</span>
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-control border border-border bg-surface sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse border-b border-r border-border p-3 sm:border-b-0">
            <div className="h-5 w-8 rounded bg-neutral-200" />
            <div className="mt-2 h-3 w-20 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-control border border-border bg-surface">
        <div className="border-b border-border p-4">
          <div className="h-8 w-64 animate-pulse rounded bg-neutral-100" />
          <div className="mt-3 h-9 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="space-y-0 divide-y divide-border">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse bg-neutral-50/50" />
          ))}
        </div>
      </section>
    </div>
  );
}
