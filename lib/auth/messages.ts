/**
 * Turn Supabase / API auth errors into plain, actionable sentences.
 * Never echo raw server text for unknown cases — say what to do next.
 */
export type AuthErrorContext = "password-sign-in" | "send-code" | "verify-code" | "sign-up";

export function friendlyAuthError(
  raw: string | null | undefined,
  context: AuthErrorContext,
  status?: number,
): string {
  const m = (raw ?? "").toLowerCase();

  if (status === 0 || m.includes("failed to fetch") || m.includes("network")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (status === 429 || m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) {
    return "Too many attempts. Wait a minute, then try again.";
  }

  switch (context) {
    case "password-sign-in":
      if (status === 401 || m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid email or password")) {
        return "That email and password don't match. Check them, or sign in with an email code instead.";
      }
      if (m.includes("not confirmed")) {
        return "Confirm your email first — open the link we sent when you created your account.";
      }
      break;
    case "send-code":
      if (m.includes("signups not allowed") || m.includes("user not found")) {
        return "No account uses this email yet. Create an account instead.";
      }
      if (m.includes("invalid") && m.includes("email")) {
        return "Enter a valid email address, like name@hospital.lk.";
      }
      break;
    case "verify-code":
      if (m.includes("expired") || m.includes("invalid") || status === 403) {
        return "That code is wrong or has expired. Check the latest email, or send a new code.";
      }
      break;
    case "sign-up":
      if (status === 409 || m.includes("already")) {
        return "An account with this email already exists. Sign in instead.";
      }
      if (m.includes("password")) {
        return "Choose a password of at least 8 characters.";
      }
      break;
  }

  return context === "verify-code"
    ? "We couldn't check that code. Try again, or send a new one."
    : "Something went wrong on our side. Try again in a moment.";
}

/** Only follow same-site relative paths after sign-in ("/x", never "//x"). */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
