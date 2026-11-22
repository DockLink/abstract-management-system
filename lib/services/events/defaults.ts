import type { Prisma } from "@/app/generated/prisma/client";
import { PresentationTypeCode } from "@/app/generated/prisma/client";

export const DEFAULT_IMRAD_SECTIONS = [
  { key: "introduction", label: "Introduction" },
  { key: "objectives", label: "Objectives" },
  { key: "methods", label: "Methods" },
  { key: "results", label: "Results" },
  { key: "conclusions", label: "Conclusions" },
] as const;

export const DEFAULT_PRESENTATION_TYPES: Array<{
  code: PresentationTypeCode;
  label: string;
  sortOrder: number;
}> = [
  { code: PresentationTypeCode.ORAL, label: "Oral", sortOrder: 0 },
  { code: PresentationTypeCode.POSTER, label: "Poster", sortOrder: 1 },
  {
    code: PresentationTypeCode.ORAL_OR_POSTER,
    label: "Oral or poster",
    sortOrder: 2,
  },
];

export const DEFAULT_SUBMISSION_TYPES: Array<{
  name: string;
  wordLimit: number;
  requiresErc: boolean;
  sortOrder: number;
  sections: Prisma.InputJsonValue;
}> = [
  {
    name: "Original research",
    wordLimit: 300,
    requiresErc: true,
    sortOrder: 0,
    sections: [...DEFAULT_IMRAD_SECTIONS],
  },
  {
    name: "Clinical audit",
    wordLimit: 300,
    requiresErc: true,
    sortOrder: 1,
    sections: [...DEFAULT_IMRAD_SECTIONS],
  },
  {
    name: "Case report",
    wordLimit: 300,
    requiresErc: false,
    sortOrder: 2,
    sections: [
      { key: "background", label: "Background" },
      { key: "case", label: "Case" },
      { key: "discussion", label: "Discussion" },
    ],
  },
];

export function eventSeedNestedCreate(orgId: string) {
  return {
    presentationTypes: {
      create: DEFAULT_PRESENTATION_TYPES.map((t) => ({
        orgId,
        code: t.code,
        label: t.label,
        sortOrder: t.sortOrder,
        isActive: true,
      })),
    },
    eligibilityRule: {
      create: {
        orgId,
        maxAbstractsPerAuthor: 2,
        requireMemberAuthor: false,
        presentingAuthorMustRegister: true,
      },
    },
    submissionTypes: {
      create: DEFAULT_SUBMISSION_TYPES.map((t) => ({
        orgId,
        name: t.name,
        wordLimit: t.wordLimit,
        requiresErc: t.requiresErc,
        sortOrder: t.sortOrder,
        sections: t.sections,
      })),
    },
  };
}
