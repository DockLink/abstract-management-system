"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { AbstractSectionEditor } from "@/components/submissions/abstract-section-editor";
import { countAbstractBodyWords } from "@/lib/html";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  AlertTriangle,
  Upload,
  UserCheck,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import type {
  CategoryDto,
  FormFieldDto,
  PresentationTypeDto,
  SubmissionAuthorDto,
  SubmissionAffiliationDto,
  SubmissionDto,
  SubmissionTypeDto,
} from "@/lib/types/api";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { step: 1, label: "Details", desc: "Type & Category" },
  { step: 2, label: "Authors", desc: "Authors & Affiliations" },
  { step: 3, label: "Abstract", desc: "Structured Body & Fields" },
  { step: 4, label: "Ethics", desc: "ERC & Declarations" },
  { step: 5, label: "Review", desc: "Final Verification" },
] as const;

export function SubmissionFormWizard({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  existingSubmissionId,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  existingSubmissionId?: string | null;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [initialLoading, setInitialLoading] = useState(true);

  // Aux data
  const [submissionTypes, setSubmissionTypes] = useState<SubmissionTypeDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationTypeDto[]>([]);
  const [formFields, setFormFields] = useState<FormFieldDto[]>([]);

  // Submission state
  const [submissionId, setSubmissionId] = useState<string | null>(existingSubmissionId || null);
  const [submissionStatus, setSubmissionStatus] = useState<string>("DRAFT");
  const [refNo, setRefNo] = useState<string | null>(null);

  // Step 1: Details
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [preferredPresentation, setPreferredPresentation] = useState<string>("either");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Step 2: Authors & Affiliations
  const [affiliations, setAffiliations] = useState<SubmissionAffiliationDto[]>([]);
  const [authors, setAuthors] = useState<SubmissionAuthorDto[]>([]);
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [editingAuthorIdx, setEditingAuthorIdx] = useState<number | null>(null);
  const [authorForm, setAuthorForm] = useState<{
    surname: string;
    initials: string;
    email: string;
    institution: string;
    designation: string;
    slmcNo: string;
    membershipNo: string;
    affiliationNos: number[];
    isPresenting: boolean;
    isCorresponding: boolean;
  }>({
    surname: "",
    initials: "",
    email: "",
    institution: "",
    designation: "",
    slmcNo: "",
    membershipNo: "",
    affiliationNos: [],
    isPresenting: false,
    isCorresponding: false,
  });

  // Step 3: Abstract Sections & Custom Fields
  const [abstractBody, setAbstractBody] = useState<Record<string, string>>({});
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Step 4: ERC & Declarations
  const [ercStatus, setErcStatus] = useState<"APPROVED" | "EXEMPT" | "NOT_APPLICABLE" | "">("");
  const [ercInstitution, setErcInstitution] = useState("");
  const [ercRefNo, setErcRefNo] = useState("");
  const [ercFileUploaded, setErcFileUploaded] = useState(false);
  const [ercUploading, setErcUploading] = useState(false);

  // Declarations
  const [allAuthorsConsented, setAllAuthorsConsented] = useState(false);
  const [noIdentifiableData, setNoIdentifiableData] = useState(false);
  const [noConflictOfInterest, setNoConflictOfInterest] = useState(true);
  const [conflictDetails, setConflictDetails] = useState("");
  const [previouslyPresented, setPreviouslyPresented] = useState(false);
  const [previouslyPresentedDetails, setPreviouslyPresentedDetails] = useState("");

  // Auto-save & Submission State
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  // Find currently selected submission type object
  const currentSubmissionType = useMemo(
    () => submissionTypes.find((t) => t.id === selectedTypeId) || null,
    [submissionTypes, selectedTypeId],
  );

  // Sections defined for currently selected type
  const sections = useMemo(() => {
    if (!currentSubmissionType || !Array.isArray(currentSubmissionType.sections)) return [];
    return currentSubmissionType.sections;
  }, [currentSubmissionType]);

  // Total word count across all sections
  const totalWordCount = useMemo(() => {
    return countAbstractBodyWords(abstractBody);
  }, [abstractBody]);

  const maxWords = currentSubmissionType?.wordLimit || 300;
  const isOverWordLimit = totalWordCount > maxWords;

  // Load auxiliary data
  useEffect(() => {
    async function loadAux() {
      try {
        const [typesRes, catsRes, presRes] = await Promise.all([
          apiFetch<SubmissionTypeDto[]>(`${base}/submission-types`),
          apiFetch<CategoryDto[]>(`${base}/categories`),
          apiFetch<PresentationTypeDto[]>(`${base}/presentation-types`),
        ]);

        if (typesRes.ok && typesRes.data.length > 0) {
          setSubmissionTypes(typesRes.data);
          if (!selectedTypeId) setSelectedTypeId(typesRes.data[0]!.id);
        }
        if (catsRes.ok) setCategories(catsRes.data);
        if (presRes.ok) setPresentationTypes(presRes.data);

        // If existing submission, fetch it
        if (existingSubmissionId) {
          const subRes = await apiFetch<SubmissionDto>(`${base}/submissions/${existingSubmissionId}`);
          if (subRes.ok) {
            const sub = subRes.data;
            setSubmissionId(sub.id);
            setSubmissionStatus(sub.status);
            setRefNo(sub.refNo);
            setSelectedTypeId(sub.submissionTypeId);
            setSelectedCategoryId(sub.categoryId || "");
            setTitle(sub.title);
            setPreferredPresentation(sub.preferredPresentationType || "either");
            setAbstractBody(sub.abstractBody || {});
            setKeywords(sub.keywords || []);
            setCustomFieldValues(sub.customFieldValues || {});
            setErcStatus(sub.ercStatus || "");
            setErcInstitution(sub.ercInstitution || "");
            setErcRefNo(sub.ercRefNo || "");
            setErcFileUploaded(sub.hasErcFile);
            setAllAuthorsConsented(!!sub.declarations?.allAuthorsConsented);
            setNoIdentifiableData(!!sub.declarations?.noIdentifiablePatientData);
            setNoConflictOfInterest(sub.declarations?.conflictOfInterest !== false);
            setConflictDetails(sub.declarations?.conflictOfInterestDetails || "");
            setPreviouslyPresented(!!sub.declarations?.previouslyPresentedOrPublished);
            setPreviouslyPresentedDetails(sub.prevPublishedDetails || sub.declarations?.previouslyPresentedOrPublishedDetails || "");

            if (sub.authors) setAuthors(sub.authors);
            if (sub.affiliations) setAffiliations(sub.affiliations);
          } else {
            toast.error(subRes.error.message || "Failed to load submission");
          }
        }
      } finally {
        setInitialLoading(false);
      }
    }

    void loadAux();
  }, [base, existingSubmissionId, selectedTypeId]);

  // Load custom form fields whenever selectedTypeId changes
  useEffect(() => {
    if (!selectedTypeId) return;
    async function loadFields() {
      const res = await apiFetch<FormFieldDto[]>(
        `${base}/submission-types/${selectedTypeId}/form-fields`,
      );
      if (res.ok) setFormFields(res.data);
    }
    void loadFields();
  }, [base, selectedTypeId]);

  // Duplicate title check debounced
  useEffect(() => {
    if (!title || title.trim().length < 5) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      const excludeParam = submissionId ? `&excludeId=${submissionId}` : "";
      const res = await apiFetch<{ matches: Array<{ title: string; similarity: number; refNo: string | null }> }>(
        `${base}/submissions/duplicate-check?title=${encodeURIComponent(title)}${excludeParam}`,
      );
      if (res.ok && res.data.matches && res.data.matches.length > 0) {
        const top = res.data.matches[0]!;
        setDuplicateWarning(
          `Similar abstract detected: "${top.title}" (${Math.round(top.similarity * 100)}% match). Please verify you are not submitting a duplicate.`,
        );
      } else {
        setDuplicateWarning(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [base, title, submissionId]);

  // Auto-save draft function (SUB-11)
  const saveDraft = useCallback(
    async (silent = false) => {
      if (!selectedTypeId || !title.trim()) {
        if (!silent) toast.error("Please provide at least a title and submission type to save a draft.");
        return;
      }

      setSavingDraft(true);
      try {
        const payload = {
          submissionTypeId: selectedTypeId,
          categoryId: selectedCategoryId || null,
          title: title.trim(),
          preferredPresentationType: preferredPresentation,
          abstractBody,
          keywords,
          wordCount: totalWordCount,
          customFieldValues,
          ercStatus: ercStatus || null,
          ercInstitution: ercInstitution.trim() || null,
          ercRefNo: ercRefNo.trim() || null,
          prevPublishedDetails: previouslyPresentedDetails.trim() || null,
          declarations: {
            allAuthorsConsented,
            noIdentifiablePatientData: noIdentifiableData,
            conflictOfInterest: !noConflictOfInterest,
            conflictOfInterestDetails: conflictDetails.trim() || null,
            previouslyPresentedOrPublished: previouslyPresented,
            previouslyPresentedOrPublishedDetails: previouslyPresentedDetails.trim() || null,
          },
        };

        if (submissionId) {
          // Update existing
          const res = await apiFetch<SubmissionDto>(`${base}/submissions/${submissionId}`, {
            method: "PATCH",
            body: payload,
          });
          if (res.ok) {
            setLastSavedAt(new Date());
            if (!silent) toast.success("Draft saved");
          } else if (!silent) {
            toast.error(res.error.message || "Failed to update draft");
          }
        } else {
          // Create new draft
          const createPayload = {
            ...payload,
            authors: authors.map((a, idx) => ({
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
              sortOrder: idx,
            })),
            affiliations: affiliations.map((aff) => ({
              number: aff.number,
              text: aff.text,
            })),
          };

          const res = await apiFetch<{ submission: SubmissionDto }>(`${base}/submissions`, {
            method: "POST",
            body: createPayload,
          });

          if (res.ok) {
            setSubmissionId(res.data.submission.id);
            setLastSavedAt(new Date());
            if (!silent) toast.success("Draft created");
          } else if (!silent) {
            toast.error(res.error.message || "Failed to create draft");
          }
        }
      } finally {
        setSavingDraft(false);
      }
    },
    [
      base,
      selectedTypeId,
      selectedCategoryId,
      title,
      preferredPresentation,
      abstractBody,
      keywords,
      totalWordCount,
      customFieldValues,
      ercStatus,
      ercInstitution,
      ercRefNo,
      previouslyPresentedDetails,
      allAuthorsConsented,
      noIdentifiableData,
      noConflictOfInterest,
      conflictDetails,
      previouslyPresented,
      submissionId,
      authors,
      affiliations,
    ],
  );

  // Auto-save every 30 seconds if modified (SUB-11)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (submissionStatus !== "DRAFT") return;
    autoSaveTimerRef.current = setInterval(() => {
      if (title.trim()) {
        void saveDraft(true);
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [saveDraft, title, submissionStatus]);

  // Step 2: Affiliation helpers
  function addAffiliation() {
    const nextNumber = affiliations.length + 1;
    setAffiliations([...affiliations, { id: `temp_${Date.now()}`, submissionId: submissionId || "", number: nextNumber, text: "" }]);
  }

  function updateAffiliationText(idx: number, text: string) {
    const next = [...affiliations];
    next[idx] = { ...next[idx]!, text };
    setAffiliations(next);
  }

  function removeAffiliation(idx: number) {
    const next = affiliations.filter((_, i) => i !== idx).map((aff, i) => ({ ...aff, number: i + 1 }));
    setAffiliations(next);
  }

  // Step 2: Author Modal helpers
  function openAddAuthor() {
    setEditingAuthorIdx(null);
    setAuthorForm({
      surname: "",
      initials: "",
      email: "",
      institution: "",
      designation: "",
      slmcNo: "",
      membershipNo: "",
      affiliationNos: affiliations.length > 0 ? [1] : [],
      isPresenting: authors.length === 0, // default first author as presenter
      isCorresponding: authors.length === 0, // default first author as corresponding
    });
    setAuthorModalOpen(true);
  }

  function openEditAuthor(idx: number) {
    const a = authors[idx]!;
    setEditingAuthorIdx(idx);
    setAuthorForm({
      surname: a.surname,
      initials: a.initials,
      email: a.email,
      institution: a.institution || "",
      designation: a.designation || "",
      slmcNo: a.slmcNo || "",
      membershipNo: a.membershipNo || "",
      affiliationNos: a.affiliationNos || [],
      isPresenting: a.isPresenting,
      isCorresponding: a.isCorresponding,
    });
    setAuthorModalOpen(true);
  }

  function saveAuthorFromModal() {
    if (!authorForm.surname.trim() || !authorForm.initials.trim() || !authorForm.email.trim()) {
      toast.error("Surname, initials, and email are required for each author.");
      return;
    }

    let nextAuthors = [...authors];

    // If marked presenting, unmark all others
    if (authorForm.isPresenting) {
      nextAuthors = nextAuthors.map((a) => ({ ...a, isPresenting: false }));
    }
    // If marked corresponding, unmark all others
    if (authorForm.isCorresponding) {
      nextAuthors = nextAuthors.map((a) => ({ ...a, isCorresponding: false }));
    }

    const authorDto: SubmissionAuthorDto = {
      id: editingAuthorIdx !== null ? nextAuthors[editingAuthorIdx]!.id : `author_${Date.now()}`,
      submissionId: submissionId || "",
      surname: authorForm.surname.trim(),
      initials: authorForm.initials.trim(),
      email: authorForm.email.trim(),
      institution: authorForm.institution.trim() || null,
      designation: authorForm.designation.trim() || null,
      slmcNo: authorForm.slmcNo.trim() || null,
      membershipNo: authorForm.membershipNo.trim() || null,
      affiliationNos: authorForm.affiliationNos,
      isPresenting: authorForm.isPresenting,
      isCorresponding: authorForm.isCorresponding,
      sortOrder: editingAuthorIdx !== null ? editingAuthorIdx : nextAuthors.length,
    };

    if (editingAuthorIdx !== null) {
      nextAuthors[editingAuthorIdx] = authorDto;
    } else {
      nextAuthors.push(authorDto);
    }

    setAuthors(nextAuthors);
    setAuthorModalOpen(false);
  }

  function moveAuthor(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= authors.length) return;
    const next = [...authors];
    const temp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = temp;
    setAuthors(next.map((a, i) => ({ ...a, sortOrder: i })));
  }

  function removeAuthor(idx: number) {
    setAuthors(authors.filter((_, i) => i !== idx).map((a, i) => ({ ...a, sortOrder: i })));
  }

  // Keywords helper (SUB-07)
  function addKeyword() {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (keywords.length >= 5) {
      toast.error("Maximum 5 keywords allowed");
      return;
    }
    if (keywords.includes(trimmed)) return;
    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
  }

  function removeKeyword(word: string) {
    setKeywords(keywords.filter((k) => k !== word));
  }

  // ERC File Upload (SUB-08)
  async function handleErcFileUpload(file: File) {
    if (!submissionId) {
      toast.error("Please save your draft first before uploading files.");
      await saveDraft();
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("ERC certificate must be a PDF file.");
      return;
    }

    setErcUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "erc");

      const res = await fetch(`${base}/submissions/${submissionId}/files`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setErcFileUploaded(true);
        toast.success("ERC certificate uploaded successfully");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "File upload failed");
      }
    } finally {
      setErcUploading(false);
    }
  }

  // Final Submit Action (SUB-12)
  async function submitAbstract() {
    // Save draft first to sync latest state
    await saveDraft(true);

    if (!submissionId) {
      toast.error("Please create or save draft before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<SubmissionDto>(`${base}/submissions/${submissionId}/actions`, {
        method: "POST",
        body: { action: "submit" },
      });

      if (!res.ok) {
        toast.error(res.error.message || "Submission failed");
        return;
      }

      setSubmissionStatus("SUBMITTED");
      setRefNo(res.data.refNo);
      setSubmittedSuccess(true);
      toast.success("Abstract submitted successfully!");
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading submission portal…</p>
      </div>
    );
  }

  if (submittedSuccess) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
          <CheckCircle2 className="size-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Abstract Submitted!</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Your abstract has been successfully submitted to the academic committee.
        </p>

        <div className="my-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Reference Number
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-primary">{refNo || "SUBMITTED"}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            A confirmation email has been dispatched to your email address and listed co-authors.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            type="button"
            className="w-full sm:w-auto px-6 h-11"
            onClick={() => router.push(`/${orgSlug}/${eventSlug}/my-submissions`)}
          >
            Go to Submitter Dashboard
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto px-6 h-11"
            onClick={() => router.push(`/${orgSlug}/${eventSlug}`)}
          >
            Back to Event Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-4">
      {/* Wizard Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Submission Portal
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {submissionId ? `Edit Abstract (${refNo || "Draft"})` : "Submit Abstract"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {lastSavedAt ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3.5" />
                Draft saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveDraft(false)}
              disabled={savingDraft}
              className="h-8 gap-1"
            >
              <FileCheck2 className="size-3.5" />
              {savingDraft ? "Saving…" : "Save Draft"}
            </Button>
          </div>
        </div>

        {/* Stepper Navigation */}
        <div className="mt-6 flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            return (
              <div key={s.step} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => setCurrentStep(s.step as WizardStep)}
                  className="flex items-center gap-2 group focus:outline-none"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      isCompleted
                        ? "bg-primary text-white"
                        : isCurrent
                          ? "bg-primary/10 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                    }`}
                  >
                    {isCompleted ? <Check className="size-4" /> : s.step}
                  </span>
                  <div className="hidden md:block text-left">
                    <p
                      className={`text-xs font-semibold ${
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">{s.desc}</p>
                  </div>
                </button>
                {idx < STEPS.length - 1 ? (
                  <div
                    className={`h-0.5 mx-3 flex-1 transition-colors ${
                      currentStep > s.step ? "bg-primary" : "bg-border"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Details */}
      {currentStep === 1 ? (
        <Card className="border border-border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Abstract Details</CardTitle>
            <CardDescription>
              Select the submission track and enter the presentation preference and title.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="typeSelect">Submission Type *</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger id="typeSelect">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {submissionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (Max {t.wordLimit} words)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentSubmissionType?.requiresErc ? (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="size-3.5" />
                    Ethics review certificate (ERC) required for this type.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="catSelect">Track / Category *</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger id="catSelect">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="titleInput">Abstract Title *</Label>
                <span className="text-xs text-muted-foreground">{title.length} / 500</span>
              </div>
              <Input
                id="titleInput"
                placeholder="Enter a concise, informative title (e.g. Outcomes of early intervention in…)"
                value={title}
                maxLength={500}
                onChange={(e) => setTitle(e.target.value)}
              />
              {duplicateWarning ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{duplicateWarning}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="presentationSelect">Preferred Presentation Type</Label>
              <Select value={preferredPresentation} onValueChange={setPreferredPresentation}>
                <SelectTrigger id="presentationSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oral">Oral presentation preferred</SelectItem>
                  <SelectItem value="poster">Poster presentation preferred</SelectItem>
                  <SelectItem value="either">Either (Oral or Poster)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Final presentation assignment is made by the scientific committee upon review.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border pt-4">
            <span />
            <Button
              type="button"
              onClick={() => {
                if (!title.trim()) {
                  toast.error("Please enter an abstract title.");
                  return;
                }
                setCurrentStep(2);
              }}
              className="gap-1.5"
            >
              Continue to Authors
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* Step 2: Authors & Affiliations */}
      {currentStep === 2 ? (
        <div className="space-y-6">
          {/* Affiliations Card */}
          <Card className="border border-border bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg">Affiliations</CardTitle>
                <CardDescription>
                  Enter institutions once. Authors link to them by number.
                </CardDescription>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addAffiliation} className="gap-1">
                <Plus className="size-3.5" />
                Add Institution
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {affiliations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No institutions added yet. Click &quot;Add Institution&quot; above to create affiliation #1.
                </div>
              ) : (
                affiliations.map((aff, idx) => (
                  <div key={aff.number} className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {aff.number}
                    </span>
                    <Input
                      placeholder={`e.g. Faculty of Medicine, University of Colombo, Sri Lanka`}
                      value={aff.text}
                      onChange={(e) => updateAffiliationText(idx, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => removeAffiliation(idx)}
                      title="Remove affiliation"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Authors List Card */}
          <Card className="border border-border bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg">Authors List</CardTitle>
                <CardDescription>
                  List all contributing authors. Reorder to set authorship sequence. Mark one presenting and one corresponding author.
                </CardDescription>
              </div>
              <Button type="button" size="sm" onClick={openAddAuthor} className="gap-1">
                <Plus className="size-3.5" />
                Add Author
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {authors.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  <p className="font-medium">No authors listed yet</p>
                  <p className="text-xs mt-1">At least one author must be added and designated as presenting author.</p>
                </div>
              ) : (
                authors.map((a, idx) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">
                            {a.surname}, {a.initials}
                          </span>
                          {a.affiliationNos && a.affiliationNos.length > 0 ? (
                            <span className="text-xs font-semibold text-primary">
                              <sup>{a.affiliationNos.join(",")}</sup>
                            </span>
                          ) : null}
                          {a.isPresenting ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] h-4 px-1.5 py-0">
                              Presenter
                            </Badge>
                          ) : null}
                          {a.isCorresponding ? (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                              Corresponding
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {a.email} {a.institution ? `· ${a.institution}` : ""} {a.slmcNo ? `· SLMC: ${a.slmcNo}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={idx === 0}
                        onClick={() => moveAuthor(idx, "up")}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={idx === authors.length - 1}
                        onClick={() => moveAuthor(idx, "down")}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => openEditAuthor(idx)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => removeAuthor(idx)}
                        title="Remove author"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="gap-1">
                <ChevronLeft className="size-4" />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (authors.length === 0) {
                    toast.error("Please add at least one author.");
                    return;
                  }
                  if (!authors.some((a) => a.isPresenting)) {
                    toast.error("Please mark one author as Presenter.");
                    return;
                  }
                  setCurrentStep(3);
                }}
                className="gap-1.5"
              >
                Continue to Abstract Body
                <ChevronRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {/* Step 3: Abstract Body & Custom Fields */}
      {currentStep === 3 ? (
        <Card className="border border-border bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Structured Abstract</CardTitle>
                <CardDescription>
                  Format each section according to the local conference guidelines.
                </CardDescription>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                  isOverWordLimit
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-border bg-muted/40 text-foreground"
                }`}
              >
                <span>Word Count:</span>
                <span className="font-mono text-sm">{totalWordCount}</span>
                <span className="text-muted-foreground">/ {maxWords}</span>
                {isOverWordLimit ? <span>(Exceeded)</span> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections configured for this submission type.</p>
            ) : (
              sections.map((sec) => (
                <div key={sec.key} className="space-y-1.5">
                  <Label htmlFor={`sec_${sec.key}`} className="font-medium text-sm">
                    {sec.label} *
                  </Label>
                  <AbstractSectionEditor
                    value={abstractBody[sec.key] || ""}
                    onChange={(html) =>
                      setAbstractBody((prev) => ({
                        ...prev,
                        [sec.key]: html,
                      }))
                    }
                    placeholder={`Enter ${sec.label.toLowerCase()} content…`}
                  />
                </div>
              ))
            )}

            {/* Keywords */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label>Keywords (Max 5)</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a keyword and press Enter"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  disabled={keywords.length >= 5}
                />
                <Button type="button" variant="secondary" onClick={addKeyword} disabled={keywords.length >= 5}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="size-3.5 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Custom Form Fields if configured */}
            {formFields.length > 0 ? (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground">Additional Information</h3>
                {formFields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label htmlFor={`field_${f.id}`}>
                      {f.label} {f.required ? "*" : ""}
                    </Label>
                    {f.type === "TEXT" || f.type === "NUMBER" || f.type === "DATE" ? (
                      <Input
                        id={`field_${f.id}`}
                        type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
                        value={(customFieldValues[f.id] as string) || ""}
                        onChange={(e) =>
                          setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                      />
                    ) : f.type === "LONG_TEXT" ? (
                      <Textarea
                        id={`field_${f.id}`}
                        value={(customFieldValues[f.id] as string) || ""}
                        onChange={(e) =>
                          setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                      />
                    ) : f.type === "DROPDOWN" && f.options ? (
                      <Select
                        value={(customFieldValues[f.id] as string) || ""}
                        onValueChange={(val) =>
                          setCustomFieldValues((prev) => ({ ...prev, [f.id]: val }))
                        }
                      >
                        <SelectTrigger id={`field_${f.id}`}>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {f.helpText ? <p className="text-xs text-muted-foreground">{f.helpText}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="gap-1">
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (isOverWordLimit) {
                  toast.error(`Abstract exceeds word limit of ${maxWords} words.`);
                  return;
                }
                setCurrentStep(4);
              }}
              className="gap-1.5"
            >
              Continue to Ethics & Declarations
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* Step 4: ERC & Declarations */}
      {currentStep === 4 ? (
        <div className="space-y-6">
          {/* Ethics Card */}
          <Card className="border border-border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Ethics Review Committee (ERC)</CardTitle>
              <CardDescription>
                Research studies and clinical audits require ethical review approval or an official exemption letter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>ERC Approval Status *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "APPROVED", label: "ERC Approved" },
                    { value: "EXEMPT", label: "ERC Exempt" },
                    { value: "NOT_APPLICABLE", label: "Not Applicable" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setErcStatus(opt.value as "APPROVED" | "EXEMPT" | "NOT_APPLICABLE")}
                      className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${
                        ercStatus === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-white text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {ercStatus === "APPROVED" || ercStatus === "EXEMPT" ? (
                <div className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ercInst">Approving Institution</Label>
                      <Input
                        id="ercInst"
                        placeholder="e.g. ERC, Faculty of Medicine, Colombo"
                        value={ercInstitution}
                        onChange={(e) => setErcInstitution(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ercRef">ERC Reference Number</Label>
                      <Input
                        id="ercRef"
                        placeholder="e.g. EC-2025-112"
                        value={ercRefNo}
                        onChange={(e) => setErcRefNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Certificate / Exemption PDF Upload</Label>
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                      <Upload className="mx-auto size-8 text-muted-foreground mb-2" />
                      {ercFileUploaded ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-1">
                            <CheckCircle2 className="size-4" />
                            ERC Certificate uploaded
                          </p>
                          <label className="text-xs text-primary hover:underline cursor-pointer inline-block">
                            <span>Upload a replacement PDF</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleErcFileUpload(f);
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium">Upload PDF Certificate</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Maximum file size 10MB</p>
                          <label className="mt-3 inline-block">
                            <Button type="button" variant="outline" size="sm" asChild disabled={ercUploading}>
                              <span>{ercUploading ? "Uploading…" : "Browse file"}</span>
                            </Button>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleErcFileUpload(f);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Declarations Card */}
          <Card className="border border-border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Mandatory Declarations</CardTitle>
              <CardDescription>
                Confirm all regulatory declarations before final submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border p-3.5">
                <Switch
                  id="consentSwitch"
                  checked={allAuthorsConsented}
                  onCheckedChange={setAllAuthorsConsented}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="consentSwitch" className="font-medium text-sm cursor-pointer">
                    Author Consent *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    All listed authors have reviewed the final version of this abstract and given consent for submission.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border p-3.5">
                <Switch
                  id="patientDataSwitch"
                  checked={noIdentifiableData}
                  onCheckedChange={setNoIdentifiableData}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="patientDataSwitch" className="font-medium text-sm cursor-pointer">
                    Patient Confidentiality *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    The abstract contains no patient-identifiable data, images, or confidential patient records.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3.5 space-y-3">
                <div className="flex items-start gap-3">
                  <Switch
                    id="coiSwitch"
                    checked={noConflictOfInterest}
                    onCheckedChange={setNoConflictOfInterest}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="coiSwitch" className="font-medium text-sm cursor-pointer">
                      No Conflicts of Interest
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      The authors declare no commercial, financial, or personal competing interests.
                    </p>
                  </div>
                </div>
                {!noConflictOfInterest ? (
                  <div className="space-y-1.5 pl-11">
                    <Label htmlFor="coiDetails">Conflict of Interest Details</Label>
                    <Textarea
                      id="coiDetails"
                      placeholder="Specify funding source, advisory roles, or other disclosures…"
                      value={conflictDetails}
                      onChange={(e) => setConflictDetails(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-border p-3.5 space-y-3">
                <div className="flex items-start gap-3">
                  <Switch
                    id="prevPubSwitch"
                    checked={previouslyPresented}
                    onCheckedChange={setPreviouslyPresented}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="prevPubSwitch" className="font-medium text-sm cursor-pointer">
                      Prior Presentation / Publication
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Has this study been previously presented at another conference or published in any journal?
                    </p>
                  </div>
                </div>
                {previouslyPresented ? (
                  <div className="space-y-1.5 pl-11">
                    <Label htmlFor="prevPubDetails">Prior Presentation / Publication Details</Label>
                    <Textarea
                      id="prevPubDetails"
                      placeholder="Provide conference name, date, journal citation, or differences in this abstract…"
                      value={previouslyPresentedDetails}
                      onChange={(e) => setPreviouslyPresentedDetails(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(3)} className="gap-1">
                <ChevronLeft className="size-4" />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!allAuthorsConsented || !noIdentifiableData) {
                    toast.error("Please confirm the required declarations.");
                    return;
                  }
                  setCurrentStep(5);
                }}
                className="gap-1.5"
              >
                Review Abstract
                <ChevronRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {/* Step 5: Review & Submit */}
      {currentStep === 5 ? (
        <div className="space-y-6">
          <Card className="border border-border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Review Abstract Before Submission</CardTitle>
              <CardDescription>
                Check the formatted preview below. Once submitted, changes are tracked in version history until the submission deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formatted Abstract Preview Box */}
              <div className="rounded-xl border border-border bg-muted/10 p-6 space-y-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>

                {/* Authors Line */}
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {authors.map((a, i) => (
                      <span key={a.id}>
                        <span className={a.isPresenting ? "underline decoration-primary font-bold" : ""}>
                          {a.surname} {a.initials}
                        </span>
                        {a.affiliationNos && a.affiliationNos.length > 0 ? (
                          <sup className="text-primary font-bold">{a.affiliationNos.join(",")}</sup>
                        ) : null}
                        {i < authors.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    (Underlined author is presenting author)
                  </p>
                </div>

                {/* Affiliations List */}
                {affiliations.length > 0 ? (
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                    {affiliations.map((aff) => (
                      <p key={aff.number}>
                        <sup className="font-semibold">{aff.number}</sup> {aff.text}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="h-px bg-border my-3" />

                {/* Structured Sections */}
                <div className="space-y-3">
                  {sections.map((sec) => (
                    <div key={sec.key} className="space-y-1">
                      <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                        {sec.label}
                      </span>
                      <div
                        className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: abstractBody[sec.key] || "<em>(empty)</em>" }}
                      />
                    </div>
                  ))}
                </div>

                {keywords.length > 0 ? (
                  <div className="pt-2 text-xs">
                    <span className="font-bold text-muted-foreground">Keywords: </span>
                    <span className="text-foreground">{keywords.join(", ")}</span>
                  </div>
                ) : null}
              </div>

              {/* Verification Checklist */}
              <div className="rounded-lg border border-border bg-white p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Readiness Checklist
                </h4>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Title: Provided ({title.length} chars)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Presenter marked: {authors.find((a) => a.isPresenting)?.surname || "None"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`size-4 shrink-0 ${isOverWordLimit ? "text-red-500" : "text-emerald-600"}`}
                    />
                    <span>Word count: {totalWordCount} / {maxWords} words</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Ethics approval: {ercStatus || "Declared"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Author consent: Confirmed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Confidentiality: Confirmed</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(4)} className="w-full sm:w-auto gap-1">
                <ChevronLeft className="size-4" />
                Back to Edit
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDraft(false)}
                  disabled={savingDraft || submitting}
                  className="w-full sm:w-auto"
                >
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={submitAbstract}
                  disabled={submitting || isOverWordLimit}
                  className="w-full sm:w-auto px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <Sparkles className="size-4" />
                  {submitting ? "Submitting…" : "Submit Abstract"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {/* Author Edit/Add Dialog */}
      <Dialog open={authorModalOpen} onOpenChange={setAuthorModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>{editingAuthorIdx !== null ? "Edit Author" : "Add Author"}</DialogTitle>
            <DialogDescription>
              Enter name, contact, credentials, and institutional affiliations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="authorSurname">Surname *</Label>
                <Input
                  id="authorSurname"
                  placeholder="e.g. Perera"
                  value={authorForm.surname}
                  onChange={(e) => setAuthorForm({ ...authorForm, surname: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="authorInitials">Initials *</Label>
                <Input
                  id="authorInitials"
                  placeholder="e.g. K.A.D."
                  value={authorForm.initials}
                  onChange={(e) => setAuthorForm({ ...authorForm, initials: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="authorEmail">Email *</Label>
              <Input
                id="authorEmail"
                type="email"
                placeholder="name@institution.lk"
                value={authorForm.email}
                onChange={(e) => setAuthorForm({ ...authorForm, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="authorDesignation">Designation</Label>
                <Input
                  id="authorDesignation"
                  placeholder="e.g. Registrar"
                  value={authorForm.designation}
                  onChange={(e) => setAuthorForm({ ...authorForm, designation: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="authorSlmc">SLMC Number</Label>
                <Input
                  id="authorSlmc"
                  placeholder="e.g. 24891"
                  value={authorForm.slmcNo}
                  onChange={(e) => setAuthorForm({ ...authorForm, slmcNo: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="authorMembership">Membership No (optional)</Label>
              <Input
                id="authorMembership"
                placeholder="e.g. M-1042"
                value={authorForm.membershipNo}
                onChange={(e) => setAuthorForm({ ...authorForm, membershipNo: e.target.value })}
              />
            </div>

            {/* Affiliations checkboxes */}
            {affiliations.length > 0 ? (
              <div className="space-y-2 pt-1 border-t border-border">
                <Label>Affiliated Institutions</Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {affiliations.map((aff) => {
                    const isChecked = authorForm.affiliationNos.includes(aff.number);
                    return (
                      <label key={aff.number} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...authorForm.affiliationNos, aff.number]
                              : authorForm.affiliationNos.filter((n) => n !== aff.number);
                            setAuthorForm({ ...authorForm, affiliationNos: next });
                          }}
                          className="rounded border-border text-primary"
                        />
                        <span>
                          [{aff.number}] {aff.text || "Unnamed Institution"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="presentingSwitch" className="text-xs font-semibold cursor-pointer">
                    Presenting Author
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Will deliver the presentation if accepted.</p>
                </div>
                <Switch
                  id="presentingSwitch"
                  checked={authorForm.isPresenting}
                  onCheckedChange={(val) => setAuthorForm({ ...authorForm, isPresenting: val })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="correspondingSwitch" className="text-xs font-semibold cursor-pointer">
                    Corresponding Author
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Point of contact for the committee.</p>
                </div>
                <Switch
                  id="correspondingSwitch"
                  checked={authorForm.isCorresponding}
                  onCheckedChange={(val) => setAuthorForm({ ...authorForm, isCorresponding: val })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAuthorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveAuthorFromModal}>
              Save Author
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

