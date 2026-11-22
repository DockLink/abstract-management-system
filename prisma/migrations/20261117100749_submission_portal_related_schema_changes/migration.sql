-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISIONS_REQUESTED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'CONFIRMED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ErcStatus" AS ENUM ('APPROVED', 'EXEMPT', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'FILE_UPLOAD', 'NUMBER', 'DATE');

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "submissionTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "refNo" TEXT,
    "submitterId" TEXT NOT NULL,
    "submissionTypeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "preferredPresentationType" TEXT,
    "abstractBody" JSONB NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "customFieldValues" JSONB NOT NULL DEFAULT '{}',
    "ercStatus" "ErcStatus",
    "ercInstitution" TEXT,
    "ercRefNo" TEXT,
    "ercFilePath" TEXT,
    "prevPublishedDetails" TEXT,
    "declarations" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_authors" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "institution" TEXT,
    "designation" TEXT,
    "slmcNo" TEXT,
    "membershipNo" TEXT,
    "affiliationNos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isPresenting" BOOLEAN NOT NULL DEFAULT false,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_affiliations" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_versions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_fields_submissionTypeId_idx" ON "form_fields"("submissionTypeId");

-- CreateIndex
CREATE INDEX "form_fields_eventId_idx" ON "form_fields"("eventId");

-- CreateIndex
CREATE INDEX "form_fields_orgId_idx" ON "form_fields"("orgId");

-- CreateIndex
CREATE INDEX "submissions_eventId_idx" ON "submissions"("eventId");

-- CreateIndex
CREATE INDEX "submissions_orgId_idx" ON "submissions"("orgId");

-- CreateIndex
CREATE INDEX "submissions_submitterId_idx" ON "submissions"("submitterId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_eventId_refNo_key" ON "submissions"("eventId", "refNo");

-- CreateIndex
CREATE INDEX "submission_authors_submissionId_idx" ON "submission_authors"("submissionId");

-- CreateIndex
CREATE INDEX "submission_affiliations_submissionId_idx" ON "submission_affiliations"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_affiliations_submissionId_number_key" ON "submission_affiliations"("submissionId", "number");

-- CreateIndex
CREATE INDEX "submission_versions_submissionId_idx" ON "submission_versions"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_versions_submissionId_version_key" ON "submission_versions"("submissionId", "version");

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_submissionTypeId_fkey" FOREIGN KEY ("submissionTypeId") REFERENCES "submission_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submissionTypeId_fkey" FOREIGN KEY ("submissionTypeId") REFERENCES "submission_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_authors" ADD CONSTRAINT "submission_authors_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_affiliations" ADD CONSTRAINT "submission_affiliations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
