"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type InvalidEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { signIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REMEMBERED_EMAIL_KEY = "pmsg-remembered-email";

function subscribeToRememberedEmail(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getRememberedEmail() {
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
}

function getServerRememberedEmail() {
  return null;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="min-h-11 w-full rounded-control bg-primary text-sm font-medium transition-colors duration-150 hover:bg-primary-hover"
      loading={pending}
    >
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, null);
  const savedEmail = useSyncExternalStore(
    subscribeToRememberedEmail,
    getRememberedEmail,
    getServerRememberedEmail
  );
  const [email, setEmail] = useState<string | null>(null);
  const [rememberEmail, setRememberEmail] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const submissionStarted = useRef(false);
  const emailValue = email ?? savedEmail ?? "";
  const rememberEmailValue = rememberEmail ?? Boolean(savedEmail);

  useEffect(() => {
    if (!isPending) submissionStarted.current = false;
  }, [isPending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    submissionStarted.current = true;
    setDismissedError(false);
    const formData = new FormData(event.currentTarget);
    const submittedEmail = formData.get("email");

    if (typeof submittedEmail !== "string") return;

    if (rememberEmailValue) {
      window.localStorage.setItem(
        REMEMBERED_EMAIL_KEY,
        submittedEmail.trim()
      );
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  }

  const fieldClassName =
    "mt-1.5 min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
  const actionError = state?.error && !dismissedError ? state.error : "";
  const isCredentialError =
    /invalid login credentials|invalid credentials/i.test(actionError);
  const displayedError = isCredentialError
    ? "Incorrect email or password."
    : actionError;

  function validateEmail(event: InvalidEvent<HTMLInputElement>) {
    setEmailError(
      event.currentTarget.validity.valueMissing
        ? "Enter your email address."
        : "Enter a valid email address."
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      aria-busy={isPending || undefined}
      className="space-y-4"
    >
      <div>
        <label htmlFor="sign-in-email" className="block text-sm font-medium text-neutral-800">
          Email
        </label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          required
          value={emailValue}
          onChange={(event) => {
            setEmail(event.currentTarget.value);
            setEmailError("");
            setDismissedError(true);
          }}
          onInvalid={validateEmail}
          autoComplete="email"
          inputMode="email"
          autoFocus
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "sign-in-email-error" : undefined}
          className={cn(fieldClassName, emailError && "border-danger")}
        />
        {emailError && (
          <p id="sign-in-email-error" className="mt-1.5 text-sm text-danger">
            {emailError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="sign-in-password" className="block text-sm font-medium text-neutral-800">
          Password
        </label>
        <div className="relative">
          <input
            id="sign-in-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-describedby={capsLockOn ? "sign-in-caps-lock" : undefined}
            className={cn(fieldClassName, "pr-11")}
            onKeyDown={(event) =>
              setCapsLockOn(event.getModifierState("CapsLock"))
            }
            onKeyUp={(event) =>
              setCapsLockOn(event.getModifierState("CapsLock"))
            }
            onBlur={() => setCapsLockOn(false)}
            onChange={() => setDismissedError(true)}
          />
          <button
            type="button"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-control text-neutral-600 transition-colors duration-150 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" size={16} strokeWidth={1.75} />
            ) : (
              <Eye aria-hidden="true" size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>
        {capsLockOn && (
          <p id="sign-in-caps-lock" className="mt-1.5 text-sm text-warning">
            Caps Lock is on
          </p>
        )}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2.5 py-1 text-sm text-neutral-800">
        <input
          name="remember_email"
          type="checkbox"
          checked={rememberEmailValue}
          onChange={(event) => setRememberEmail(event.currentTarget.checked)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        Remember me
      </label>
      {displayedError && (
        <p
          id="sign-in-error"
          role="alert"
          className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-bg px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={16}
            strokeWidth={1.75}
          />
          <span>{displayedError}</span>
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
