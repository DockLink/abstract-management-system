import { prisma } from "@/lib/db/prisma";
import { EmailDeliveryStatus } from "@/app/generated/prisma/client";

export type DecisionTemplateKey =
  | "decision.accept_oral"
  | "decision.accept_poster"
  | "decision.reject"
  | "decision.revisions_requested"
  | "decision.waitlist"
  | "decision.waitlist_offer";

export interface DefaultTemplate {
  key: DecisionTemplateKey;
  label: string;
  subject: string;
  body: string;
}

export const DEFAULT_DECISION_TEMPLATES: DefaultTemplate[] = [
  {
    key: "decision.accept_oral",
    label: "Accept Oral",
    subject: "Abstract Accepted for Oral Presentation — {ref_no}",
    body: `Dear {author_name},

We are pleased to inform you that your abstract entitled:

"{abstract_title}" (Reference: {ref_no})

has been ACCEPTED for an ORAL presentation at {event_name}.

Next steps:
1. Please confirm your presentation slot by visiting your author dashboard:
   {registration_url}
2. Ensure the presenting author completes registration before the deadline.

{reviewer_comments}

Congratulations, and we look forward to your presentation.

Warm regards,
The Scientific Committee
{event_name}`,
  },
  {
    key: "decision.accept_poster",
    label: "Accept Poster",
    subject: "Abstract Accepted for Poster Presentation — {ref_no}",
    body: `Dear {author_name},

We are pleased to inform you that your abstract entitled:

"{abstract_title}" (Reference: {ref_no})

has been ACCEPTED for a POSTER presentation at {event_name}.

Next steps:
1. Please confirm your poster presentation slot by visiting your author dashboard:
   {registration_url}
2. Ensure the presenting author completes registration before the deadline.

{reviewer_comments}

Congratulations, and we look forward to welcoming you to the symposium.

Warm regards,
The Scientific Committee
{event_name}`,
  },
  {
    key: "decision.reject",
    label: "Reject",
    subject: "Abstract Decision — {ref_no}",
    body: `Dear {author_name},

Thank you for submitting your abstract entitled:

"{abstract_title}" (Reference: {ref_no})

to {event_name}.

The Scientific Committee received a large number of high-quality submissions this year. Following peer review, we regret to inform you that your abstract was not selected for presentation at this symposium.

{reviewer_comments}

We thank you for your submission and interest in {event_name}, and encourage you to submit your future work to upcoming sessions.

Warm regards,
The Scientific Committee
{event_name}`,
  },
  {
    key: "decision.revisions_requested",
    label: "Revisions Requested",
    subject: "Revisions Requested for Abstract — {ref_no}",
    body: `Dear {author_name},

Thank you for submitting your abstract entitled:

"{abstract_title}" (Reference: {ref_no})

to {event_name}.

The Scientific Committee has reviewed your submission and requests revisions before a final decision can be made.

Revision deadline: {deadline}

Please review the feedback below and update your abstract through your author dashboard:
{registration_url}

{reviewer_comments}

Warm regards,
The Scientific Committee
{event_name}`,
  },
  {
    key: "decision.waitlist",
    label: "Waitlist",
    subject: "Abstract Status: Waitlisted — {ref_no}",
    body: `Dear {author_name},

Thank you for submitting your abstract entitled:

"{abstract_title}" (Reference: {ref_no})

to {event_name}.

Following peer review, your abstract has been placed on the WAITLIST for presentation. Should an accepted slot become available, you will be notified immediately.

{reviewer_comments}

Warm regards,
The Scientific Committee
{event_name}`,
  },
  {
    key: "decision.waitlist_offer",
    label: "Waitlist Offer",
    subject: "Presentation Slot Available — {ref_no}",
    body: `Dear {author_name},

A presentation slot has become available at {event_name} for your abstract:

"{abstract_title}" (Reference: {ref_no})

Your abstract has now been promoted to ACCEPTED.

Please visit your author dashboard to confirm your presentation slot and complete registration:
{registration_url}

Warm regards,
The Scientific Committee
{event_name}`,
  },
];

export function getTemplateMeta(key: string): DefaultTemplate | undefined {
  return DEFAULT_DECISION_TEMPLATES.find((t) => t.key === key);
}

export async function getEffectiveTemplate(
  eventId: string,
  key: DecisionTemplateKey,
): Promise<{ subject: string; body: string }> {
  const custom = await prisma.emailTemplate.findUnique({
    where: { eventId_key: { eventId, key } },
  });
  if (custom) return { subject: custom.subject, body: custom.body };

  const def = getTemplateMeta(key);
  if (def) return { subject: def.subject, body: def.body };

  return {
    subject: `Decision on abstract {ref_no}`,
    body: `Dear {author_name},\n\nA decision has been made on your abstract "{abstract_title}". Please visit your portal: {registration_url}`,
  };
}

export function renderEmail(
  template: { subject: string; body: string },
  vars: Record<string, string>,
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  for (const [k, v] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{${k}\\}`, "g");
    subject = subject.replace(pattern, v);
    body = body.replace(pattern, v);
  }

  return { subject, body };
}

export async function logEmail(options: {
  orgId: string;
  eventId: string;
  submissionId?: string;
  templateKey: string;
  toEmail: string;
  subject: string;
  body: string;
  status?: EmailDeliveryStatus;
  error?: string;
}) {
  return prisma.emailLog.create({
    data: {
      orgId: options.orgId,
      eventId: options.eventId,
      submissionId: options.submissionId ?? null,
      templateKey: options.templateKey,
      toEmail: options.toEmail,
      subject: options.subject,
      body: options.body,
      status: options.status ?? EmailDeliveryStatus.QUEUED,
      error: options.error ?? null,
      sentAt: options.status === EmailDeliveryStatus.SENT ? new Date() : null,
    },
  });
}
