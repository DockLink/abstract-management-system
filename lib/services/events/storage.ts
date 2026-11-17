import { getSupabaseAdmin } from "@/lib/auth/supabase";

export const EVENT_ASSETS_BUCKET = "event-assets";
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const PDF_MIME = new Set(["application/pdf"]);

export type AssetKind = "logo" | "banner" | "guidelines";

export function allowedMimeForKind(kind: AssetKind, mime: string) {
  if (kind === "guidelines") return PDF_MIME.has(mime);
  return IMAGE_MIME.has(mime);
}

export function extensionForMime(mime: string) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export async function uploadEventAsset(input: {
  orgId: string;
  eventId: string;
  kind: AssetKind;
  file: File;
}) {
  if (input.file.size > MAX_ASSET_BYTES) {
    return { ok: false as const, reason: "TOO_LARGE" as const };
  }
  if (!allowedMimeForKind(input.kind, input.file.type)) {
    return { ok: false as const, reason: "INVALID_MIME" as const };
  }

  const ext = extensionForMime(input.file.type);
  const path = `${input.orgId}/${input.eventId}/${input.kind}.${ext}`;
  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const { error } = await supabase.storage
    .from(EVENT_ASSETS_BUCKET)
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: true,
    });

  if (error) {
    return { ok: false as const, reason: "UPLOAD_FAILED" as const, error: error.message };
  }

  return { ok: true as const, path: `${EVENT_ASSETS_BUCKET}/${path}` };
}

export async function createSignedAssetUrl(storagePath: string, expiresIn = 3600) {
  const [bucket, ...rest] = storagePath.split("/");
  if (!bucket || rest.length === 0) return null;
  const objectPath = rest.join("/");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
