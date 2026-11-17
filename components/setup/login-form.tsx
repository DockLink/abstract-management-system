"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { LoginResponse } from "@/lib/types/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = await apiFetch<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: values,
        token: null,
      });

      if (!result.ok) {
        toast.error(result.error.message || "Login failed");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: result.data.accessToken,
        refresh_token: result.data.refreshToken,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Signed in");
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          Email <span className="text-muted-foreground">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-10"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">
          Password <span className="text-muted-foreground">*</span>
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-10"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="h-10 w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
