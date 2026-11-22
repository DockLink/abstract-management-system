"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { friendlyAuthError, safeNextPath } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";
import type { LoginResponse } from "@/lib/types/api";
import { cn } from "@/lib/utils";

export type AuthMode = "signin" | "signup";
type Method = "code" | "password";
type Step = "form" | "code" | "check-email" | "done";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

/* Seconds until a timestamp, ticking once a second (no effects needed). */
function subscribeSecond(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
function useSecondsUntil(until: number | null) {
  return useSyncExternalStore(
    subscribeSecond,
    () => (until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0),
    () => 0,
  );
}

/* ─── Small building blocks ──────────────────────────────────────────────── */

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger-foreground">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Primitive inputs are 44px; auth fields are the first thing seniors meet on a phone — make them 48px.
const bigInput = "h-12! text-base";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-base text-danger-foreground">
      {message}
    </div>
  );
}

/** GEN-08: data-protection consent shown wherever an account can be created. */
export function ConsentText({ orgName }: { orgName: string }) {
  return (
    <>
      I agree that {orgName} may store and use my name, contact details and professional details to run abstract
      submission, review and registration for its events, as described under Sri Lanka&apos;s Personal Data Protection
      Act, No. 9 of 2022. I can ask for a copy of my data, or for it to be deleted, at any time.
    </>
  );
}

/* ─── Panel ──────────────────────────────────────────────────────────────── */

/**
 * Sign in / create account, by emailed code (OTP) or password.
 *
 * Behaviour kept from the previous form: password sign-in goes through
 * POST /api/v1/auth/login, then the session is set in the browser and the
 * user returns to `next`. Account creation with a password uses the
 * existing POST /api/v1/auth/signup. Email codes use Supabase directly.
 */
