import { prisma } from "@/lib/db/prisma";
import { EventRoleType, ReviewAssignmentStatus } from "@/app/generated/prisma/client";

export interface ReviewerCertificateData {
  certificateId: string;
  reviewer: {
    id: string;
    fullName: string;
    email: string;
    institution: string | null;
  };
  event: {
    id: string;
    name: string;
    edition: string | null;
    venue: string | null;
    startsAt: string | null;
    endsAt: string | null;
  };
  organisation: {
    name: string;
    slug: string;
    logoPath: string | null;
  };
  stats: {
    completedReviewsCount: number;
    issueDate: string;
  };
  html: string;
}

export async function generateReviewerCertificate(
  orgId: string,
  eventId: string,
  reviewerId: string,
): Promise<ReviewerCertificateData | null> {
  const [role, event, completedReviewsCount] = await Promise.all([
    prisma.eventRole.findFirst({
      where: {
        eventId,
        userId: reviewerId,
        role: EventRoleType.REVIEWER,
      },
      include: {
        user: true,
      },
    }),
    prisma.event.findFirst({
      where: { id: eventId, orgId, deletedAt: null },
      include: { organisation: true },
    }),
    prisma.reviewAssignment.count({
      where: {
        eventId,
        reviewerId,
        status: ReviewAssignmentStatus.COMPLETED,
      },
    }),
  ]);

  if (!role || !event) {
    return null;
  }

  const certificateId = `CERT-REV-${event.slug.toUpperCase()}-${reviewerId.slice(-6).toUpperCase()}`;
  const issueDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const reviewerName = role.user.fullName || role.user.email;
  const eventName = event.edition ? `${event.name} (${event.edition})` : event.name;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate of Appreciation — ${reviewerName}</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      margin: 0;
      padding: 40px;
      background: #fdfdfd;
      color: #1a1a1a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .cert-container {
      width: 800px;
      border: 8px double #1e3a8a;
      padding: 50px;
      text-align: center;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      position: relative;
    }
    .cert-header {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      margin-bottom: 20px;
    }
    .cert-title {
      font-size: 36px;
      font-weight: bold;
      color: #1e3a8a;
      margin-bottom: 25px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cert-sub {
      font-size: 18px;
      font-style: italic;
      color: #475569;
      margin-bottom: 25px;
    }
    .cert-recipient {
      font-size: 32px;
      font-weight: bold;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      display: inline-block;
      padding: 0 40px 10px 40px;
      margin-bottom: 25px;
    }
    .cert-body {
      font-size: 17px;
      line-height: 1.8;
      color: #334155;
      margin: 0 auto 40px auto;
      max-width: 650px;
    }
    .cert-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
      padding: 0 40px;
    }
    .signature-block {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #94a3b8;
      margin-bottom: 8px;
    }
    .signature-title {
      font-size: 13px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cert-id {
      position: absolute;
      bottom: 15px;
      right: 25px;
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="cert-container">
    <div class="cert-header">${event.organisation.name}</div>
    <div class="cert-title">Certificate of Appreciation</div>
    <div class="cert-sub">This is proudly presented to</div>
    <div class="cert-recipient">${reviewerName}</div>
    <div class="cert-body">
      In sincere appreciation for your valuable contribution, dedication, and expert service as a peer reviewer for <strong>${eventName}</strong>. Your rigorous evaluation of <strong>${completedReviewsCount} scientific abstract(s)</strong> has helped uphold the highest academic and clinical standards of the conference.
    </div>
    <div class="cert-footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">Academic Chair</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">${issueDate}</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">Organising Committee</div>
      </div>
    </div>
    <div class="cert-id">${certificateId}</div>
  </div>
</body>
</html>
  `.trim();

  return {
    certificateId,
    reviewer: {
      id: role.user.id,
      fullName: reviewerName,
      email: role.user.email,
      institution: role.user.institution,
    },
    event: {
      id: event.id,
      name: event.name,
      edition: event.edition,
      venue: event.venue,
      startsAt: event.startsAt ? event.startsAt.toISOString() : null,
      endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    },
    organisation: {
      name: event.organisation.name,
      slug: event.organisation.slug,
      logoPath: event.organisation.logoPath,
    },
    stats: {
      completedReviewsCount,
      issueDate,
    },
    html,
  };
}

