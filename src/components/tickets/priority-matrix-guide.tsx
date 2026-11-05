const rows = [
  { impact: "High", priorities: ["Urgent", "High", "Medium"] },
  { impact: "Medium", priorities: ["High", "Medium", "Low"] },
  { impact: "Low", priorities: ["Medium", "Low", "Low"] }
];

export function PriorityMatrixGuide() {
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-navy">View priority matrix</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-xs">
          <caption className="mb-2 text-left text-slate-500">Calculated category by impact and urgency</caption>
          <thead><tr className="text-slate-500"><th className="px-2 py-2">Impact / Urgency</th><th className="px-2 py-2">High</th><th className="px-2 py-2">Medium</th><th className="px-2 py-2">Low</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => <tr key={row.impact}><th className="px-2 py-2 font-semibold text-slate-700">{row.impact}</th>{row.priorities.map((priority, index) => <td key={`${row.impact}-${index}`} className="px-2 py-2 font-semibold text-navy">{priority}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}
