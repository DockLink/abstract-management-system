import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PlatformPage } from "@/components/platform/platform-page";
import { UserMenu } from "@/components/shell/user-menu";
import { apiFetchServer } from "@/lib/api/server";
import { getAccessToken } from "@/lib/supabase/server";
import type { MeResponse } from "@/lib/types/api";

export const instant = false;

export default async function PlatformRoute() {
  await connection();
  const token = await getAccessToken();
  if (!token) redirect("/login?next=/platform");

  const me = await apiFetchServer<MeResponse>("/api/v1/auth/me", { token });
  if (!me.ok) redirect("/login?next=/platform");
  // Presentation only: every platform API checks this itself.
  if (!me.data.isPlatformAdmin) redirect("/");

  const user = {
    fullName: me.data.user.fullName,
    email: me.data.user.email,
    phone: me.data.user.phone,
    slmcNo: me.data.user.slmcNo,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-gutter py-2 sm:px-6">
        <p className="font-heading text-lg font-semibold">Platform admin</p>
        <UserMenu
          user={user}
          reviewsAnywhere={me.data.eventRoles.some((r) => r.role === "REVIEWER")}
          returnTo="/platform"
          compact
        />
      </header>
      <main className="mx-auto max-w-5xl px-gutter py-6 sm:px-6 md:py-8">
        <PlatformPage currentUserId={me.data.user.id} />
      </main>
    </div>
  );
}
