import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function snapshotSubmission(
  submissionId: string,
  createdById: string,
): Promise<void> {
  // Fetch the full submission with authors and affiliations
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      authors: { orderBy: { sortOrder: "asc" } },
      affiliations: { orderBy: { number: "asc" } },
    },
  });

  if (!submission) return;

  // Find the latest version number
  const latest = await prisma.submissionVersion.findFirst({
    where: { submissionId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.submissionVersion.create({
    data: {
      submissionId,
      version: nextVersion,
      createdById,
      content: submission as unknown as Prisma.InputJsonValue,
    },
  });
}
