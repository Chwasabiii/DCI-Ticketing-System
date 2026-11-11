export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mx-auto max-w-[1400px] space-y-5 sm:space-y-6">
      <span className="sr-only">Loading dashboard...</span>
      <header className="rounded-2xl bg-[#172b4d] p-5 shadow-[0_12px_32px_rgba(18,33,58,0.12)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="h-4 w-36 animate-pulse rounded bg-white/20" />
            <div className="h-9 w-48 animate-pulse rounded bg-white/25 sm:h-10" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded bg-white/15" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-xl bg-white/15 sm:w-56" />
        </div>
      </header>

      <section aria-label="Loading ticket summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex min-h-[104px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
            <div className="space-y-2">
              <div className="h-6 w-10 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Loading ticket queue" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-blue-50" />
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="flex gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-10 w-24 animate-pulse border-b-2 border-transparent">
                  <div className="mt-3 h-3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(8.5rem,auto))_auto]">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
            ))}
          </div>
        </div>
        <div className="md:hidden divide-y divide-slate-100">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="h-10 border-b border-slate-200">
                {Array.from({ length: 9 }, (_, index) => (
                  <th key={index} scope="col" className="px-3">
                    <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 6 }, (_, row) => (
                <tr key={row} className="h-12">
                  {Array.from({ length: 9 }, (_, column) => (
                    <td key={column} className="px-3">
                      <div className={`h-3 animate-pulse rounded bg-slate-100 ${column === 1 ? "w-4/5" : column === 0 || column === 4 || column === 5 ? "w-12" : "w-3/5"}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