export function AuthPanel({
  initialMode,
  nextPath,
  orgName,
  lead,
}: {
  /** Shown under the heading on phones, where the brand panel is a strip. */
  lead?: string;
  initialMode: AuthMode;
  nextPath: string;
  /** Who processes the data (event's organisation, or DocLink). */
  orgName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [method, setMethod] = useState<Method>(initialMode === "signup" ? "code" : "password");
  const [step, setStep] = useState<Step>("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const resendIn = useSecondsUntil(resendAt);

  const next = safeNextPath(nextPath);
  const signup = mode === "signup";

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setStep("form");
    setErrors({});
    setFormError(null);
    if (m === "signup") setMethod("code");
    const url = new URL(window.location.href);
    if (m === "signup") url.searchParams.set("mode", "signup");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", url);
  };

  const finish = () => {
    setStep("done");
    toast.success("Signed in");
    router.replace(next);
    router.refresh();
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (signup && !fullName.trim()) e.fullName = "Enter your name as it should appear on your abstracts.";
    if (!EMAIL.test(email.trim())) e.email = "Enter a valid email address, like name@hospital.lk.";
    if (method === "password") {
      if (!password) e.password = "Enter your password.";
      else if (signup && password.length < 8) e.password = "Use at least 8 characters.";
    }
    if (signup && !consent) e.consent = "Tick the box to agree before creating your account.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* Password sign-in — unchanged API path. */
  const passwordSignIn = async () => {
    const result = await apiFetch<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email: email.trim(), password },
      token: null,
    });
    if (!result.ok) {
      setFormError(friendlyAuthError(result.error.message, "password-sign-in", result.status));
      return;
    }
    const { error } = await createClient().auth.setSession({
      access_token: result.data.accessToken,
      refresh_token: result.data.refreshToken,
    });
    if (error) {
      setFormError(friendlyAuthError(error.message, "password-sign-in"));
      return;
    }
    finish();
  };

  /* Password sign-up — existing signup API. */
  const passwordSignUp = async () => {
    const result = await apiFetch<LoginResponse | { session: null; message: string }>("/api/v1/auth/signup", {
      method: "POST",
      body: { email: email.trim(), password, fullName: fullName.trim() },
      token: null,
    });
    if (!result.ok) {
      setFormError(friendlyAuthError(result.error.message, "sign-up", result.status));
      return;
    }
    if ("accessToken" in result.data) {
      const { error } = await createClient().auth.setSession({
        access_token: result.data.accessToken,
        refresh_token: result.data.refreshToken,
      });
      if (error) {
        setFormError(friendlyAuthError(error.message, "sign-up"));
        return;
      }
      finish();
      return;
    }
    setStep("check-email");
  };

  const sendCode = async () => {
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: signup,
        data: signup ? { full_name: fullName.trim() } : undefined,
      },
    });
    if (error) {
      setFormError(friendlyAuthError(error.message, "send-code", error.status));
      return false;
    }
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    return true;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (method === "password") {
        await (signup ? passwordSignUp() : passwordSignIn());
      } else if (await sendCode()) {
        setCode("");
        setStep("code");
      }
    } catch {
      setFormError(friendlyAuthError("network", "send-code", 0));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setErrors({ code: "Enter the 6-digit code from the email." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { error } = await createClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) {
        setFormError(friendlyAuthError(error.message, "verify-code", error.status));
        return;
      }
      finish();
    } catch {
      setFormError(friendlyAuthError("network", "verify-code", 0));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setFormError(null);
    setBusy(true);
    try {
      if (await sendCode()) toast.success("New code sent", `Check ${email.trim()}`);
    } finally {
      setBusy(false);
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

  if (step === "done") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="text-lg font-semibold">You&apos;re signed in</p>
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Taking you back…
        </p>
      </div>
    );
  }

  if (step === "check-email") {
    return (
      <div role="status" className="space-y-4 py-4">
        <MailCheck className="size-10 text-brand-ink" aria-hidden />
        <h1 className="font-heading text-3xl font-semibold">Check your email</h1>
        <p className="text-base">
          We&apos;ve sent a confirmation link to <strong className="font-semibold">{email.trim()}</strong>. Open it to
          activate your account, then sign in.
        </p>
        <p className="text-sm text-muted-foreground">Can&apos;t find it? Look in spam or promotions.</p>
        <Button variant="outline" className="w-full" onClick={() => switchMode("signin")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={onVerify} noValidate className="space-y-5">
        <button
          type="button"
          onClick={() => { setStep("form"); setFormError(null); }}
          className="-ml-2 inline-flex min-h-control items-center gap-1.5 rounded-md px-2 text-base text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Use a different email
        </button>
        <div>
          <h1 className="font-heading text-3xl font-semibold">Enter your code</h1>
          <p className="mt-1 text-base text-muted-foreground" aria-live="polite">
            We sent a 6-digit code to <strong className="font-semibold text-foreground">{email.trim()}</strong>.
          </p>
        </div>
        <FormError message={formError} />
        <Field id="otp" label="Code" error={errors.code}>
          <Input
            id="otp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            autoFocus
            aria-invalid={!!errors.code || undefined}
            aria-describedby={errors.code ? "otp-error" : undefined}
            className="h-14! text-center font-mono text-2xl tracking-[0.5em]"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {busy ? "Checking…" : signup ? "Create account" : "Sign in"}
        </Button>
        <p className="text-center text-base text-muted-foreground">
          {resendIn > 0 ? (
            <>You can send a new code in {resendIn} s</>
          ) : (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={busy}
              className="inline-flex min-h-control items-center rounded-md px-2 font-medium text-brand-ink underline underline-offset-4"
            >
              Send a new code
            </button>
          )}
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">
          {signup ? "Create your account" : "Welcome back"}
        </h1>
        {lead ? <p className="mt-2 text-base text-muted-foreground lg:hidden">{lead}</p> : null}
        <p className="mt-2 hidden text-base text-muted-foreground lg:block">
          {signup
            ? "Authors and delegates can sign up here. It takes a minute."
            : "Sign in with your password or an emailed code."}
        </p>
      </div>

      {/* Mode: sign in / create account */}
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-md bg-muted p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "min-h-control rounded-[5px] text-base font-medium",
              mode === m ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={formError} />
        {formError && formError.includes("Create an account") ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => switchMode("signup")}>
            Create an account
          </Button>
        ) : null}
        {formError && formError.includes("Sign in instead") ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => switchMode("signin")}>
            Go to sign in
          </Button>
        ) : null}

        {signup ? (
          <Field id="fullName" label="Full name" error={errors.fullName} hint="As it should appear on abstracts and certificates, e.g. Dr. A. Perera">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              aria-invalid={!!errors.fullName || undefined}
              aria-describedby={errors.fullName ? "fullName-error" : "fullName-hint"}
              className={bigInput}
            />
          </Field>
        ) : null}

        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={bigInput}
          />
        </Field>

        {method === "password" ? (
          <Field
            id="password"
            label="Password"
            error={errors.password}
            hint={signup ? "At least 8 characters." : undefined}
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
                aria-invalid={!!errors.password || undefined}
                aria-describedby={errors.password ? "password-error" : signup ? "password-hint" : undefined}
                className={cn(bigInput, "pr-12")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute top-0.5 right-0.5"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </Field>
        ) : null}

        {signup ? (
          <div className="grid gap-2">
            <Label className="flex items-start gap-3 rounded-md border border-border p-4 text-sm leading-relaxed font-normal has-[[data-state=checked]]:border-primary">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                aria-invalid={!!errors.consent || undefined}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                className="mt-0.5"
              />
              <span>
                <ConsentText orgName={orgName} />
              </span>
            </Label>
            {errors.consent ? (
              <p id="consent-error" className="text-sm font-medium text-danger-foreground">
                {errors.consent}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {busy
            ? method === "code" ? "Sending code…" : signup ? "Creating account…" : "Signing in…"
            : method === "code" ? "Email me a code" : signup ? "Create account" : "Sign in"}
        </Button>

        <div className="relative py-1 text-center">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border" />
          <span className="relative bg-background px-3 text-sm text-muted-foreground">or</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => {
            setMethod(method === "code" ? "password" : "code");
            setErrors({});
            setFormError(null);
          }}
        >
          {method === "code"
            ? signup ? "Create a password instead" : "Sign in with a password"
            : signup ? "Use an email code instead" : "Email me a sign-in code instead"}
        </Button>

        {!signup ? (
          <p className="text-center text-sm text-muted-foreground">
            New here? Authors and delegates can{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="-my-3 inline-block py-3 font-medium text-brand-ink underline underline-offset-4"
            >
              create an account
            </button>
            . Reviewers and committee members are invited by email.
          </p>
        ) : null}
      </form>
    </div>
  );
}
