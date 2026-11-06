"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, Check, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { updateOwnDisplayName, updateOwnPassword } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50";

export function ProfileSecurityForm({ fullName, nameChangeUsed }: { fullName: string; nameChangeUsed: boolean }) {
  const [nameMessage, setNameMessage] = useState<{ error?: string; success?: boolean } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ error?: string; success?: boolean } | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNameBusy(true); setNameMessage(null);
    try { const result = await updateOwnDisplayName(new FormData(event.currentTarget)); setNameMessage(result); }
    catch { setNameMessage({ error: "Could not update your display name. Please try again." }); }
    finally { setNameBusy(false); }
  }
  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPasswordBusy(true); setPasswordMessage(null);
    const form = event.currentTarget;
    try { const result = await updateOwnPassword(new FormData(form)); if (result.success) form.reset(); setPasswordMessage(result); }
    catch { setPasswordMessage({ error: "Could not update your password. Please try again." }); }
    finally { setPasswordBusy(false); }
  }

  return <section className="mt-9" aria-labelledby="account-security-heading">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Your account</p><h2 id="account-security-heading" className="mt-1 text-xl font-bold tracking-tight text-navy">Profile &amp; security</h2><p className="mt-1 text-sm text-slate-500">Manage the name people see and keep your account secure.</p></div>
      <span className="hidden h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-accent sm:grid"><ShieldCheck className="h-5 w-5" /></span>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-blue-50/80 to-white p-5 sm:p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-sm ring-1 ring-blue-100"><UserRound className="h-5 w-5" /></span>
          <div className="min-w-0"><h3 className="font-bold text-navy">Display name</h3><p className="mt-1 text-sm leading-5 text-slate-600">Update how your name appears across tickets and updates.</p></div>
        </div>
        <div className="p-5 sm:p-6">
          {nameChangeUsed ? <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-semibold text-emerald-950">Display name change used</p><p className="mt-1 text-sm text-emerald-900">Your current display name is <strong>{fullName || "not set"}</strong>.</p></div></div> : <form onSubmit={submitName} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">New display name<input name="full_name" required maxLength={200} defaultValue={fullName} placeholder="Enter your preferred name" className={inputClass} /></label>
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>This change can only be made once. Please check the spelling before saving.</span></div>
            {nameMessage?.error && <FeedbackMessage type="error">{nameMessage.error}</FeedbackMessage>}
            {nameMessage?.success && <FeedbackMessage type="success">Display name updated. Your one-time change has been used.</FeedbackMessage>}
            <Button type="submit" loading={nameBusy} className="w-full sm:w-fit">{nameBusy ? "Saving name…" : "Save display name"}</Button>
          </form>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-violet-50/80 to-white p-5 sm:p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100"><KeyRound className="h-5 w-5" /></span>
          <div className="min-w-0"><h3 className="font-bold text-navy">Change password</h3><p className="mt-1 text-sm leading-5 text-slate-600">Choose a new password for your account.</p></div>
        </div>
        <form onSubmit={submitPassword} className="grid gap-4 p-5 sm:p-6">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">New password<span className="relative block"><input name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" className={`${inputClass} pr-11`} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((show) => !show)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Confirm new password<span className="relative block"><input name="confirm_password" type={showConfirmation ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Enter it again" className={`${inputClass} pr-11`} /><button type="button" aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"} onClick={() => setShowConfirmation((show) => !show)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">{showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
          <p className="text-xs text-slate-500">Use 8 to 128 characters. You’ll stay signed in after changing it.</p>
          {passwordMessage?.error && <FeedbackMessage type="error">{passwordMessage.error}</FeedbackMessage>}
          {passwordMessage?.success && <FeedbackMessage type="success">Password updated successfully.</FeedbackMessage>}
          <Button type="submit" loading={passwordBusy} className="w-full sm:w-fit">{passwordBusy ? "Updating password…" : <><Check className="h-4 w-4" />Update password</>}</Button>
        </form>
      </section>
    </div>
  </section>;
}
