"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean };

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resolver.current = resolve;
    setRequest(options);
  }), []);
  const finish = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setRequest(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"));
    if (focusable.length === 0) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") finish(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, finish]);

  const dialog = request && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false); }}>
    <section ref={dialogRef} onKeyDown={trapFocus} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="animate-modal-in w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
      <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${request.danger ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 id="confirm-title" className="text-base font-bold text-navy">{request.title}</h2><p id="confirm-description" className="mt-1 text-sm leading-6 text-slate-600">{request.description}</p></div><button type="button" onClick={() => finish(false)} aria-label="Cancel" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={() => finish(false)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={() => finish(true)} className={`min-h-10 rounded-xl px-4 text-sm font-semibold text-white ${request.danger ? "bg-urgent hover:bg-red-700" : "bg-navy hover:bg-slate-800"}`}>{request.confirmLabel ?? "Confirm"}</button></div>
    </section>
  </div>;

  return { confirm, dialog };
}
