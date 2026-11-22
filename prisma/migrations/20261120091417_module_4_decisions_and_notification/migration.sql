-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('ACCEPT_ORAL', 'ACCEPT_POSTER', 'REJECT', 'REVISIONS_REQUESTED', 'WAITLIST');

-- CreateEnum
CREATE TYPE "DecisionSource" AS ENUM ('MANUAL', 'CUTOFF');

-- CreateEnum
CREATE TYPE "SlotResponse" AS ENUM ('CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'NOT_CONFIGURED');

-- AlterTable
ALTER TABLE "event_roles" ADD COLUMN     "canMakeFinalDecisions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "chairRecommendation" "DecisionOutcome",
ADD COLUMN     "chairRecommendedAt" TIMESTAMP(3),
ADD COLUMN     "chairRecommendedById" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decision" "DecisionOutcome",
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "decisionReleasedAt" TIMESTAMP(3),
ADD COLUMN     "decisionSource" "DecisionSource",
ADD COLUMN     "presentationType" "PresentationTypeCode",
ADD COLUMN     "registrationFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "reviewsReleased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revisionDueAt" TIMESTAMP(3),
ADD COLUMN     "slotFilledById" TEXT,
ADD COLUMN     "slotRespondedAt" TIMESTAMP(3),
ADD COLUMN     "slotResponse" "SlotResponse";

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "submissionId" TEXT,
    "templateKey" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_templates_orgId_idx" ON "email_templates"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_eventId_key_key" ON "email_templates"("eventId", "key");

-- CreateIndex
CREATE INDEX "email_logs_eventId_idx" ON "email_logs"("eventId");

-- CreateIndex
CREATE INDEX "email_logs_orgId_idx" ON "email_logs"("orgId");

-- CreateIndex
CREATE INDEX "email_logs_submissionId_idx" ON "email_logs"("submissionId");

-- CreateIndex
CREATE INDEX "submissions_eventId_decision_idx" ON "submissions"("eventId", "decision");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
