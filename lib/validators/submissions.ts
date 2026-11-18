import { z } from "zod";

// --- Author ---
export const authorSchema = z.object({
  surname: z.string().min(1).max(100),
  initials: z.string().min(1).max(20),
  email: z.string().email().max(200),
  institution: z.string().max(300).optional().nullable(),
  designation: z.string().max(200).optional().nullable(),
  slmcNo: z.string().max(50).optional().nullable(),
  membershipNo: z.string().max(50).optional().nullable(),
  affiliationNos: z.array(z.number().int().positive()).optional().default([]),
  isPresenting: z.boolean().optional().default(false),
  isCorresponding: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});
export const updateAuthorSchema = authorSchema.partial();

// --- Affiliation ---
export const affiliationSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1).max(500),
});
export const updateAffiliationSchema = affiliationSchema.partial();

// --- ERC Status ---
export const ercStatusSchema = z.enum(["APPROVED", "EXEMPT", "NOT_APPLICABLE"]);

// --- Submission Status ---
export const submissionStatusSchema = z.enum([
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUESTED",
  "ACCEPTED", "REJECTED", "WAITLISTED", "CONFIRMED", "WITHDRAWN",
]);

// --- Abstract body section: { [sectionKey]: htmlString } ---
export const abstractBodySchema = z.record(z.string(), z.string());

// --- Create Submission ---
export const createSubmissionSchema = z.object({
  submissionTypeId: z.string().min(1),
  categoryId: z.string().min(1).optional().nullable(),
  title: z.string().min(1).max(500),
  preferredPresentationType: z.enum(["oral", "poster", "either"]).optional().nullable(),
  abstractBody: abstractBodySchema.optional().default({}),
  keywords: z.array(z.string().max(100)).max(10).optional().default([]),
  wordCount: z.number().int().nonnegative().optional().default(0),
  customFieldValues: z.record(z.string(), z.unknown()).optional().default({}),
  // ERC (SUB-08)
  ercStatus: ercStatusSchema.optional().nullable(),
  ercInstitution: z.string().max(300).optional().nullable(),
  ercRefNo: z.string().max(100).optional().nullable(),
  // Declarations (SUB-09) - stored as JSON flags
  declarations: z.record(z.string(), z.unknown()).optional().default({}),
  prevPublishedDetails: z.string().max(2000).optional().nullable(),
  // Authors (SUB-05) — can be provided at creation
  authors: z.array(authorSchema).optional(),
  // Affiliations (SUB-06)
  affiliations: z.array(affiliationSchema).optional(),
});

// --- Update Submission (all fields optional) ---
export const updateSubmissionSchema = createSubmissionSchema.partial().omit({ submissionTypeId: true });

// --- Submit action (change status to SUBMITTED) ---
export const submitActionSchema = z.object({
  action: z.literal("submit"),
});

// --- Withdraw action ---
export const withdrawActionSchema = z.object({
  action: z.literal("withdraw"),
});

// --- Admin patch (can change status) ---
export const adminPatchSubmissionSchema = z.object({
  status: submissionStatusSchema.optional(),
  categoryId: z.string().min(1).optional().nullable(),
  preferredPresentationType: z.enum(["oral", "poster", "either"]).optional().nullable(),
});

// --- Reorder authors ---
export const reorderAuthorsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

// --- Form field (SUB-01 form builder) ---
export const formFieldTypeSchema = z.enum([
  "TEXT", "LONG_TEXT", "DROPDOWN", "CHECKBOX", "RADIO", "FILE_UPLOAD", "NUMBER", "DATE",
]);

export const formFieldConditionSchema = z.object({
  fieldId: z.string().min(1),
  value: z.unknown(),
}).optional();

export const formFieldSchema = z.object({
  label: z.string().min(1).max(300),
  type: formFieldTypeSchema,
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().optional().default(false),
  helpText: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  condition: formFieldConditionSchema,
});
export const updateFormFieldSchema = formFieldSchema.partial();
export const reorderFormFieldsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

// --- List submissions query filters ---
export const listSubmissionsQuerySchema = z.object({
  status: submissionStatusSchema.optional(),
  categoryId: z.string().optional(),
  submissionTypeId: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// --- SUB-09: Required Declarations on Submit ---
export const declarationsSchema = z.object({
  allAuthorsConsented: z.boolean().optional().default(false),
  noIdentifiablePatientData: z.boolean().optional().default(false),
  conflictOfInterest: z.boolean().optional().default(false),
  conflictOfInterestDetails: z.string().max(1000).optional().nullable(),
  previouslyPresentedOrPublished: z.boolean().optional().default(false),
  previouslyPresentedOrPublishedDetails: z.string().max(2000).optional().nullable(),
});

// --- SUB-15: Duplicate Check Query ---
export const duplicateCheckQuerySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  excludeId: z.string().optional(),
  threshold: z.coerce.number().min(0.1).max(1.0).optional().default(0.75),
});

// --- SUB-16: My Submissions (Submitter Dashboard) Query ---
export const mySubmissionsQuerySchema = z.object({
  status: submissionStatusSchema.optional(),
  eventId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// --- Submission File Upload Query ---
export const submissionFileUploadKindSchema = z.enum(["erc", "custom"]);
