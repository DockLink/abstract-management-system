-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "EventRoleType" AS ENUM ('EVENT_ADMIN', 'TRACK_CHAIR', 'REVIEWER', 'FINANCE_OFFICER', 'SUBMITTER', 'DELEGATE');

-- CreateEnum
CREATE TYPE "BlindMode" AS ENUM ('NONE', 'SINGLE', 'DOUBLE');

-- CreateEnum
CREATE TYPE "PresentationTypeCode" AS ENUM ('ORAL', 'POSTER', 'ORAL_OR_POSTER');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoPath" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "slmcNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_roles" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EventRoleType" NOT NULL,
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "edition" TEXT,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "logoPath" TEXT,
    "bannerPath" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "guidelinesRichText" TEXT,
    "guidelinesPdfPath" TEXT,
    "primaryColor" TEXT,
    "blindMode" "BlindMode" NOT NULL DEFAULT 'DOUBLE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "submissionOpenAt" TIMESTAMP(3),
    "submissionCloseAt" TIMESTAMP(3),
    "reviewDeadlineAt" TIMESTAMP(3),
    "notificationAt" TIMESTAMP(3),
    "earlyBirdEndAt" TIMESTAMP(3),
    "registrationCloseAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chairUserId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wordLimit" INTEGER NOT NULL DEFAULT 300,
    "sections" JSONB NOT NULL DEFAULT '[{"key":"introduction","label":"Introduction"},{"key":"objectives","label":"Objectives"},{"key":"methods","label":"Methods"},{"key":"results","label":"Results"},{"key":"conclusions","label":"Conclusions"}]',
    "requiresErc" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" "PresentationTypeCode" NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "maxAbstractsPerAuthor" INTEGER NOT NULL DEFAULT 2,
    "requireMemberAuthor" BOOLEAN NOT NULL DEFAULT false,
    "presentingAuthorMustRegister" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "membershipNo" TEXT,
    "slmcNo" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_extensions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "submitterUserId" TEXT NOT NULL,
    "extendsUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadline_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "org_memberships_userId_idx" ON "org_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_orgId_userId_key" ON "org_memberships"("orgId", "userId");

-- CreateIndex
CREATE INDEX "event_roles_userId_idx" ON "event_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_roles_eventId_userId_role_key" ON "event_roles"("eventId", "userId", "role");

-- CreateIndex
CREATE INDEX "events_orgId_idx" ON "events"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "events_orgId_slug_key" ON "events"("orgId", "slug");

-- CreateIndex
CREATE INDEX "categories_eventId_idx" ON "categories"("eventId");

-- CreateIndex
CREATE INDEX "categories_orgId_idx" ON "categories"("orgId");

-- CreateIndex
CREATE INDEX "submission_types_eventId_idx" ON "submission_types"("eventId");

-- CreateIndex
CREATE INDEX "submission_types_orgId_idx" ON "submission_types"("orgId");

-- CreateIndex
CREATE INDEX "presentation_types_eventId_idx" ON "presentation_types"("eventId");

-- CreateIndex
CREATE INDEX "presentation_types_orgId_idx" ON "presentation_types"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_types_eventId_code_key" ON "presentation_types"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_rules_eventId_key" ON "eligibility_rules"("eventId");

-- CreateIndex
CREATE INDEX "eligibility_rules_orgId_idx" ON "eligibility_rules"("orgId");

-- CreateIndex
CREATE INDEX "members_orgId_idx" ON "members"("orgId");

-- CreateIndex
CREATE INDEX "members_orgId_membershipNo_idx" ON "members"("orgId", "membershipNo");

-- CreateIndex
CREATE INDEX "members_orgId_email_idx" ON "members"("orgId", "email");

-- CreateIndex
CREATE INDEX "deadline_extensions_eventId_idx" ON "deadline_extensions"("eventId");

-- CreateIndex
CREATE INDEX "deadline_extensions_orgId_idx" ON "deadline_extensions"("orgId");

-- CreateIndex
CREATE INDEX "deadline_extensions_submitterUserId_idx" ON "deadline_extensions"("submitterUserId");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_idx" ON "audit_logs"("orgId");

-- CreateIndex
CREATE INDEX "audit_logs_eventId_idx" ON "audit_logs"("eventId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_types" ADD CONSTRAINT "submission_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_types" ADD CONSTRAINT "submission_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_types" ADD CONSTRAINT "presentation_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_types" ADD CONSTRAINT "presentation_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_extensions" ADD CONSTRAINT "deadline_extensions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_extensions" ADD CONSTRAINT "deadline_extensions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_extensions" ADD CONSTRAINT "deadline_extensions_submitterUserId_fkey" FOREIGN KEY ("submitterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_extensions" ADD CONSTRAINT "deadline_extensions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
