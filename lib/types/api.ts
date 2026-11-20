import type { PortalState } from "@/lib/services/events/portal-state";

export type KeyDates = {
  submissionOpenAt: string | null;
  submissionCloseAt: string | null;
  reviewDeadlineAt: string | null;
  notificationAt: string | null;
  earlyBirdEndAt: string | null;
  registrationCloseAt: string | null;
};

export type EventDto = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  edition: string | null;
  venue: string | null;
  startsAt: string | null;
  endsAt: string | null;
  logoPath: string | null;
  bannerPath: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  guidelinesRichText: string | null;
  guidelinesPdfPath: string | null;
  primaryColor: string | null;
  blindMode: "NONE" | "SINGLE" | "DOUBLE";
  settings: Record<string, unknown>;
  keyDates: KeyDates;
  createdAt: string;
  updatedAt: string;
};

export type OrganisationDto = {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    slmcNo: string | null;
    createdAt: string;
    updatedAt: string;
  };
  isPlatformAdmin: boolean;
  organisations: Array<{
    membershipId: string;
    role: "ORG_ADMIN" | "MEMBER";
    organisation: {
      id: string;
      name: string;
      slug: string;
      logoPath: string | null;
    };
    createdAt: string;
  }>;
  eventRoles: Array<{
    id: string;
    role: string;
    categoryIds: string[];
    event: {
      id: string;
      orgId: string;
      name: string;
      slug: string;
      edition: string | null;
    };
    createdAt: string;
  }>;
};

export type CategoryDto = {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  chairUserId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionTypeDto = {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  wordLimit: number;
  sections: Array<{ key: string; label: string }>;
  requiresErc: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PresentationTypeDto = {
  id: string;
  orgId: string;
  eventId: string;
  code: "ORAL" | "POSTER" | "ORAL_OR_POSTER";
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EligibilityDto = {
  id: string;
  orgId: string;
  eventId: string;
  maxAbstractsPerAuthor: number;
  requireMemberAuthor: boolean;
  presentingAuthorMustRegister: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberDto = {
  id: string;
  orgId: string;
  name: string;
  membershipNo: string | null;
  slmcNo: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRoleDto = {
  id: string;
  eventId: string;
  userId: string;
  role: string;
  categoryIds: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

export type DeadlineExtensionDto = {
  id: string;
  orgId: string;
  eventId: string;
  submitterUserId: string;
  extendsUntil: string;
  reason: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardDto = {
  event: EventDto;
  portalState: PortalState;
  configCompleteness: Record<string, boolean>;
  submissionsByStatus: Record<string, number>;
  submissionsByCategory: Array<{ categoryId: string; name: string; count: number }>;
  reviews: { done: number; pending: number; total: number };
  registrations: { count: number; revenue: number; currency: string };
  counts: {
    categories: number;
    submissionTypes: number;
    presentationTypes: number;
    members: number;
    deadlineExtensions: number;
  };
};

export type PublicEventDto = {
  organisation: {
    name: string;
    slug: string;
    logoPath: string | null;
  };
  event: {
    name: string;
    slug: string;
    edition: string | null;
    venue: string | null;
    startsAt: string | null;
    endsAt: string | null;
    logoPath: string | null;
    bannerPath: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    guidelinesRichText: string | null;
    guidelinesPdfPath: string | null;
    primaryColor: string | null;
    keyDates: KeyDates;
    /** Submission tracks, in display order. */
    categories: Array<{ id: string; name: string }>;
  };
  portalState: PortalState;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number | null;
  tokenType: string;
  isPlatformAdmin: boolean;
  user: MeResponse["user"];
};

export type FormFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "DROPDOWN"
  | "CHECKBOX"
  | "RADIO"
  | "FILE_UPLOAD"
  | "NUMBER"
  | "DATE";

export type FormFieldDto = {
  id: string;
  orgId: string;
  eventId: string;
  submissionTypeId: string;
  label: string;
  type: FormFieldType;
  options: string[] | null;
  required: boolean;
  helpText: string | null;
  sortOrder: number;
  condition: { fieldId: string; value: unknown } | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionAuthorDto = {
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
};

export type SubmissionAffiliationDto = {
  id: string;
  submissionId: string;
  number: number;
  text: string;
};

export type SubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISIONS_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED"
  | "CONFIRMED"
  | "WITHDRAWN";

export type SubmissionDto = {
  id: string;
  orgId: string;
  eventId: string;
  refNo: string | null;
  submitterId: string;
  submissionTypeId: string;
  categoryId: string | null;
  title: string;
  status: SubmissionStatus;
  preferredPresentationType: "oral" | "poster" | "either" | null;
  abstractBody: Record<string, string>;
  keywords: string[];
  wordCount: number;
  customFieldValues: Record<string, unknown>;
  ercStatus: "APPROVED" | "EXEMPT" | "NOT_APPLICABLE" | null;
  ercInstitution: string | null;
  ercRefNo: string | null;
  hasErcFile: boolean;
  declarations: {
    allAuthorsConsented?: boolean;
    noIdentifiablePatientData?: boolean;
    conflictOfInterest?: boolean;
    conflictOfInterestDetails?: string;
    previouslyPresentedOrPublished?: boolean;
    previouslyPresentedOrPublishedDetails?: string;
  };
  prevPublishedDetails: string | null;
  submittedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  authors?: SubmissionAuthorDto[];
  affiliations?: SubmissionAffiliationDto[];
};

export type MySubmissionItemDto = SubmissionDto & {
  event: {
    id: string;
    name: string;
    slug: string;
    orgSlug: string;
    orgName: string;
    portalState: PortalState;
    keyDates: KeyDates;
  };
  submissionTypeName: string;
  categoryName: string | null;
  canEdit: boolean;
  canWithdraw: boolean;
  registerCta: { label: string; url: string; confirmed: boolean } | null;
};

export type SubmissionVersionDto = {
  id: string;
  version: number;
  content: unknown;
  createdById: string;
  createdAt: string;
};
