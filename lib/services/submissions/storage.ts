import { getSupabaseAdmin } from "@/lib/auth/supabase";

export const SUBMISSION_FILES_BUCKET = "submission-files";
export const MAX_SUBMISSION_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const PDF_MIME = new Set(["application/pdf"]);
const ALLOWED_CUSTOM_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
]);

export function extensionForMime(mime: string, originalName?: string): string {
  if (originalName && originalName.includes(".")) {
    const ext = originalName.split(".").pop();
    if (ext && ext.length <= 5) return ext.toLowerCase();
  }
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/msword":
      return "doc";
    case "text/plain":
      return "txt";
    case "text/csv":
      return "csv";
    default:
      return "bin";
  }
}

export async function uploadSubmissionFile(input: {
  orgId: string;
  eventId: string;
  submissionId: string;
  kind: "erc" | "custom";
  fieldId?: string;
  file: File;
}) {
  if (input.file.size > MAX_SUBMISSION_FILE_BYTES) {
    return { ok: false as const, reason: "TOO_LARGE" as const };
  }

  if (input.kind === "erc") {
    if (!PDF_MIME.has(input.file.type)) {
      return { ok: false as const, reason: "INVALID_MIME" as const, message: "ERC certificate must be a PDF." };
    }
  } else {
    if (!ALLOWED_CUSTOM_MIMES.has(input.file.type)) {
      return { ok: false as const, reason: "INVALID_MIME" as const, message: "File type not supported." };
    }
  }

  const ext = extensionForMime(input.file.type, input.file.name);
  const fileName = input.kind === "erc" ? `erc.${ext}` : `${input.fieldId || "file"}_${Date.now()}.${ext}`;
  const path = `${input.orgId}/${input.eventId}/${input.submissionId}/${fileName}`;

  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const { error } = await supabase.storage
    .from(SUBMISSION_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: true,
    });

  if (error) {
    return { ok: false as const, reason: "UPLOAD_FAILED" as const, error: error.message };
  }

  return {
    ok: true as const,
    storagePath: `${SUBMISSION_FILES_BUCKET}/${path}`,
    fileName: input.file.name,
    fileSize: input.file.size,
    mimeType: input.file.type,
  };
}

export async function createSignedSubmissionFileUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const parts = storagePath.split("/");
  const bucket = parts[0];
  const objectPath = parts.slice(1).join("/");

  if (!bucket || !objectPath) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);

  if (error) return null;
  return data.signedUrl;
}

