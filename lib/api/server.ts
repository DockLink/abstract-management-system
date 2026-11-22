import { getAccessToken } from "@/lib/supabase/server";
import {
  rawApiFetch,
  type ApiResult,
  type FetchOptions,
} from "@/lib/api/http";

export type { ApiResult, FetchOptions };

/** Server Component / Route Handler API fetch (uses cookie session). */
export async function apiFetchServer<T>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  const token =
    options.token !== undefined ? options.token : await getAccessToken();
  return rawApiFetch<T>(path, token, options);
}
