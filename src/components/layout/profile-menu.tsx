"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LogoutConfirmationDialog } from "@/components/layout/logout-confirmation-dialog";
import type { EmployeeRole, Profile } from "@/lib/types";

export function ProfileMenu({
  profile,
  roles
}: {
  profile: Profile | null;
  roles: EmployeeRole[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const displayRole = profile?.user_side === "employee"
    ? `${profile.service_team?.name ?? "Service Provider"}${roles.length ? ` · ${roles.join(", ")}` : ""}`
    : profile?.user_side === "client" ? "End user" : profile?.user_side === "admin" ? "Admin" : "";
  const displayName = profile?.full_name ?? "PMSG User";

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls="profile-menu"
        onClick={() => setMenuOpen((open) => !open)}
        className="focus-ring flex min-h-10 max-w-52 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 sm:gap-3 sm:px-3"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-accent">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {displayName}
          </span>
          <span className="block truncate text-xs capitalize text-slate-500">
            {displayRole}
          </span>
        </span>
      </button>

      {menuOpen && (
        <div
          id="profile-menu"
          className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Profile</p>
            <p className="mt-2 truncate text-sm font-semibold text-navy">{displayName}</p>
            <p className="truncate text-xs text-slate-600">{profile?.email ?? ""}</p>
            <p className="mt-1 text-xs capitalize text-slate-500">{displayRole}</p>
          </div>
          <div className="p-2">
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="focus-ring flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setLogoutDialogOpen(true);
              }}
              className="focus-ring flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-urgent hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}

      <LogoutConfirmationDialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
      />
    </div>
  );
}
