import { z } from "zod";

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

/** Top-level app routes: an org with one of these slugs would be unreachable. */
const RESERVED_ORG_SLUGS = new Set([
  "api", "api-docs", "auth", "dev", "login", "my-reviews", "org", "platform", "swagger-ui",
]);

export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema.refine((slug) => !RESERVED_ORG_SLUGS.has(slug), "This web address is reserved"),
  address: z.string().max(500).optional().nullable(),
});

export const inviteOrgMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200).optional(),
  role: z.literal("ORG_ADMIN"),
});

export const invitedEventRoleEnum = z.enum([
  "EVENT_ADMIN",
  "TRACK_CHAIR",
  "REVIEWER",
  "FINANCE_OFFICER",
]);

export const inviteEventRoleSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200).optional(),
  role: invitedEventRoleEnum,
  categoryIds: z.array(z.string().min(1)).optional(),
});

export const joinEventRoleSchema = z.object({
  role: z.enum(["SUBMITTER", "DELEGATE"]),
});

export const updateEventRoleSchema = z.object({
  categoryIds: z.array(z.string().min(1)),
});
