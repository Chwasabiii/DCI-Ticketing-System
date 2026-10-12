export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="mx-auto max-w-7xl space-y-6"
    >
      <span className="sr-only">Loading page...</span>
      <div className="h-8 w-56 rounded-md bg-slate-200" />
      <div className="h-4 max-w-xl rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-lg bg-white shadow-soft" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="h-72 rounded-lg bg-white shadow-soft" />
        <div className="h-72 rounded-lg bg-white shadow-soft" />
      </div>
    </div>
  );
}