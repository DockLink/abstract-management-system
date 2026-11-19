"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { MeResponse } from "@/lib/types/api";

function initials(fullName: string | null, email: string) {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return email.slice(0, 2).toUpperCase();
}

export function AdminUserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await apiFetch<MeResponse>("/api/v1/auth/me");
      if (cancelled || !result.ok) return;
      setMe(result.data.user);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    setLoggingOut(true);
    try {
      await apiFetch<{ loggedOut: boolean }>("/api/v1/auth/logout", {
        method: "POST",
      });
    } catch {
      // Still clear the browser session below.
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  const label = me?.fullName?.trim() || me?.email || "Account";
  const email = me?.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-2 px-2"
          aria-label="Account menu"
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-primary-tint text-[10px] font-medium text-primary">
              {me ? initials(me.fullName, me.email) : "…"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
            {label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <p className="truncate text-sm font-medium">{label}</p>
            {email && email !== label ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            router.push("/my-reviews");
          }}
        >
          <ClipboardCheck className="size-4" />
          My Reviews
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={loggingOut}
          onSelect={() => {
            void signOut();
          }}
        >
          <LogOut className="size-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
