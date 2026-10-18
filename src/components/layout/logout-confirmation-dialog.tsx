"use client";

import Link from "next/link";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

export function LogoutConfirmationDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 text-inherit backdrop:bg-navy/55 backdrop:backdrop-blur-sm"
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(18,33,58,0.24)]">
        <div className="h-1.5 bg-gradient-to-r from-rose-400 via-urgent to-red-600" />
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-urgent ring-1 ring-inset ring-rose-100">
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-urgent">
                End this session
              </p>
              <h2 id="logout-dialog-title" className="mt-1.5 text-xl font-bold tracking-tight text-navy">
                Log out of PMSG Desk?
              </h2>
            </div>
          </div>
          <p id="logout-dialog-description" className="mt-4 text-sm leading-6 text-slate-600">
            You&apos;ll need to sign in again to continue working. Your tickets and updates will be waiting when you return.
          </p>
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            Your account stays secure when you sign out on a shared device.
          </div>
          <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="focus-ring min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Stay signed in
            </button>
            <Link
              href="/logout"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-urgent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Log out
              <ArrowRight aria-hidden="true" className="h-4 w-4 opacity-75" />
            </Link>
          </div>
        </div>
      </div>
    </dialog>
  );
}