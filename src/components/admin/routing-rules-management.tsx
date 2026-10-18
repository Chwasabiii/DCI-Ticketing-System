"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import type { Category, Discipline, Profile, Project, TicketRoutingRule } from "@/lib/types";
import { deleteTicketRoutingRule, saveTicketRoutingRule } from "@/lib/actions";

type RuleForm = {
  id: string;
  name: string;
  project_id: string;
  category_id: string;
  request_type: string;
  discipline_id: string;
  assigned_to: string;
  rule_priority: string;
  is_active: boolean;
};

const emptyRule: RuleForm = {
  id: "", name: "", project_id: "", category_id: "", request_type: "",
  discipline_id: "", assigned_to: "", rule_priority: "100", is_active: true
};

export function RoutingRulesManagement({
  rules,
  projects,
  categories,
  disciplines,
  employees
}: {
  rules: TicketRoutingRule[];
  projects: Project[];
  categories: Category[];
  disciplines: Discipline[];
  employees: Profile[];
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [form, setForm] = useState<RuleForm>(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function editRule(rule: TicketRoutingRule) {
    setForm({
      id: String(rule.id),
      name: rule.name,
      project_id: rule.project_id == null ? "" : String(rule.project_id),
      category_id: rule.category_id == null ? "" : String(rule.category_id),
      request_type: rule.request_type ?? "",
      discipline_id: rule.discipline_id == null ? "" : String(rule.discipline_id),
      assigned_to: rule.assigned_to ?? "",
      rule_priority: String(rule.rule_priority),
      is_active: rule.is_active
    });
    setError(null);
    setNotice(null);
    document.getElementById("routing-rule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveTicketRoutingRule(new FormData(event.currentTarget));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setForm(emptyRule);
      setNotice(result.success ?? "Routing rule saved.");
      router.refresh();
    } catch {
      setError("The routing rule could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(rule: TicketRoutingRule) {
    if (!await confirm({ title: "Delete routing rule?", description: `“${rule.name}” will stop routing new tickets. Existing tickets will not change.`, confirmLabel: "Delete rule", danger: true })) return;
    const data = new FormData();
    data.set("rule_id", String(rule.id));
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await deleteTicketRoutingRule(data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (form.id === String(rule.id)) setForm(emptyRule);
      setNotice(result.success ?? "Routing rule deleted.");
      router.refresh();
    } catch {
      setError("The routing rule could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const projectName = (id: number | null) => projects.find((project) => Number(project.id) === id)?.name;
  const categoryName = (id: number | null) => categories.find((category) => Number(category.id) === id)?.name;
  const disciplineName = (id: number | null) => disciplines.find((discipline) => Number(discipline.id) === id)?.name;
  const employeeName = (id: string | null) => {
    const employee = employees.find((person) => person.id === id);
    return employee?.full_name ?? employee?.email ?? null;
  };

  const labelClass = "grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600";
  const inputClass = "min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 focus-ring";

  return (
    <div className="space-y-6">
      {confirmDialog}
      <section id="routing-rule-form" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">{form.id ? "Edit routing rule" : "Add routing rule"}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Every condition you select must match. More specific rules win: project, then category, then request type. Rule order breaks ties; a lower number wins.
            </p>
          </div>
          {form.id && (
            <button type="button" aria-label="Cancel editing routing rule" onClick={() => setForm(emptyRule)} className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="rule_id" value={form.id} />
          <label className={labelClass}>
            Rule name
            <input name="name" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="e.g. Access requests - engineering" />
          </label>
          <label className={labelClass}>
            Project condition
            <select name="project_id" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })} className={inputClass}>
              <option value="">Any project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Category condition
            <select name="category_id" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className={inputClass}>
              <option value="">Any category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Request type condition
            <select name="request_type" value={form.request_type} onChange={(event) => setForm({ ...form, request_type: event.target.value })} className={inputClass}>
              <option value="">Any request type</option>
              <option value="general">General request</option>
              <option value="access_request">Access request</option>
              <option value="incident_report">Incident report</option>
            </select>
          </label>
          <label className={labelClass}>
            Route to discipline
            <select name="discipline_id" value={form.discipline_id} onChange={(event) => setForm({ ...form, discipline_id: event.target.value })} className={inputClass}>
              <option value="">Keep selected discipline</option>
              {disciplines.map((discipline) => <option key={discipline.id} value={discipline.id} disabled={discipline.status === "inactive"}>{discipline.name}{discipline.status === "inactive" ? " (inactive)" : ""}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Assign employee (optional)
            <select name="assigned_to" value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} className={inputClass}>
              <option value="">Leave unassigned</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id} disabled={employee.status === "inactive"}>{employee.full_name ?? employee.email ?? employee.id}{employee.status === "inactive" ? " (inactive)" : ""}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Rule order (lower wins)
            <input name="rule_priority" type="number" min={0} max={9999} step={1} required value={form.rule_priority} onChange={(event) => setForm({ ...form, rule_priority: event.target.value })} className={inputClass} />
          </label>
          <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
            Rule enabled
          </label>
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 xl:col-span-4">{error}</p>}
          {notice && <p role="status" className="text-sm text-green-800 sm:col-span-2 xl:col-span-4">{notice}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" />
              {busy ? "Saving…" : form.id ? "Save changes" : "Create rule"}
            </Button>
            {form.id && <Button type="button" variant="secondary" disabled={busy} onClick={() => setForm(emptyRule)}>Cancel</Button>}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-navy">Configured rules</h2>
          <p className="mt-1 text-sm text-slate-600">{rules.length} rule{rules.length === 1 ? "" : "s"}. Project tickets are routed after approval.</p>
        </div>
        {rules.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No routing rules yet. Tickets without a matching rule stay in the unassigned queue.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((rule) => {
              const conditions = [
                projectName(rule.project_id),
                categoryName(rule.category_id),
                rule.request_type?.replaceAll("_", " ")
              ].filter(Boolean);
              const targets = [disciplineName(rule.discipline_id), employeeName(rule.assigned_to)].filter(Boolean);
              return (
                <li key={rule.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-navy">{rule.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${rule.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {rule.is_active ? "Enabled" : "Disabled"}
                      </span>
                      <span className="text-xs text-slate-500">Order {rule.rule_priority}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-600">When: {conditions.join(" + ") || "No conditions"}</p>
                    <p className="mt-0.5 break-words text-sm text-slate-600">Route to: {targets.join("; ") || "No target"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => editRule(rule)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button type="button" variant="danger" disabled={busy} onClick={() => void handleDelete(rule)} aria-label={`Delete ${rule.name}`}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
