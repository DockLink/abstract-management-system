import { prisma } from "@/lib/db/prisma";
import {
  DecisionOutcome,
  EmailDeliveryStatus,
  ReviewAssignmentStatus,
  SubmissionStatus,
} from "@/app/generated/prisma/client";
import {
  statusForDecision,
  DECISION_LABEL,
  canTransition,
} from "./state-machine";
import {
  getEffectiveTemplate,
  renderEmail,
  logEmail,
  type DecisionTemplateKey,
} from "./emails";
import { formatLongDate } from "@/lib/dates";

export interface ReleaseParams {
  orgId: string;
  eventId: string;
  categoryId?: string;
  submissionIds?: string[];
  includeReviewerComments: boolean;
  revisionDueAt?: string;
  sendEmails: boolean;
  actorId: string;
  appBaseUrl?: string;
}

export interface ReleaseResult {
  releasedCount: number;
  emailsQueued: number;
  submissions: Array<{
    id: string;
    refNo: string | null;
    title: string;
    decision: DecisionOutcome;
    newStatus: SubmissionStatus;
    recipientEmail: string;
  }>;
}

function templateKeyForDecision(decision: DecisionOutcome): DecisionTemplateKey {
  switch (decision) {
    case DecisionOutcome.ACCEPT_ORAL:
      return "decision.accept_oral";
    case DecisionOutcome.ACCEPT_POSTER:
      return "decision.accept_poster";
    case DecisionOutcome.REJECT:
      return "decision.reject";
    case DecisionOutcome.REVISIONS_REQUESTED:
      return "decision.revisions_requested";
    case DecisionOutcome.WAITLIST:
      return "decision.waitlist";
  }
}

export async function releaseDecisions(params: ReleaseParams): Promise<ReleaseResult> {
  const {
    orgId,
    eventId,
    categoryId,
    submissionIds,
    includeReviewerComments,
    revisionDueAt,
    sendEmails,
    appBaseUrl = "",
  } = params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organisation: { select: { slug: true, name: true } } },
  });
  if (!event) throw new Error("Event not found");

  const where: Record<string, unknown> = {
    orgId,
    eventId,
    deletedAt: null,
    decision: { not: null },
    decisionReleasedAt: null, // Only release unreleased decisions
  };

  if (submissionIds && submissionIds.length > 0) {
    where.id = { in: submissionIds };
  } else if (categoryId) {
    where.categoryId = categoryId;
  }

  const submissions = await prisma.submission.findMany({
    where,
    include: {
      submitter: { select: { id: true, email: true, fullName: true } },
      authors: {
        where: { isPresenting: true },
        select: { surname: true, initials: true, email: true },
        take: 1,
      },
      category: { select: { name: true } },
      reviewAssignments: {
        where: {
          status: ReviewAssignmentStatus.COMPLETED,
        },
        include: {
          review: {
            select: { commentAuthor: true, isDraft: true },
          },
        },
      },
    },
  });

  const now = new Date();
  const parsedRevisionDue = revisionDueAt ? new Date(revisionDueAt) : null;

  const releasedList: ReleaseResult["submissions"] = [];
  let emailsQueued = 0;

  for (const s of submissions) {
    const decision = s.decision!;
    const nextStatus = statusForDecision(decision);

    // Guard transition
    if (!canTransition(s.status, nextStatus)) {
      continue;
    }

    // Update submission
    await prisma.submission.update({
      where: { id: s.id },
      data: {
        status: nextStatus,
        decisionReleasedAt: now,
        reviewsReleased: includeReviewerComments,
        revisionDueAt:
          decision === DecisionOutcome.REVISIONS_REQUESTED ? parsedRevisionDue : null,
      },
    });

    const presenter = s.authors[0];
    const authorName = presenter
      ? `${presenter.initials} ${presenter.surname}`.trim()
      : s.submitter.fullName || s.submitter.email;
    const recipientEmail = presenter ? presenter.email : s.submitter.email;

    releasedList.push({
      id: s.id,
      refNo: s.refNo,
      title: s.title,
      decision,
      newStatus: nextStatus,
      recipientEmail,
    });

    if (sendEmails) {
      // Build reviewer comments text if enabled
      let commentsText = "";
      if (includeReviewerComments) {
        const comments = s.reviewAssignments
          .map((a) => a.review?.commentAuthor)
          .filter((c): c is string => !!c && c.trim().length > 0);

        if (comments.length > 0) {
          commentsText =
            "Reviewer feedback:\n" +
            comments.map((c, i) => `[Reviewer ${i + 1}]\n${c}`).join("\n\n");
        }
      }

      const templateKey = templateKeyForDecision(decision);
      const template = await getEffectiveTemplate(eventId, templateKey);

      const portalUrl = `${appBaseUrl}/${event.organisation.slug}/${event.slug}/my-submissions`;

      const deadlineStr = parsedRevisionDue
        ? formatLongDate(parsedRevisionDue)
        : "two weeks from this notification";

      const rendered = renderEmail(template, {
        author_name: authorName,
        abstract_title: s.title,
        ref_no: s.refNo || "",
        presentation_type: s.presentationType ? s.presentationType.toLowerCase() : "presentation",
        event_name: event.name,
        decision: DECISION_LABEL[decision],
        decision_note: s.decisionNote || "",
        reviewer_comments: commentsText,
        registration_url: portalUrl,
        deadline: deadlineStr,
      });

      await logEmail({
        orgId,
        eventId,
        submissionId: s.id,
        templateKey,
        toEmail: recipientEmail,
        subject: rendered.subject,
        body: rendered.body,
        status: EmailDeliveryStatus.QUEUED,
      });

      emailsQueued++;
    }
  }

  return {
    releasedCount: releasedList.length,
    emailsQueued,
    submissions: releasedList,
  };
}

