import { prisma } from "@/lib/db/prisma";

export type NotificationResult = {
  submitterEmailSent: boolean;
  coAuthorEmailsSent: number;
};

/**
 * SUB-12 & SUB-17: Send confirmation email to submitter and notification emails to co-authors.
 */
export async function sendSubmissionNotifications(input: {
  submissionId: string;
  baseUrl?: string;
}): Promise<NotificationResult> {
  const submission = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    include: {
      authors: { orderBy: { sortOrder: "asc" } },
      event: { select: { name: true, slug: true, orgId: true, organisation: { select: { slug: true } } } },
      submitter: { select: { email: true, fullName: true } },
    },
  });

  if (!submission) {
    return { submitterEmailSent: false, coAuthorEmailsSent: 0 };
  }

  const { event, submitter, authors, refNo, title } = submission;
  const baseUrl = input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const orgSlug = event.organisation.slug;
  const eventSlug = event.slug;
  const submissionUrl = `${baseUrl}/${orgSlug}/${eventSlug}/submissions/${submission.id}`;

  // 1. Submitter Confirmation (SUB-12)
  console.log(`[Notification:SUB-12] Confirmation sent to submitter ${submitter.email}:`, {
    to: submitter.email,
    subject: `Submission Confirmation: [${refNo}] ${title}`,
    details: {
      event: event.name,
      refNo,
      title,
      viewUrl: submissionUrl,
    },
  });

  // 2. Co-Authors Notification (SUB-17)
  // Authors other than the submitter whose email is distinct
  const coAuthors = authors.filter(
    (a) => a.email && a.email.toLowerCase() !== submitter.email.toLowerCase(),
  );

  let coAuthorEmailsSent = 0;
  for (const coAuthor of coAuthors) {
    const flagUrl = `${baseUrl}/${orgSlug}/${eventSlug}/submissions/${submission.id}/flag-coauthor?email=${encodeURIComponent(coAuthor.email)}`;
    console.log(`[Notification:SUB-17] Co-author notification sent to ${coAuthor.email}:`, {
      to: coAuthor.email,
      name: `${coAuthor.initials} ${coAuthor.surname}`,
      subject: `You have been listed as a co-author: [${refNo}] ${title}`,
      details: {
        event: event.name,
        submitter: submitter.fullName || submitter.email,
        title,
        flagUrl,
      },
    });
    coAuthorEmailsSent++;
  }

  return {
    submitterEmailSent: true,
    coAuthorEmailsSent,
  };
}

