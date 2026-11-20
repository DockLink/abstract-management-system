import { prisma } from "@/lib/db/prisma";
import {
  DecisionOutcome,
  EmailDeliveryStatus,
  SlotResponse,
  SubmissionStatus,
} from "@/app/generated/prisma/client";
import { getEffectiveTemplate, renderEmail, logEmail } from "./emails";

export async function respondToSlot(
  submissionId: string,
  userId: string,
  response: "CONFIRMED" | "DECLINED",
  reason?: string,
): Promise<{ success: boolean; status: SubmissionStatus }> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) throw new Error("Submission not found");

  if (submission.submitterId !== userId) {
    throw new Error("Unauthorized to respond to this submission");
  }

  if (submission.status !== SubmissionStatus.ACCEPTED) {
    throw new Error("Slot response is only valid for accepted submissions");
  }

  const now = new Date();

  if (response === "CONFIRMED") {
    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        slotResponse: SlotResponse.CONFIRMED,
        slotRespondedAt: now,
      },
    });
    return { success: true, status: updated.status };
  } else {
    // Declining slot moves to WITHDRAWN
    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        slotResponse: SlotResponse.DECLINED,
        slotRespondedAt: now,
        status: SubmissionStatus.WITHDRAWN,
        withdrawnAt: now,
        decisionNote: reason ? `Declined slot: ${reason}` : "Author declined presentation slot",
      },
    });
    return { success: true, status: updated.status };
  }
}

export async function offerWaitlistSlot(params: {
  orgId: string;
  eventId: string;
  declinedSubmissionId: string;
  waitlistedSubmissionId: string;
  sendEmail?: boolean;
  appBaseUrl?: string;
}): Promise<{ success: boolean; promotedRefNo: string | null }> {
  const { orgId, eventId, declinedSubmissionId, waitlistedSubmissionId, sendEmail = true, appBaseUrl = "" } = params;

  const [declined, waitlisted, event] = await Promise.all([
    prisma.submission.findUnique({ where: { id: declinedSubmissionId } }),
    prisma.submission.findUnique({
      where: { id: waitlistedSubmissionId },
      include: {
        submitter: true,
        authors: { where: { isPresenting: true }, take: 1 },
      },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      include: { organisation: true },
    }),
  ]);

  if (!declined || declined.eventId !== eventId) throw new Error("Declined submission not found");
  if (!waitlisted || waitlisted.eventId !== eventId) throw new Error("Waitlisted submission not found");
  if (!event) throw new Error("Event not found");

  if (waitlisted.status !== SubmissionStatus.WAITLISTED) {
    throw new Error("Selected submission is not in WAITLISTED status");
  }

  const now = new Date();
  const promotedDecision = declined.decision || DecisionOutcome.ACCEPT_POSTER;
  const promotedPresType = declined.presentationType || null;

  await prisma.submission.update({
    where: { id: waitlistedSubmissionId },
    data: {
      status: SubmissionStatus.ACCEPTED,
      decision: promotedDecision,
      presentationType: promotedPresType,
      decisionReleasedAt: now,
      slotResponse: null, // Reset slot response for new offer
      slotFilledById: declinedSubmissionId,
    },
  });

  if (sendEmail) {
    const template = await getEffectiveTemplate(eventId, "decision.waitlist_offer");
    const presenter = waitlisted.authors[0];
    const authorName = presenter
      ? `${presenter.initials} ${presenter.surname}`.trim()
      : waitlisted.submitter.fullName || waitlisted.submitter.email;
    const recipientEmail = presenter ? presenter.email : waitlisted.submitter.email;

    const portalUrl = `${appBaseUrl}/${event.organisation.slug}/${event.slug}/my-submissions`;

    const rendered = renderEmail(template, {
      author_name: authorName,
      abstract_title: waitlisted.title,
      ref_no: waitlisted.refNo || "",
      presentation_type: promotedPresType ? promotedPresType.toLowerCase() : "presentation",
      event_name: event.name,
      decision: "Accepted from Waitlist",
      registration_url: portalUrl,
    });

    await logEmail({
      orgId,
      eventId,
      submissionId: waitlisted.id,
      templateKey: "decision.waitlist_offer",
      toEmail: recipientEmail,
      subject: rendered.subject,
      body: rendered.body,
      status: EmailDeliveryStatus.QUEUED,
    });
  }

  return { success: true, promotedRefNo: waitlisted.refNo };
}

