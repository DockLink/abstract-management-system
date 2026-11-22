import { z } from "zod";

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const isoDate = z.coerce.date();

export const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  edition: z.string().max(200).optional().nullable(),
  venue: z.string().max(300).optional().nullable(),
  startsAt: isoDate.optional().nullable(),
  endsAt: isoDate.optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  guidelinesRichText: z.string().optional().nullable(),
  primaryColor: z.string().max(20).optional().nullable(),
  blindMode: z.enum(["NONE", "SINGLE", "DOUBLE"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  submissionOpenAt: isoDate.optional().nullable(),
  submissionCloseAt: isoDate.optional().nullable(),
  reviewDeadlineAt: isoDate.optional().nullable(),
  notificationAt: isoDate.optional().nullable(),
  earlyBirdEndAt: isoDate.optional().nullable(),
  registrationCloseAt: isoDate.optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  name: z.string().min(1).max(200).optional(),
  slug: slugSchema.optional(),
});

export const keyDatesSchema = z.object({
  submissionOpenAt: isoDate.nullable().optional(),
  submissionCloseAt: isoDate.nullable().optional(),
  reviewDeadlineAt: isoDate.nullable().optional(),
  notificationAt: isoDate.nullable().optional(),
  earlyBirdEndAt: isoDate.nullable().optional(),
  registrationCloseAt: isoDate.nullable().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(200),
  chairUserId: z.string().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = categorySchema.partial();

const sectionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const submissionTypeSchema = z.object({
  name: z.string().min(1).max(200),
  wordLimit: z.number().int().positive().max(5000).optional(),
  sections: z.array(sectionSchema).optional(),
  requiresErc: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateSubmissionTypeSchema = submissionTypeSchema.partial();

export const presentationTypesSchema = z.object({
  types: z
    .array(
      z.object({
        code: z.enum(["ORAL", "POSTER", "ORAL_OR_POSTER"]),
        label: z.string().min(1).max(100),
        isActive: z.boolean().optional().default(true),
        sortOrder: z.number().int().optional(),
      }),
    )
    .min(1),
});

export const eligibilitySchema = z.object({
  maxAbstractsPerAuthor: z.number().int().positive().max(50),
  requireMemberAuthor: z.boolean(),
  presentingAuthorMustRegister: z.boolean(),
});

export const cloneEventSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  edition: z.string().max(200).optional().nullable(),
});

export const deadlineExtensionSchema = z.object({
  submitterUserId: z.string().min(1),
  extendsUntil: isoDate,
  reason: z.string().max(1000).optional().nullable(),
});

export const assetKindSchema = z.enum(["logo", "banner", "guidelines"]);
