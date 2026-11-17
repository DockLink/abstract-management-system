import { LoginForm } from "@/components/setup/login-form";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            DocLink
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Abstract Management System — event admin portal
          </p>
        </div>
        <LoginForm nextPath={params.next ?? "/"} />
      </div>
    </main>
  );
}
