import { Badge } from "@/components/ui/badge";

type Row = Record<string, string | number | null | undefined>;

export function SimpleTable({
  title,
  rows,
  columns
}: {
  title: string;
  rows: Row[];
  columns: string[];
}) {
  return (
    <div className="rounded-lg bg-white shadow-soft">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column.replace("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={columns.length}>
                  No records found.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td key={column} className="px-4 py-4 text-slate-700">
                    {column === "status" || column === "user_side" ? (
                      <Badge value={String(row[column] ?? "unset")} />
                    ) : (
                      String(row[column] ?? "Not set")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
