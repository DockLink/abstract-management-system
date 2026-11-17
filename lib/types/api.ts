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
