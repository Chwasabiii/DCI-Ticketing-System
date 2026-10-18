import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export function FeedbackMessage({ type, children }: { type: "error" | "success"; children: ReactNode }) {
  const isError = type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return <div role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={`animate-enter flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${isError ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{children}</span>
  </div>;
}
