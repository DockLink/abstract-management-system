-- CreateEnum
CREATE TYPE "ReviewerInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ReviewAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('ACCEPT_ORAL', 'ACCEPT_POSTER', 'REJECT', 'REVISE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "institution" TEXT;

-- AlterTable
ALTER TABLE "event_roles" ADD COLUMN "maxLoad" INTEGER DEFAULT 20,
ADD COLUMN "invitationStatus" "ReviewerInviteStatus" DEFAULT 'PENDING',
ADD COLUMN "confidentialityAgreedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scaleMin" INTEGER NOT NULL DEFAULT 1,
    "scaleMax" INTEGER NOT NULL DEFAULT 5,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "coiReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "recommendation" "ReviewRecommendation",
    "commentAuthor" TEXT,
    "commentCommittee" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_scores" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rubric_criteria_eventId_idx" ON "rubric_criteria"("eventId");

-- CreateIndex
CREATE INDEX "rubric_criteria_orgId_idx" ON "rubric_criteria"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "review_assignments_submissionId_reviewerId_key" ON "review_assignments"("submissionId", "reviewerId");

-- CreateIndex
CREATE INDEX "review_assignments_eventId_idx" ON "review_assignments"("eventId");

-- CreateIndex
CREATE INDEX "review_assignments_orgId_idx" ON "review_assignments"("orgId");

-- CreateIndex
CREATE INDEX "review_assignments_submissionId_idx" ON "review_assignments"("submissionId");

-- CreateIndex
CREATE INDEX "review_assignments_reviewerId_idx" ON "review_assignments"("reviewerId");

-- CreateIndex
CREATE INDEX "review_assignments_status_idx" ON "review_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_assignmentId_key" ON "reviews"("assignmentId");

-- CreateIndex
CREATE INDEX "reviews_eventId_idx" ON "reviews"("eventId");

-- CreateIndex
CREATE INDEX "reviews_orgId_idx" ON "reviews"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "review_scores_reviewId_criterionId_key" ON "review_scores"("reviewId", "criterionId");

-- CreateIndex
CREATE INDEX "review_scores_reviewId_idx" ON "review_scores"("reviewId");

-- CreateIndex
CREATE INDEX "review_scores_criterionId_idx" ON "review_scores"("criterionId");

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

