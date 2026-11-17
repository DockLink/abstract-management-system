import { z } from "@/lib/openapi/zod";

export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("ApiError");

export const appUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    fullName: z.string().nullable(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi("AppUser");

export const sessionSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number().int(),
    expiresAt: z.number().int().nullable(),
    tokenType: z.string(),
    isPlatformAdmin: z.boolean(),
    user: appUserSchema,
  })
  .openapi("Session");

export const orgSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    address: z.string().nullable().optional(),
    logoPath: z.string().nullable().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi("Organisation");

export const eventRoleTypeSchema = z
  .enum([
    "EVENT_ADMIN",
    "TRACK_CHAIR",
    "REVIEWER",
    "FINANCE_OFFICER",
    "SUBMITTER",
    "DELEGATE",
  ])
  .openapi("EventRoleType");

export const eventRoleSchema = z
  .object({
    id: z.string(),
    eventId: z.string(),
    userId: z.string(),
    role: eventRoleTypeSchema,
    categoryIds: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    user: z
      .object({
        id: z.string(),
        email: z.string().email(),
        fullName: z.string().nullable(),
      })
      .optional(),
  })
  .openapi("EventRole");

export const meOrganisationSchema = z
  .object({
    membershipId: z.string(),
    role: z.enum(["ORG_ADMIN", "MEMBER"]),
    organisation: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      logoPath: z.string().nullable().optional(),
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("MeOrganisation");

export const meEventRoleSchema = z
  .object({
    id: z.string(),
    role: eventRoleTypeSchema,
    categoryIds: z.array(z.string()),
    event: z.object({
      id: z.string(),
      orgId: z.string(),
      name: z.string(),
      slug: z.string(),
      edition: z.string().nullable().optional(),
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("MeEventRole");

export const platformAdminSchema = z
  .object({
    id: z.string(),
    email: z.string().email().nullable(),
    fullName: z.string().nullable(),
    isPlatformAdmin: z.boolean(),
  })
  .openapi("PlatformAdmin");

export const eventSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    name: z.string(),
    slug: z.string(),
    edition: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    logoPath: z.string().nullable().optional(),
    bannerPath: z.string().nullable().optional(),
    guidelinesPdfPath: z.string().nullable().optional(),
    guidelinesRichText: z.string().nullable().optional(),
    primaryColor: z.string().nullable().optional(),
    blindMode: z.enum(["NONE", "SINGLE", "DOUBLE"]).optional(),
    submissionOpenAt: z.string().datetime().nullable().optional(),
    submissionCloseAt: z.string().datetime().nullable().optional(),
    reviewDeadlineAt: z.string().datetime().nullable().optional(),
    notificationAt: z.string().datetime().nullable().optional(),
    earlyBirdEndAt: z.string().datetime().nullable().optional(),
    registrationCloseAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi("Event");

export const platformAdminUserIdParam = z.object({
  userId: z.string().min(1).openapi({ description: "Supabase / app user id" }),
});

export function dataEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema });
}

export const orgIdParam = z.object({
  orgId: z.string().min(1).openapi({ description: "Organisation id" }),
});

export const orgEventParams = z.object({
  orgId: z.string().min(1),
  eventId: z.string().min(1),
});

export const orgEventCategoryParams = orgEventParams.extend({
  categoryId: z.string().min(1),
});

export const orgEventSubmissionTypeParams = orgEventParams.extend({
  typeId: z.string().min(1),
});

export const orgEventMemberParams = orgEventParams.extend({
  memberId: z.string().min(1),
});

export const orgEventRoleParams = orgEventParams.extend({
  roleId: z.string().min(1),
});

export const orgMembershipParams = z.object({
  orgId: z.string().min(1),
  membershipId: z.string().min(1),
});

export const publicEventParams = z.object({
  orgSlug: z.string().min(1),
  eventSlug: z.string().min(1),
});
