"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ClipboardCheck, Loader2, LogIn, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "@/components/shared/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import type { ShellUser } from "@/lib/nav/shell-data";
import { createClient } from "@/lib/supabase/client";

function initials(user: ShellUser) {
  const source = user.fullName?.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").trim();
  if (source) {
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return user.email.slice(0, 2).toUpperCase();
}

/**
 * Account menu: who you are, your profile, cross-event reviews, sign out.
 * Signed-out visitors get a "Sign in" button that returns them here.
 */
export function UserMenu({
  user,
  reviewsAnywhere = false,
  platformAdmin = false,
  returnTo,
  compact = false,
}: {
  user: ShellUser | null;
  reviewsAnywhere?: boolean;
  /** Shows the link to the platform admin area. */
  platformAdmin?: boolean;
  /** Path to come back to after signing in. */
  returnTo?: string;
  /** Avatar only (mobile top bar). */
  compact?: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) {
    const href = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";
    return (
      <Button asChild variant="outline" size={compact ? "sm" : "default"}>
        <Link href={href}>
          <LogIn data-icon="inline-start" />
          Sign in
        </Link>
      </Button>
    );
  }

  const name = user.fullName?.trim() || user.email;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch<{ loggedOut: boolean }>("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Still clear the browser session below.
    }
    try {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign you out", { description: "Close the browser to end your session." });
      setSigningOut(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={compact ? "size-control p-0" : "h-control gap-2 px-2"}
          >
            {/* Name = "Account menu, <initials> <name>": keeps visible text inside the accessible name (WCAG 2.5.3). */}
            <span className="sr-only">Account menu, </span>
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary-tint text-xs font-semibold text-brand-ink">
                {initials(user)}
              </AvatarFallback>
            </Avatar>
            {compact ? null : (
              <span className="hidden max-w-[11rem] truncate text-sm font-medium xl:inline">{name}</span>
            )}
            <span className="sr-only xl:hidden"> {name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-base font-medium">{name}</p>
            {user.fullName ? (
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserRound />
            Profile
          </DropdownMenuItem>
          {reviewsAnywhere ? (
            <DropdownMenuItem onSelect={() => router.push("/my-reviews")}>
              <ClipboardCheck />
              All my review events
            </DropdownMenuItem>
          ) : null}
          {platformAdmin ? (
            <DropdownMenuItem onSelect={() => router.push("/platform")}>
              <Building2 />
              Platform admin
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-sm font-normal text-muted-foreground">Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light" onSelect={(e) => e.preventDefault()}>
              <Sun aria-hidden />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" onSelect={(e) => e.preventDefault()}>
              <Moon aria-hidden />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" onSelect={(e) => e.preventDefault()}>
              <Monitor aria-hidden />
              Same as device
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
            {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your profile</DialogTitle>
            <DialogDescription>
              Used on your abstracts, reviews and certificates. Ask the event secretary to correct anything that&apos;s wrong.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-base">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="min-w-0 break-words">{user.fullName || "Not set"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 break-all">{user.email}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{user.phone || "Not set"}</dd>
            <dt className="text-muted-foreground">SLMC no.</dt>
            <dd>{user.slmcNo || "Not set"}</dd>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
