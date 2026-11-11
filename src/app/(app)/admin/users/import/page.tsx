import Link from "next/link";
import { redirect } from "next/navigation";
import { BulkUserImport } from "@/components/admin/bulk-user-import";
import { getCurrentContext } from "@/lib/data";

export default async function BulkUserImportPage() {
  const { profile } = await getCurrentContext();
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Import users</h1>
          <p className="mt-2 text-sm text-slate-600">Upload an .xlsx or .csv file with one user per row.</p>
        </div>
        <Link href="/admin/users" className="focus-ring inline-flex min-h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to users
        </Link>
      </header>
      <BulkUserImport />
    </div>
  );
}
