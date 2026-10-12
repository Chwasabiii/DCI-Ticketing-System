export default function AccountArchivedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase text-urgent">Account access</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">This account is archived</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Contact your PMSG Desk administrator to restore access. Your account data has not been deleted.
        </p>
      </section>
    </main>
  );
}