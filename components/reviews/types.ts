export type ReviewerInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type ReviewAssignmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CONFLICT";

export type ReviewRecommendation = "ACCEPT_ORAL" | "ACCEPT_POSTER" | "REJECT" | "REVISE";

export interface ReviewerItem {
  id: string; // role id
  userId: string;
  email: string;
  fullName: string | null;
  institution: string | null;
  categoryIds: string[];
  categories: Array<{ id: string; name: string }>;
  maxLoad: number;
  invitationStatus: ReviewerInviteStatus;
  confidentialityAgreedAt: string | null;
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  conflictCount: number;
  createdAt: string;
}

export interface RubricCriterionItem {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  description: string | null;
  scaleMin: number;
  scaleMax: number;
  weight: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentItem {
  id: string;
  orgId: string;
  eventId: string;
  submissionId: string;
  reviewerId: string;
  status: ReviewAssignmentStatus;
  dueAt: string | null;
  coiReason: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    email: string;
    fullName: string | null;
    institution: string | null;
  };
  submission?: {
    id: string;
    refNo: string | null;
    title: string;
    status: string;
    category: { id: string; name: string } | null;
    submissionType: { id: string; name: string } | null;
  };
  review?: {
    id: string;
    recommendation: ReviewRecommendation | null;
    commentAuthor: string | null;
    commentCommittee: string | null;
    isDraft: boolean;
    submittedAt: string | null;
    scores: Array<{
      id: string;
      criterionId: string;
      score: number;
      criterion?: RubricCriterionItem;
    }>;
  } | null;
}

export interface ProgressSummaryDto {
  overview: {
    totalSubmissions: number;
    underReviewSubmissions: number;
    totalAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
    conflictAssignments: number;
    percentComplete: number;
  };
  reviewers: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    institution: string | null;
    maxLoad: number;
    assignedCount: number;
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    conflictCount: number;
    percentComplete: number;
    lastReviewAt: string | null;
  }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    submissionCount: number;
    assignedCount: number;
    completedCount: number;
    percentComplete: number;
  }>;
}

export interface SubmissionScoreRowDto {
  submissionId: string;
  refNo: string | null;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  preferredPresentationType: string | null;
  completedReviewCount: number;
  assignedReviewCount: number;
  averageScore: number;
  weightedAverageScore: number;
  standardDeviation: number;
  scoreGap: number;
  isDisputed: boolean;
  disputeReason: string | null;
  reviews: Array<{
    reviewerId: string;
    reviewerName: string | null;
    recommendation: ReviewRecommendation | null;
    weightedScore: number;
    criterionScores: Array<{
      criterionId: string;
      criterionName: string;
      score: number;
      weight: number;
    }>;
    commentAuthor: string | null;
    commentCommittee: string | null;
    submittedAt: string | null;
  }>;
}

export interface ReviewScreenDataDto {
  assignment: {
    id: string;
    status: ReviewAssignmentStatus;
    dueAt: string | null;
    coiReason: string | null;
    createdAt: string;
  };
  submission: {
    id: string;
    refNo: string | null;
    title: string;
    abstractBody: Record<string, string>;
    keywords: string[];
    wordCount: number;
    preferredPresentationType: string | null;
    category: { id: string; name: string } | null;
    submissionType: { id: string; name: string } | null;
    submittedAt: string | null;
    blindMode: "NONE" | "SINGLE" | "DOUBLE";
    authors: Array<{
      surname: string;
      initials: string;
      affiliationNos: number[];
      isPresenting: boolean;
      isCorresponding: boolean;
      sortOrder: number;
    }>;
    affiliations: Array<{
      number: number;
      text: string;
    }>;
  };
  rubricCriteria: RubricCriterionItem[];
  review: {
    id: string;
    recommendation: ReviewRecommendation | null;
    commentAuthor: string | null;
    commentCommittee: string | null;
    isDraft: boolean;
    submittedAt: string | null;
    scores: Array<{
      id: string;
      criterionId: string;
      score: number;
      criterion?: RubricCriterionItem;
    }>;
  } | null;
  navigation: {
    currentIndex: number;
    totalAssignments: number;
    prevAssignmentId: string | null;
    nextAssignmentId: string | null;
  };
  otherReviews?: Array<{
    recommendation: ReviewRecommendation | null;
    scores: Array<{ criterionId: string; score: number }>;
  }>;
}

export interface ReviewerDashboardDataDto {
  hasAgreedToConfidentiality: boolean;
  invitationStatus?: ReviewerInviteStatus;
  confidentialityAgreedAt?: string | null;
  message?: string;
  deadline: {
    reviewDeadlineAt: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
  };
  stats: {
    totalAssigned: number;
    pending: number;
    inProgress: number;
    completed: number;
    conflict: number;
  };
  assignments: Array<{
    assignmentId: string;
    submissionId: string;
    refNo: string | null;
    title: string;
    category: { id: string; name: string } | null;
    submissionType: { id: string; name: string } | null;
    status: ReviewAssignmentStatus;
    dueAt: string | null;
    coiReason: string | null;
    review: {
      isDraft: boolean;
      recommendation: ReviewRecommendation | null;
      weightedScore: number | null;
      submittedAt: string | null;
    } | null;
  }>;
}

