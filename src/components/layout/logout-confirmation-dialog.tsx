"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
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
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 text-inherit backdrop:bg-navy/60"
    >
      <div className="overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="h-1.5 bg-urgent" />
        <div className="p-6">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-red-50 text-urgent">
            <LogOut className="h-5 w-5" />
          </div>
          <h2 id="logout-dialog-title" className="mt-4 text-xl font-bold text-navy">
            Log out of PMSG Desk?
          </h2>
          <p id="logout-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
            You will need to sign in again to continue working.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="focus-ring min-h-11 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stay signed in
            </button>
            <Link
              href="/logout"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-urgent px-4 text-sm font-semibold text-white hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Link>
          </div>
        </div>
      </div>
    </dialog>
  );
}