import type { ApiError } from "@/lib/types/api-error";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

export function resolveBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export type FetchOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  token?: string | null;
  searchParams?: Record<string, string | undefined>;
  cache?: RequestCache;
};

export async function rawApiFetch<T>(
  path: string,
  token: string | null,
  options: Omit<FetchOptions, "token"> = {},
): Promise<ApiResult<T>> {
  const url = new URL(
    path.startsWith("http") ? path : `${resolveBaseUrl()}${path}`,
  );
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined && !options.formData) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method:
      options.method ??
      (options.body !== undefined || options.formData ? "POST" : "GET"),
    headers,
    body: options.formData
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    cache: options.cache ?? "no-store",
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { error: { code: "PARSE_ERROR", message: text } };
    }
  }

  if (!response.ok) {
    const err =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object"
        ? (payload.error as ApiError)
        : {
            code: "HTTP_ERROR",
            message: response.statusText || "Request failed",
          };
    return { ok: false, error: err, status: response.status };
  }

  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: T }).data
      : (payload as T);

  return { ok: true, data, status: response.status };
}
