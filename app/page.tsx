import { redirect } from "next/navigation";
import { apiFetchServer } from "@/lib/api/server";
import type { MeResponse } from "@/lib/types/api";
import { getAccessToken } from "@/lib/supabase/server";

export const instant = false;

export default async function HomePage() {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const me = await apiFetchServer<MeResponse>("/api/v1/auth/me", { token });
  if (!me.ok) redirect("/login");

  const firstOrg = me.data.organisations[0]?.organisation;
  if (firstOrg) {
    redirect(`/org/${firstOrg.slug}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Abstract Management System
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You are signed in, but you are not a member of any organisation yet.
        Ask a platform admin to invite you.
      </p>
    </main>
  );
}
