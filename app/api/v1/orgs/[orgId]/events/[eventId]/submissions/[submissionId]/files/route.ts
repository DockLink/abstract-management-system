import { routeParams } from "@/lib/api/params";
import { ok, badRequest, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { uploadSubmissionFile, createSignedSubmissionFileUrl } from "@/lib/services/submissions/storage";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; submissionId: string }>;
};

/**
 * GET /submissions/:id/files?kind=erc
 * Generate a signed URL to view/download the uploaded ERC certificate or custom field file.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true, ercFilePath: true, customFieldValues: true },
    });
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = submission.submitterId === auth.ctx.user.id;

    // Only submission owner or event admin can access ERC / submission files
    if (!adminAccess.ok && !isOwner) {
      return forbidden("You do not have access to files for this submission");
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "erc";
    const fieldId = url.searchParams.get("fieldId");

    let filePath: string | null = null;
    if (kind === "erc") {
      filePath = submission.ercFilePath;
    } else if (kind === "custom" && fieldId) {
      const customValues = submission.customFieldValues as Record<string, unknown> | null;
      const fileData = customValues?.[fieldId];
      if (typeof fileData === "string") {
        filePath = fileData;
      } else if (fileData && typeof fileData === "object" && "storagePath" in fileData) {
        filePath = (fileData as { storagePath: string }).storagePath;
      }
    }

    if (!filePath) {
      return notFound("No file found for the requested resource");
    }

    const signedUrl = await createSignedSubmissionFileUrl(filePath);
    if (!signedUrl) {
      return serverError("Failed to generate signed download URL");
    }

    return ok({ url: signedUrl, storagePath: filePath });
  } catch (error) {
    console.error("GET /submissions/:id/files", error);
    return serverError();
  }
}

/**
 * POST /submissions/:id/files
 * Multipart file upload for ERC certificates or custom field attachments.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true, status: true, customFieldValues: true },
    });
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = submission.submitterId === auth.ctx.user.id;
    const isAdmin = adminAccess.ok;

    if (!isAdmin && !isOwner) {
      return forbidden("You do not have permission to upload files for this submission");
    }

    // Only editable in DRAFT or REVISIONS_REQUESTED unless admin
    if (!isAdmin && !["DRAFT", "REVISIONS_REQUESTED"].includes(submission.status)) {
      return unprocessable("Files cannot be uploaded in the current submission status.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = (formData.get("kind") as string) || "erc";
    const fieldId = formData.get("fieldId") as string | null;

    if (!file || !(file instanceof File)) {
      return badRequest("Missing 'file' form data field");
    }

    if (kind !== "erc" && kind !== "custom") {
      return badRequest("Invalid 'kind', must be 'erc' or 'custom'");
    }

    if (kind === "custom" && !fieldId) {
      return badRequest("fieldId is required when kind is 'custom'");
    }

    const uploadResult = await uploadSubmissionFile({
      orgId,
      eventId,
      submissionId,
      kind,
      fieldId: fieldId ?? undefined,
      file,
    });

    if (!uploadResult.ok) {
      if (uploadResult.reason === "TOO_LARGE") {
        return unprocessable("File exceeds the 10MB limit.");
      }
      if (uploadResult.reason === "INVALID_MIME") {
        return unprocessable(uploadResult.message || "Invalid file type.");
      }
      return serverError(uploadResult.error || "File upload failed.");
    }

    // Update Submission record
    if (kind === "erc") {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { ercFilePath: uploadResult.storagePath },
      });
    } else if (kind === "custom" && fieldId) {
      const currentCustom = (submission.customFieldValues as Record<string, unknown>) || {};
      const updatedCustom = {
        ...currentCustom,
        [fieldId]: {
          storagePath: uploadResult.storagePath,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
        },
      };

      await prisma.submission.update({
        where: { id: submissionId },
        data: { customFieldValues: updatedCustom as Prisma.InputJsonValue },
      });
    }

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: kind === "erc" ? "submission.upload_erc" : "submission.upload_custom_file",
      entity: "Submission",
      entityId: submissionId,
      after: {
        kind,
        fieldId,
        storagePath: uploadResult.storagePath,
        fileName: uploadResult.fileName,
      },
    });

    const signedUrl = await createSignedSubmissionFileUrl(uploadResult.storagePath);

    return ok({
      success: true,
      kind,
      fieldId,
      storagePath: uploadResult.storagePath,
      url: signedUrl,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
    });
  } catch (error) {
    console.error("POST /submissions/:id/files", error);
    return serverError();
  }
}
