"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ConsentText } from "@/components/auth/auth-panel";
import { ErrorState } from "@/components/shared/error-state";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid";

/** Opens the session from a Supabase invite link. Returns false if the link is unusable. */
async function openInviteSession(): Promise<boolean> {
  const supabase = createClient();
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  if (hash.get("error") || query.get("error")) return false;

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const tokenHash = query.get("token_hash");

  let ok = false;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    ok = !error;
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    ok = !error;
  }

  // Tokens must not linger in the address bar or browser history.
  window.history.replaceState(null, "", window.location.pathname);
  return ok;
}

export function AcceptInvite() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; consent?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void openInviteSession()
      .catch(() => false)
      .then((ok) => {
        if (active) setStatus(ok ? "ready" : "invalid");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    const next: typeof errors = {};
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (confirm !== password) next.confirm = "The two passwords don't match.";
    if (!consent) next.consent = "Tick the box to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setErrors({ form: "We couldn't save your password. Try a different one, or ask for a new invitation." });
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErrors({ form: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  if (status === "checking") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-base text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Opening your invitation…
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <ErrorState
        title="This invitation link can't be used"
        description="It may have expired or already been used. Ask your event admin to invite you again, or sign in if you already set a password."
        action={
          <Button asChild variant="outline">
            <Link href="/login">Go to sign in</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <h1 className="font-heading text-3xl font-semibold">Accept your invitation</h1>
        <p className="mt-1 text-base text-muted-foreground">Choose a password to finish setting up your account.</p>
      </div>
      {errors.form ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-base text-danger-foreground">
          {errors.form}
        </div>
      ) : null}
      <FormField label="New password" required error={errors.password} help="At least 8 characters.">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <FormField label="Confirm password" required error={errors.confirm}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <div className="grid gap-1">
        <div className="flex items-start gap-3">
          <Checkbox
            id="invite-consent"
            className="mt-1"
            aria-invalid={errors.consent ? true : undefined}
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <Label htmlFor="invite-consent" className="block text-sm leading-relaxed font-normal">
            <ConsentText orgName="the organisation that invited you" />
          </Label>
        </div>
        {errors.consent ? <p className="text-sm font-medium text-danger-foreground">{errors.consent}</p> : null}
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {saving ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  );
}
