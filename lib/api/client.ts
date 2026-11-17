"use client";

import { createClient } from "@/lib/supabase/client";
import {
  rawApiFetch,
  type ApiResult,
  type FetchOptions,
} from "@/lib/api/http";

export type { ApiResult, FetchOptions };

async function browserToken(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Browser-safe API fetch (uses Supabase browser session). */
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  const token = await browserToken(options.token);
  return rawApiFetch<T>(path, token, options);
}
