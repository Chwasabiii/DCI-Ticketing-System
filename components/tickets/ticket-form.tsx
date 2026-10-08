import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTicket } from "@/lib/actions";
import type { Category, Discipline } from "@/lib/types";

export function TicketForm({
  categories,
  disciplines
}: {
  categories: Category[];
  disciplines: Discipline[];
}) {
  return (
    <form action={createTicket} className="grid gap-5 rounded-lg bg-white p-6 shadow-soft">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Request title</span>
        <input
          name="title"
          required
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          placeholder="e.g. Review reflected ceiling plan revisions"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Discipline</span>
          <select name="discipline_id" className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring">
            <option value="">Let PMSG route this</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Category</span>
          <select name="category_id" className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring">
            <option value="">General request</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Details</span>
        <textarea
          name="description"
          required
          rows={8}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          placeholder="Describe the project, drawing/document reference, deadline, and expected output."
        />
      </label>
      <Button type="submit" className="w-full sm:w-fit">
        <Send className="h-4 w-4" />
        Submit ticket
      </Button>
    </form>
  );
}
