import type { Prisma } from "@/app/generated/prisma/client";

type SubmissionRow = {
  id: string;
  orgId: string;
  eventId: string;
  refNo: string | null;
  submitterId: string;
  submissionTypeId: string;
  categoryId: string | null;
  title: string;
  status: string;
  preferredPresentationType: string | null;
  abstractBody: Prisma.JsonValue;
  keywords: string[];
  wordCount: number;
  customFieldValues: Prisma.JsonValue;
  ercStatus: string | null;
  ercInstitution: string | null;
  ercRefNo: string | null;
  ercFilePath: string | null;
  declarations: Prisma.JsonValue;
  prevPublishedDetails: string | null;
  submittedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuthorRow = {
  id: string;
  submissionId: string;
  surname: string;
  initials: string;
  email: string;
  institution: string | null;
  designation: string | null;
  slmcNo: string | null;
  membershipNo: string | null;
  affiliationNos: number[];
  isPresenting: boolean;
  isCorresponding: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type AffiliationRow = {
  id: string;
  submissionId: string;
  number: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeSubmission(
  s: SubmissionRow,
  opts?: { authors?: AuthorRow[]; affiliations?: AffiliationRow[] },
) {
  return {
    id: s.id,
    orgId: s.orgId,
    eventId: s.eventId,
    refNo: s.refNo,
    submitterId: s.submitterId,
    submissionTypeId: s.submissionTypeId,
    categoryId: s.categoryId,
    title: s.title,
    status: s.status,
    preferredPresentationType: s.preferredPresentationType,
    abstractBody: s.abstractBody,
    keywords: s.keywords,
    wordCount: s.wordCount,
    customFieldValues: s.customFieldValues,
    ercStatus: s.ercStatus,
    ercInstitution: s.ercInstitution,
    ercRefNo: s.ercRefNo,
    hasErcFile: !!s.ercFilePath,
    declarations: s.declarations,
    prevPublishedDetails: s.prevPublishedDetails,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    withdrawnAt: s.withdrawnAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    authors: opts?.authors?.map(serializeAuthor),
    affiliations: opts?.affiliations?.map(serializeAffiliation),
  };
}

export function serializeAuthor(a: AuthorRow) {
  return {
    id: a.id,
    submissionId: a.submissionId,
    surname: a.surname,
    initials: a.initials,
    email: a.email,
    institution: a.institution,
    designation: a.designation,
    slmcNo: a.slmcNo,
    membershipNo: a.membershipNo,
    affiliationNos: a.affiliationNos,
    isPresenting: a.isPresenting,
    isCorresponding: a.isCorresponding,
    sortOrder: a.sortOrder,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function serializeAffiliation(a: AffiliationRow) {
  return {
    id: a.id,
    submissionId: a.submissionId,
    number: a.number,
    text: a.text,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
