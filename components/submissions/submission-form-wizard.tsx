"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  GripVertical,
  Loader2,
  Mail,
  Mic,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";

import { AutosaveIndicator, type AutosaveState } from "@/components/shared/autosave-indicator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileUpload } from "@/components/shared/file-upload";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { SidePanel } from "@/components/shared/side-panel";
import { FormSkeleton } from "@/components/shared/skeletons";
import { StepIndicator, type Step } from "@/components/shared/step-indicator";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { countAbstractBodyWords } from "@/lib/html";
import { cn } from "@/lib/utils";
import type {
  CategoryDto,
  FormFieldDto,
  PresentationTypeDto,
  SubmissionAffiliationDto,
  SubmissionAuthorDto,
  SubmissionDto,
  SubmissionTypeDto,
} from "@/lib/types/api";

// TipTap is heavy; load it after the wizard renders. The placeholder matches
// the editor's own pre-mount height so the step doesn't jump.
const AbstractSectionEditor = dynamic(
  () => import("@/components/submissions/abstract-section-editor").then((m) => m.AbstractSectionEditor),
  { ssr: false, loading: () => <div className="min-h-44 animate-pulse rounded-md border border-input bg-muted/40" /> },
);

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: Array<{ step: WizardStep; label: string; description: string }> = [
  { step: 1, label: "Details", description: "Type, track and title" },
  { step: 2, label: "Abstract", description: "Sections and keywords" },
  { step: 3, label: "Authors", description: "Authors and affiliations" },
  { step: 4, label: "Ethics", description: "ERC approval" },
  { step: 5, label: "Declarations", description: "Consent and disclosures" },
  { step: 6, label: "Review", description: "Check and submit" },
];

const PRESENTATION_LABEL: Record<string, string> = {
  oral: "Oral presentation",
  poster: "Poster presentation",
  either: "Either oral or poster",
};

const PRESENTATION_VALUE: Record<string, string> = {
  ORAL: "oral",
  POSTER: "poster",
  ORAL_OR_POSTER: "either",
};

/** Comparable snapshot of one author, without their id or position. */
function authorKey(a: SubmissionAuthorDto) {
  return JSON.stringify([a.surname, a.initials, a.email, a.institution, a.designation, a.slmcNo, a.membershipNo, a.affiliationNos, a.isPresenting, a.isCorresponding]);
}

function authorBody(a: SubmissionAuthorDto, sortOrder: number) {
  return {
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
    sortOrder,
  };
}

/** Comparable snapshot of the people on an abstract (used to sync drafts). */
function peopleKey(authors: SubmissionAuthorDto[], affiliations: SubmissionAffiliationDto[]) {
  return JSON.stringify({
    au: authors.map((a) => [a.surname, a.initials, a.email, a.institution, a.designation, a.slmcNo, a.membershipNo, a.affiliationNos, a.isPresenting, a.isCorresponding]),
    af: affiliations.filter((f) => f.text.trim()).map((f) => [f.number, f.text.trim()]),
  });
}

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
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(1);
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

  // Details
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [preferredPresentation, setPreferredPresentation] = useState<string>("either");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Authors & affiliations
  const [affiliations, setAffiliations] = useState<SubmissionAffiliationDto[]>([]);
  const [authors, setAuthors] = useState<SubmissionAuthorDto[]>([]);
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [editingAuthorIdx, setEditingAuthorIdx] = useState<number | null>(null);
  const [authorErrors, setAuthorErrors] = useState<{ surname?: string; initials?: string; email?: string }>({});
  const [removeAuthorIdx, setRemoveAuthorIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
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

  // Abstract
  const [abstractBody, setAbstractBody] = useState<Record<string, string>>({});
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Ethics
  const [ercStatus, setErcStatus] = useState<"APPROVED" | "EXEMPT" | "NOT_APPLICABLE" | "">("");
  const [ercInstitution, setErcInstitution] = useState("");
  const [ercRefNo, setErcRefNo] = useState("");
  const [ercFileUploaded, setErcFileUploaded] = useState(false);
  const [ercUploading, setErcUploading] = useState(false);
  const [ercFileInfo, setErcFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [ercError, setErcError] = useState<string | null>(null);

  // Declarations
  const [allAuthorsConsented, setAllAuthorsConsented] = useState(false);
  const [noIdentifiableData, setNoIdentifiableData] = useState(false);
  const [noConflictOfInterest, setNoConflictOfInterest] = useState(true);
  const [conflictDetails, setConflictDetails] = useState("");
  const [previouslyPresented, setPreviouslyPresented] = useState(false);
  const [previouslyPresentedDetails, setPreviouslyPresentedDetails] = useState("");

  // Save & submit
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Server-side state of authors/affiliations on an existing draft
  const syncedPeopleRef = useRef<string>("");
  const serverAuthorsRef = useRef<Map<string, string>>(new Map()); // id → authorKey
  const serverAuthorOrderRef = useRef<string[]>([]);
  const serverAffsRef = useRef<Map<number, { id: string; text: string }>>(new Map());
  // Browser-only author ids → their saved ids, so a retry can't add them twice.
  const savedAuthorIdsRef = useRef<Map<string, string>>(new Map());
  // Authors sent with the create call whose saved ids we couldn't read back.
  const unmappedCreateIdsRef = useRef<string[] | null>(null);
  const syncQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const currentSubmissionType = useMemo(
    () => submissionTypes.find((t) => t.id === selectedTypeId) || null,
    [submissionTypes, selectedTypeId],
  );

  const sections = useMemo(() => {
    if (!currentSubmissionType || !Array.isArray(currentSubmissionType.sections)) return [];
    return currentSubmissionType.sections;
  }, [currentSubmissionType]);

  const totalWordCount = useMemo(() => countAbstractBodyWords(abstractBody), [abstractBody]);
  const maxWords = currentSubmissionType?.wordLimit || 300;
  const isOverWordLimit = totalWordCount > maxWords;

  /** Formats the event offers, plus the one this draft already chose. */
  const presentationOptions = useMemo(() => {
    const options = presentationTypes
      .filter((t) => PRESENTATION_VALUE[t.code] && (t.isActive || PRESENTATION_VALUE[t.code] === preferredPresentation))
      .map((t) => ({ value: PRESENTATION_VALUE[t.code]!, label: t.label }));
    if (options.length > 0) return options;
    return (["oral", "poster", "either"] as const).map((value) => ({ value, label: PRESENTATION_LABEL[value]! }));
  }, [presentationTypes, preferredPresentation]);

  const presentationLabel =
    presentationTypes.find((t) => PRESENTATION_VALUE[t.code] === preferredPresentation)?.label ??
    PRESENTATION_LABEL[preferredPresentation] ??
    preferredPresentation;

  const rememberServerPeople = useCallback((sub: SubmissionDto) => {
    const saved = [...(sub.authors ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    serverAuthorsRef.current = new Map(saved.map((a) => [a.id, authorKey(a)]));
    serverAuthorOrderRef.current = saved.map((a) => a.id);
    serverAffsRef.current = new Map((sub.affiliations ?? []).map((f) => [f.number, { id: f.id, text: f.text }]));
    syncedPeopleRef.current = peopleKey(saved, sub.affiliations ?? []);
  }, []);

  /** After a create: record saved ids against the form's temporary ones. */
  const adoptCreatedPeople = useCallback(
    (sub: SubmissionDto, localIds: string[]) => {
      rememberServerPeople(sub);
      serverAuthorOrderRef.current.forEach((savedId, i) => {
        const localId = localIds[i];
        if (localId) savedAuthorIdsRef.current.set(localId, savedId);
      });
      setAuthors((current) =>
        current.map((a) => {
          const savedId = savedAuthorIdsRef.current.get(a.id);
          return savedId ? { ...a, id: savedId } : a;
        }),
      );
    },
    [rememberServerPeople],
  );

  // Load auxiliary data (unchanged)
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
        if (presRes.ok) {
          setPresentationTypes(presRes.data);
          // A new abstract must not default to a format the event turned off.
          if (!existingSubmissionId) {
            const active = presRes.data
              .filter((t) => t.isActive)
              .map((t) => PRESENTATION_VALUE[t.code])
              .filter((v): v is string => Boolean(v));
            if (active.length > 0 && !active.includes("either")) setPreferredPresentation(active[0]!);
          }
        }

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
            rememberServerPeople(sub);
            setFurthestStep(6);
          } else {
            toast.error("Couldn't open this abstract", { description: subRes.error.message });
          }
        }
      } finally {
        setInitialLoading(false);
      }
    }

    void loadAux();
  }, [base, existingSubmissionId, selectedTypeId, rememberServerPeople]);

  // Custom form fields per type (unchanged)
  useEffect(() => {
    if (!selectedTypeId) return;
    async function loadFields() {
      const res = await apiFetch<FormFieldDto[]>(`${base}/submission-types/${selectedTypeId}/form-fields`);
      if (res.ok) setFormFields(res.data);
    }
    void loadFields();
  }, [base, selectedTypeId]);

  // Duplicate title check (unchanged)
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
          `This looks very like “${top.title}” (${Math.round(top.similarity * 100)}% match). Check you aren't submitting the same abstract twice.`,
        );
      } else {
        setDuplicateWarning(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [base, title, submissionId]);

  /**
   * Bring the draft's authors and affiliations in line with the form, changing
   * only what differs so saved authors keep their ids. Saves run one at a time:
   * autosave and a manual save must not both add the same new author.
   */
  const runPeopleSync = useCallback(
    async (subId: string) => {
      if (unmappedCreateIdsRef.current) {
        const fresh = await apiFetch<SubmissionDto>(`${base}/submissions/${subId}`);
        if (!fresh.ok) return false;
        adoptCreatedPeople(fresh.data, unmappedCreateIdsRef.current);
        unmappedCreateIdsRef.current = null;
      }

      const desired = peopleKey(authors, affiliations);
      if (desired === syncedPeopleRef.current) return true;

      const resolved = authors.map((a) => ({ ...a, id: savedAuthorIdsRef.current.get(a.id) ?? a.id }));
      const server = serverAuthorsRef.current;
      const keepIds = new Set(resolved.map((a) => a.id));
      let structureChanged = false;

      for (const id of [...server.keys()]) {
        if (keepIds.has(id)) continue;
        const r = await apiFetch(`${base}/submissions/${subId}/authors/${id}`, { method: "DELETE" });
        if (!r.ok && r.status !== 404) return false;
        server.delete(id);
        serverAuthorOrderRef.current = serverAuthorOrderRef.current.filter((x) => x !== id);
        structureChanged = true;
      }

      const wantedAffs = new Map(
        affiliations.filter((f) => f.text.trim()).map((f) => [f.number, f.text.trim()]),
      );
      for (const [number, aff] of [...serverAffsRef.current]) {
        if (wantedAffs.has(number)) continue;
        const r = await apiFetch(`${base}/submissions/${subId}/affiliations/${aff.id}`, { method: "DELETE" });
        if (!r.ok && r.status !== 404) return false;
        serverAffsRef.current.delete(number);
      }
      for (const [number, text] of wantedAffs) {
        if (serverAffsRef.current.get(number)?.text === text) continue;
        // POST upserts on (submission, number), so an edited one keeps its id.
        const r = await apiFetch<SubmissionAffiliationDto>(`${base}/submissions/${subId}/affiliations`, {
          method: "POST",
          body: { number, text },
        });
        if (!r.ok) return false;
        serverAffsRef.current.set(number, { id: r.data.id, text });
      }

      for (const [idx, a] of resolved.entries()) {
        const key = authorKey(a);
        if (server.has(a.id)) {
          if (server.get(a.id) === key) continue;
          const r = await apiFetch(`${base}/submissions/${subId}/authors/${a.id}`, {
            method: "PATCH",
            body: authorBody(a, idx),
          });
          if (!r.ok) return false;
          server.set(a.id, key);
        } else {
          const r = await apiFetch<SubmissionAuthorDto>(`${base}/submissions/${subId}/authors`, {
            method: "POST",
            body: authorBody(a, idx),
          });
          if (!r.ok) return false;
          savedAuthorIdsRef.current.set(authors[idx]!.id, r.data.id);
          server.set(r.data.id, key);
          serverAuthorOrderRef.current = [...serverAuthorOrderRef.current, r.data.id];
          resolved[idx] = { ...a, id: r.data.id };
          structureChanged = true;
        }
      }

      const orderedIds = resolved.map((a) => a.id);
      if (
        orderedIds.length > 0 &&
        (structureChanged || orderedIds.join() !== serverAuthorOrderRef.current.join())
      ) {
        const r = await apiFetch(`${base}/submissions/${subId}/authors/reorder`, {
          method: "POST",
          body: { orderedIds },
        });
        if (!r.ok) return false;
      }
      serverAuthorOrderRef.current = orderedIds;

      setAuthors((current) =>
        current.map((a) => {
          const savedId = savedAuthorIdsRef.current.get(a.id);
          return savedId ? { ...a, id: savedId } : a;
        }),
      );
      syncedPeopleRef.current = desired;
      return true;
    },
    [base, authors, affiliations, adoptCreatedPeople],
  );

  const syncPeople = useCallback(
    (subId: string) => {
      const run = syncQueueRef.current.catch(() => false).then(() => runPeopleSync(subId));
      syncQueueRef.current = run;
      return run;
    },
    [runPeopleSync],
  );

  // Save draft (SUB-11) — payloads unchanged; people synced for existing drafts
  const saveDraft = useCallback(
    async (silent = false) => {
      if (!selectedTypeId || !title.trim()) {
        if (!silent) toast.error("Add a title first", { description: "A draft needs at least a submission type and a title." });
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
          const res = await apiFetch<SubmissionDto>(`${base}/submissions/${submissionId}`, {
            method: "PATCH",
            body: payload,
          });
          const peopleOk = res.ok ? await syncPeople(submissionId) : false;
          if (res.ok && peopleOk) {
            setLastSavedAt(new Date());
            setSaveFailed(false);
            if (!silent) toast.success("Draft saved");
          } else {
            setSaveFailed(true);
            if (!silent) {
              toast.error("Couldn't save your draft", {
                description: res.ok ? "The author list didn't save. Try again." : res.error.message,
              });
            }
          }
        } else {
          const createPayload = {
            ...payload,
            authors: authors.map((a, idx) => authorBody(a, idx)),
            affiliations: affiliations.map((aff) => ({ number: aff.number, text: aff.text })),
          };

          const res = await apiFetch<{ submission: SubmissionDto }>(`${base}/submissions`, {
            method: "POST",
            body: createPayload,
          });

          if (res.ok) {
            setSubmissionId(res.data.submission.id);
            const fresh = await apiFetch<SubmissionDto>(`${base}/submissions/${res.data.submission.id}`);
            const createdIds = authors.map((a) => a.id);
            if (fresh.ok) adoptCreatedPeople(fresh.data, createdIds);
            else unmappedCreateIdsRef.current = createdIds;
            setLastSavedAt(new Date());
            setSaveFailed(false);
            if (!silent) toast.success("Draft saved");
          } else {
            setSaveFailed(true);
            if (!silent) toast.error("Couldn't save your draft", { description: res.error.message });
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
      syncPeople,
      adoptCreatedPeople,
    ],
  );

  // Auto-save every 30 seconds (SUB-11, unchanged)
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

  // Affiliations
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

  // Authors
  function openAddAuthor() {
    setEditingAuthorIdx(null);
    setAuthorErrors({});
    setAuthorForm({
      surname: "",
      initials: "",
      email: "",
      institution: "",
      designation: "",
      slmcNo: "",
      membershipNo: "",
      affiliationNos: affiliations.length > 0 ? [1] : [],
      isPresenting: authors.length === 0,
      isCorresponding: authors.length === 0,
    });
    setAuthorModalOpen(true);
  }

  function openEditAuthor(idx: number) {
    const a = authors[idx]!;
    setEditingAuthorIdx(idx);
    setAuthorErrors({});
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
    const errs: typeof authorErrors = {};
    if (!authorForm.surname.trim()) errs.surname = "Enter the surname.";
    if (!authorForm.initials.trim()) errs.initials = "Enter the initials, e.g. K.A.D.";
    if (!authorForm.email.trim()) errs.email = "Enter an email address.";
    setAuthorErrors(errs);
    if (Object.keys(errs).length) return;

    let nextAuthors = [...authors];
    if (authorForm.isPresenting) nextAuthors = nextAuthors.map((a) => ({ ...a, isPresenting: false }));
    if (authorForm.isCorresponding) nextAuthors = nextAuthors.map((a) => ({ ...a, isCorresponding: false }));

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

    if (editingAuthorIdx !== null) nextAuthors[editingAuthorIdx] = authorDto;
    else nextAuthors.push(authorDto);

    setAuthors(nextAuthors);
    setAuthorModalOpen(false);
    toast.success(editingAuthorIdx !== null ? "Author updated" : "Author added");
  }

  /** Same rule as the editor: only one presenting / one corresponding author. */
  function setRole(idx: number, role: "isPresenting" | "isCorresponding") {
    setAuthors(authors.map((a, i) => ({ ...a, [role]: i === idx })));
  }

  function moveAuthorTo(from: number, to: number) {
    if (from === to || to < 0 || to >= authors.length) return;
    const next = [...authors];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setAuthors(next.map((a, i) => ({ ...a, sortOrder: i })));
  }

  function moveAuthor(idx: number, dir: "up" | "down") {
    moveAuthorTo(idx, dir === "up" ? idx - 1 : idx + 1);
  }

  function removeAuthor(idx: number) {
    setAuthors(authors.filter((_, i) => i !== idx).map((a, i) => ({ ...a, sortOrder: i })));
  }

  // Keywords (SUB-07, unchanged limit)
  function addKeyword() {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (keywords.length >= 5) {
      toast.error("You can add up to 5 keywords");
      return;
    }
    if (keywords.includes(trimmed)) return;
    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
  }
  function removeKeyword(word: string) {
    setKeywords(keywords.filter((k) => k !== word));
  }

  // ERC upload (SUB-08) — same endpoint; now sends the auth token via apiFetch
  async function handleErcFileUpload(file: File) {
    setErcError(null);
    if (!submissionId) {
      toast.info("Saving your draft first", "Then choose the file again.");
      await saveDraft();
      return;
    }
    if (file.type !== "application/pdf") {
      setErcError(`${file.name} isn't a PDF. Save the certificate as a PDF and try again.`);
      return;
    }

    setErcUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "erc");
      const res = await apiFetch(`${base}/submissions/${submissionId}/files`, { method: "POST", formData });
      if (res.ok) {
        setErcFileUploaded(true);
        setErcFileInfo({ name: file.name, size: file.size });
        toast.success("Certificate uploaded");
      } else {
        const msg = res.error.message || "";
        setErcError(
          /bucket|storage/i.test(msg)
            ? "The file couldn't be stored right now. Try again later — or give the ERC reference number above, which is enough to submit."
            : msg || "The upload failed. Try again.",
        );
      }
    } catch {
      setErcError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setErcUploading(false);
    }
  }

  async function viewErcFile() {
    if (!submissionId) return;
    const res = await apiFetch<{ url: string }>(`${base}/submissions/${submissionId}/files?kind=erc`);
    if (res.ok) window.open(res.data.url, "_blank", "noopener");
    else toast.error("Couldn't open the certificate", { description: res.error.message });
  }

  // Submit (SUB-12) — same action; errors shown in place
  async function submitAbstract() {
    setSubmitError(null);
    await saveDraft(true);

    if (!submissionId) {
      setSubmitError("Save your draft first, then submit.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<SubmissionDto>(`${base}/submissions/${submissionId}/actions`, {
        method: "POST",
        body: { action: "submit" },
      });

      if (!res.ok) {
        setSubmitError(res.error.message || "Submission failed. Try again.");
        return;
      }

      setSubmissionStatus("SUBMITTED");
      setRefNo(res.data.refNo);
      setSubmittedSuccess(true);
      window.scrollTo({ top: 0 });
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Readiness: mirrors the server's submit checks (presentation only) ── */

  type Issue = { step: WizardStep; message: string; blocking: boolean };
  const issues = useMemo<Issue[]>(() => {
    const list: Issue[] = [];
    if (!title.trim()) list.push({ step: 1, message: "Add a title.", blocking: true });
    if (!selectedCategoryId) list.push({ step: 1, message: "No track chosen.", blocking: false });
    if (isOverWordLimit) list.push({ step: 2, message: `The abstract is ${totalWordCount - maxWords} words over the ${maxWords}-word limit.`, blocking: true });
    for (const sec of sections) {
      const html = abstractBody[sec.key] || "";
      if (!html.replace(/<[^>]*>/g, "").trim()) list.push({ step: 2, message: `“${sec.label}” is empty.`, blocking: false });
    }
    for (const f of formFields) {
      const v = customFieldValues[f.id];
      if (f.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0))) {
        list.push({ step: 2, message: `Answer “${f.label}”.`, blocking: true });
      }
    }
    if (authors.length === 0) list.push({ step: 3, message: "Add at least one author.", blocking: true });
    else {
      if (!authors.some((a) => a.isPresenting)) list.push({ step: 3, message: "Choose the presenting author.", blocking: true });
      if (!authors.some((a) => a.isCorresponding)) list.push({ step: 3, message: "Choose the corresponding author.", blocking: true });
    }
    if (currentSubmissionType?.requiresErc) {
      if (!ercStatus) list.push({ step: 4, message: "Choose your ERC approval status.", blocking: true });
      else if ((ercStatus === "APPROVED" || ercStatus === "EXEMPT") && !ercRefNo.trim() && !ercFileUploaded) {
        list.push({ step: 4, message: "Give the ERC reference number or upload the certificate.", blocking: true });
      }
    }
    if (!allAuthorsConsented) list.push({ step: 5, message: "Confirm that all authors consent.", blocking: true });
    if (!noIdentifiableData) list.push({ step: 5, message: "Confirm there's no identifiable patient data.", blocking: true });
    return list;
  }, [title, selectedCategoryId, isOverWordLimit, totalWordCount, maxWords, sections, abstractBody, formFields, customFieldValues, authors, currentSubmissionType, ercStatus, ercRefNo, ercFileUploaded, allAuthorsConsented, noIdentifiableData]);

  const stepHasBlocker = (s: WizardStep) => issues.some((i) => i.step === s && i.blocking);
  const blockers = issues.filter((i) => i.blocking);

  /* ─── Navigation: same gates as before when moving forward ──────────── */

  function gateFor(step: WizardStep): string | null {
    if (step === 1 && !title.trim()) return "Enter a title for your abstract.";
    if (step === 2 && isOverWordLimit) return `The abstract is over the ${maxWords}-word limit. Shorten it to continue.`;
    if (step === 3) {
      if (authors.length === 0) return "Add at least one author.";
      if (!authors.some((a) => a.isPresenting)) return "Mark one author as presenting.";
    }
    if (step === 5 && (!allAuthorsConsented || !noIdentifiableData)) return "Tick both required declarations to continue.";
    return null;
  }

  const goTo = (s: WizardStep) => {
    setStepError(null);
    setCurrentStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const err = gateFor(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    const n = Math.min(6, currentStep + 1) as WizardStep;
    if (n > furthestStep) setFurthestStep(n);
    goTo(n);
  };

  // Hide the gate message as soon as the problem is fixed.
  const visibleStepError = stepError && gateFor(currentStep) ? gateFor(currentStep) : null;

  const indicatorSteps: Step[] = STEPS.map((s) => ({
    label: s.label,
    description: s.description,
    state:
      s.step === currentStep
        ? "current"
        : s.step > furthestStep
          ? "upcoming"
          : stepHasBlocker(s.step)
            ? "error"
            : "complete",
  }));

  const saveState: AutosaveState = savingDraft ? "saving" : saveFailed ? "error" : lastSavedAt ? "saved" : "idle";
  const presenter = authors.find((a) => a.isPresenting);

  /* ─── Render ──────────────────────────────────────────────────────────── */

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-3xl px-gutter py-8">
        <FormSkeleton fields={4} label="Loading the submission form…" />
      </div>
    );
  }

  const preview = (
    <AbstractPreview
      title={title}
      refNo={refNo}
      typeName={currentSubmissionType?.name ?? ""}
      categoryName={categories.find((c) => c.id === selectedCategoryId)?.name ?? null}
      presentation={presentationLabel}
      authors={authors}
      affiliations={affiliations}
      sections={sections}
      abstractBody={abstractBody}
      keywords={keywords}
    />
  );

  if (submittedSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-gutter py-8 md:py-12">
        <div className="text-center print:hidden">
          <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-tint text-success">
            <CheckCircle2 className="size-9" aria-hidden />
          </span>
          <h1 className="font-heading text-3xl font-semibold">Abstract submitted</h1>
          <p className="mx-auto mt-2 max-w-[50ch] text-base text-muted-foreground">
            The scientific committee will review it. You can track it, and edit it until the deadline, from My submissions.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Your reference number</p>
            <p className="mt-1 font-mono text-3xl font-semibold tracking-wide text-brand-ink">{refNo ?? "—"}</p>
            <p className="mt-2 text-sm text-muted-foreground">Quote it if you contact the secretariat.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => window.print()}>
              <Download data-icon="inline-start" />
              Download PDF
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${orgSlug}/${eventSlug}/my-submissions`}>Go to My submissions</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">“Download PDF” opens your browser&apos;s print dialog — choose “Save as PDF”.</p>
        </div>
        <div id="print-abstract" className="mt-10 rounded-lg border border-border bg-card p-5 md:p-8 print:mt-0 print:border-0 print:p-0">
          {preview}
        </div>
      </div>
    );
  }

  const stepMeta = STEPS[currentStep - 1]!;

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-gutter pt-6 md:pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">
          {refNo ? `Editing ${refNo}` : submissionId ? "Draft" : "New abstract"}
        </p>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">{title.trim() || "Submit an abstract"}</h1>
      </header>

      <StepIndicator
        steps={indicatorSteps}
        current={currentStep - 1}
        onStepClick={(i) => goTo((i + 1) as WizardStep)}
        className="mb-6"
      />

      <div className="space-y-6 pb-6">
        {/* ── 1. Details ─────────────────────────────────────────────── */}
        {currentStep === 1 ? (
          <FormSection title="Details" description="What kind of abstract this is, where it fits, and its title.">
            <FormField
              label="Submission type"
              required
              help={currentSubmissionType ? `Up to ${currentSubmissionType.wordLimit} words.` : undefined}
            >
              {(p) => (
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {submissionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {currentSubmissionType?.requiresErc ? (
              <p className="-mt-2 flex items-start gap-2 rounded-md bg-info-tint px-3 py-2 text-sm text-info-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                This type needs ethics review committee (ERC) details — have your approval or exemption letter ready.
              </p>
            ) : null}

            <FormField label="Track" required help="Choose the one that fits best. The committee can move it.">
              {(p) => (
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue placeholder="Choose a track" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField
              label="Title"
              required
              counter={`${title.length} / 500`}
              help="Sentence case, specific, no abbreviations."
              error={visibleStepError && !title.trim() ? visibleStepError : undefined}
            >
              <Textarea
                value={title}
                maxLength={500}
                rows={2}
                className="min-h-0"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Outcomes of early weight-bearing after ankle fracture fixation"
              />
            </FormField>
            {duplicateWarning ? (
              <p role="status" className="-mt-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-tint px-3 py-2 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {duplicateWarning}
              </p>
            ) : null}

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-base font-medium">Preferred presentation</legend>
              <RadioGroup value={preferredPresentation} onValueChange={setPreferredPresentation} className="gap-2">
                {presentationOptions.map(({ value: v, label }) => (
                  <Label
                    key={v}
                    className="flex min-h-control items-center gap-3 rounded-md border border-border px-4 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-tint"
                  >
                    <RadioGroupItem value={v} />
                    {label}
                  </Label>
                ))}
              </RadioGroup>
              <p className="text-sm text-muted-foreground">The committee makes the final choice after review.</p>
            </fieldset>
          </FormSection>
        ) : null}

        {/* ── 2. Abstract ────────────────────────────────────────────── */}
        {currentStep === 2 ? (
          <>
            <WordCounter count={totalWordCount} max={maxWords} />
            <FormSection
              title="Abstract"
              description="Write each section. The title and keywords don't count towards the word limit."
            >
              <p className="-mt-1 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Tables, images and figures aren&apos;t allowed. Pasted ones are removed — describe results in words and numbers.
              </p>
              {sections.length === 0 ? (
                <p className="text-base text-muted-foreground">This submission type has no sections set up. Contact the secretariat.</p>
              ) : (
                sections.map((sec) => (
                  <div key={sec.key} className="grid gap-2">
                    <Label htmlFor={`sec_${sec.key}`} className="text-lg font-semibold">
                      {sec.label}
                    </Label>
                    <AbstractSectionEditor
                      id={`sec_${sec.key}`}
                      label={sec.label}
                      value={abstractBody[sec.key] || ""}
                      onChange={(html) => setAbstractBody((prev) => ({ ...prev, [sec.key]: html }))}
                      placeholder={`Write the ${sec.label.toLowerCase()}…`}
                    />
                  </div>
                ))
              )}
            </FormSection>

            <FormSection title="Keywords" description="Up to 5. Press Enter after each one.">
              <div className="flex gap-2">
                <Input
                  aria-label="Keyword"
                  placeholder={keywords.length >= 5 ? "Keyword limit reached" : "e.g. tibial fracture"}
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
                <Button type="button" variant="outline" onClick={addKeyword} disabled={keywords.length >= 5}>
                  Add
                </Button>
              </div>
              {keywords.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Keywords added">
                  {keywords.map((kw) => (
                    <li key={kw} className="inline-flex items-center gap-1 rounded-md bg-secondary py-1 pr-1 pl-3 text-base">
                      {kw}
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeKeyword(kw)} aria-label={`Remove keyword ${kw}`}>
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </FormSection>

            {formFields.length > 0 ? (
              <FormSection title="Additional questions">
                {formFields.map((f) => (
                  <FormField key={f.id} label={f.label} required={f.required} optional={!f.required} help={f.helpText ?? undefined}>
                    {(p) =>
                      f.type === "TEXT" || f.type === "NUMBER" || f.type === "DATE" ? (
                        <Input
                          {...p}
                          type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
                          value={(customFieldValues[f.id] as string) || ""}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        />
                      ) : f.type === "LONG_TEXT" ? (
                        <Textarea
                          {...p}
                          value={(customFieldValues[f.id] as string) || ""}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        />
                      ) : f.type === "DROPDOWN" && f.options ? (
                        <Select
                          value={(customFieldValues[f.id] as string) || ""}
                          onValueChange={(val) => setCustomFieldValues((prev) => ({ ...prev, [f.id]: val }))}
                        >
                          <SelectTrigger {...p} className="w-full">
                            <SelectValue placeholder="Choose an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {f.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p {...p} className="text-sm text-muted-foreground">This question type isn&apos;t supported here yet.</p>
                      )
                    }
                  </FormField>
                ))}
              </FormSection>
            ) : null}
          </>
        ) : null}

        {/* ── 3. Authors ─────────────────────────────────────────────── */}
        {currentStep === 3 ? (
          <>
            <FormSection
              title="Affiliations"
              description="Enter each institution once. Authors link to them by number, shown as superscripts."
              aside={
                <Button type="button" variant="outline" onClick={addAffiliation}>
                  <Plus data-icon="inline-start" />
                  Add institution
                </Button>
              }
            >
              {affiliations.length === 0 ? (
                <p className="text-base text-muted-foreground">No institutions yet.</p>
              ) : (
                <ol className="grid gap-3">
                  {affiliations.map((aff, idx) => (
                    <li key={aff.number} className="flex items-center gap-2">
                      <span className="flex size-control shrink-0 items-center justify-center rounded-md bg-muted font-semibold tabular-nums" aria-hidden>
                        {aff.number}
                      </span>
                      <Input
                        aria-label={`Institution ${aff.number}`}
                        placeholder="e.g. Faculty of Medicine, University of Colombo"
                        value={aff.text}
                        onChange={(e) => updateAffiliationText(idx, e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="icon" className="text-danger-foreground" onClick={() => removeAffiliation(idx)} aria-label={`Remove institution ${aff.number}`}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </FormSection>

            <FormSection
              title="Authors"
              description="In publication order. Mark one presenting and one corresponding author."
              aside={
                <Button type="button" onClick={openAddAuthor}>
                  <Plus data-icon="inline-start" />
                  Add author
                </Button>
              }
            >
              {authors.length === 0 ? (
                <p className="text-base text-muted-foreground">No authors yet. Add yourself first if you&apos;re an author.</p>
              ) : (
                <ol className="grid gap-3">
                  {authors.map((a, idx) => (
                    <li
                      key={a.id}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx !== null) moveAuthorTo(dragIdx, idx);
                        setDragIdx(null);
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      className={cn("rounded-lg border border-border bg-card", dragIdx === idx && "opacity-50")}
                    >
                      <div className="flex items-start gap-2 p-3">
                        <span className="hidden cursor-grab items-center self-stretch text-muted-foreground md:flex" aria-hidden title="Drag to reorder">
                          <GripVertical className="size-5" />
                        </span>
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-hidden>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold">
                            {a.surname} {a.initials}
                            {a.affiliationNos?.length ? <sup className="ml-0.5 text-brand-ink">{a.affiliationNos.join(",")}</sup> : null}
                          </p>
                          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {[a.designation, a.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Button type="button" variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => moveAuthor(idx, "up")} aria-label={`Move ${a.surname} up`}>
                            <ArrowUp />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" disabled={idx === authors.length - 1} onClick={() => moveAuthor(idx, "down")} aria-label={`Move ${a.surname} down`}>
                            <ArrowDown />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2">
                        <label className="flex min-h-control items-center gap-2 text-sm">
                          <Switch checked={a.isPresenting} onCheckedChange={() => setRole(idx, "isPresenting")} aria-label={`${a.surname} is presenting`} />
                          <Mic className="size-4 text-muted-foreground" aria-hidden />
                          Presenting
                        </label>
                        <label className="flex min-h-control items-center gap-2 text-sm">
                          <Switch checked={a.isCorresponding} onCheckedChange={() => setRole(idx, "isCorresponding")} aria-label={`${a.surname} is corresponding`} />
                          <Mail className="size-4 text-muted-foreground" aria-hidden />
                          Corresponding
                        </label>
                        <span className="ml-auto flex">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEditAuthor(idx)}>
                            <Pencil data-icon="inline-start" />
                            Edit<span className="sr-only"> {a.surname}</span>
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" className="text-danger-foreground" onClick={() => setRemoveAuthorIdx(idx)} aria-label={`Remove ${a.surname}`}>
                            <Trash2 />
                          </Button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {authors.length > 1 ? (
                <p className="text-sm text-muted-foreground">
                  Use the arrows to reorder<span className="hidden md:inline">, or drag a card by its handle</span>.
                </p>
              ) : null}
            </FormSection>
          </>
        ) : null}

        {/* ── 4. Ethics ──────────────────────────────────────────────── */}
        {currentStep === 4 ? (
          <FormSection
            title="Ethics review"
            description={
              currentSubmissionType?.requiresErc
                ? "Required for this submission type. Research and audits need ERC approval or an exemption letter."
                : "Optional for this submission type."
            }
          >
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-base font-medium">
                ERC status{currentSubmissionType?.requiresErc ? <span className="text-danger" aria-hidden> *</span> : null}
              </legend>
              <RadioGroup value={ercStatus} onValueChange={(v) => setErcStatus(v as typeof ercStatus)} className="gap-2">
                {[
                  { value: "APPROVED", label: "Approved", help: "An ethics review committee approved this study." },
                  { value: "EXEMPT", label: "Exempt", help: "The committee confirmed review wasn't needed." },
                  { value: "NOT_APPLICABLE", label: "Not applicable", help: "For example, a case report with consent." },
                ].map((opt) => (
                  <Label
                    key={opt.value}
                    className="flex min-h-control items-start gap-3 rounded-md border border-border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-tint"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <span>
                      <span className="block text-base font-medium">{opt.label}</span>
                      <span className="block text-sm text-muted-foreground">{opt.help}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>

            {ercStatus === "APPROVED" || ercStatus === "EXEMPT" ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Approving committee" optional>
                    <Input value={ercInstitution} onChange={(e) => setErcInstitution(e.target.value)} placeholder="e.g. ERC, Faculty of Medicine, Colombo" />
                  </FormField>
                  <FormField label="Reference number" optional help="Or upload the certificate below.">
                    <Input value={ercRefNo} onChange={(e) => setErcRefNo(e.target.value)} placeholder="e.g. EC-2025-112" />
                  </FormField>
                </div>
                <FileUpload
                  label={ercStatus === "EXEMPT" ? "Exemption letter (PDF)" : "Approval certificate (PDF)"}
                  accept="application/pdf"
                  acceptLabel="PDF only"
                  maxSizeMb={10}
                  uploading={ercUploading}
                  error={ercError}
                  value={ercFileUploaded ? { name: ercFileInfo?.name ?? "ERC certificate.pdf", size: ercFileInfo?.size ?? 0 } : null}
                  onSelect={(file) => void handleErcFileUpload(file)}
                />
                {ercFileUploaded ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => void viewErcFile()}>
                      <ExternalLink data-icon="inline-start" />
                      View uploaded certificate
                    </Button>
                    <label className="inline-flex min-h-control cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 text-base font-medium hover:bg-muted focus-within:ring-3 focus-within:ring-ring/45">
                      {ercUploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      Replace certificate
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        disabled={ercUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 10 * 1024 * 1024) setErcError(`${f.name} is larger than 10 MB. Compress it or scan at a lower resolution.`);
                            else void handleErcFileUpload(f);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : !submissionId ? (
                  <p className="text-sm text-muted-foreground">Your draft is saved first, so the file has somewhere to go.</p>
                ) : null}
              </>
            ) : null}
          </FormSection>
        ) : null}

        {/* ── 5. Declarations ────────────────────────────────────────── */}
        {currentStep === 5 ? (
          <FormSection title="Declarations" description="The first two are required to submit.">
            <DeclarationRow
              id="consent"
              required
              checked={allAuthorsConsented}
              onChange={setAllAuthorsConsented}
              title="All authors consent"
              text="Every listed author has read this version and agreed to its submission."
            />
            <DeclarationRow
              id="patient-data"
              required
              checked={noIdentifiableData}
              onChange={setNoIdentifiableData}
              title="No identifiable patient data"
              text="The abstract contains no names, photos, record numbers or anything else that could identify a patient."
            />
            <DeclarationRow
              id="coi"
              checked={noConflictOfInterest}
              onChange={setNoConflictOfInterest}
              title="No conflicts of interest"
              text="No author has a commercial, financial or personal interest in this work. Untick to declare one."
            >
              {!noConflictOfInterest ? (
                <FormField label="Describe the conflict of interest">
                  <Textarea value={conflictDetails} onChange={(e) => setConflictDetails(e.target.value)} placeholder="Funding, advisory roles, shareholdings…" />
                </FormField>
              ) : null}
            </DeclarationRow>
            <DeclarationRow
              id="prior"
              checked={previouslyPresented}
              onChange={setPreviouslyPresented}
              title="Presented or published before"
              text="This work has been presented at another meeting or published in a journal."
            >
              {previouslyPresented ? (
                <FormField label="Where and when">
                  <Textarea value={previouslyPresentedDetails} onChange={(e) => setPreviouslyPresentedDetails(e.target.value)} placeholder="Meeting and date, or the journal citation" />
                </FormField>
              ) : null}
            </DeclarationRow>
          </FormSection>
        ) : null}

        {/* ── 6. Review and submit ───────────────────────────────────── */}
        {currentStep === 6 ? (
          <>
            <section aria-labelledby="ready-title" className={cn("rounded-lg border p-4 md:p-5", blockers.length ? "border-danger/30 bg-danger-tint/40" : "border-success/30 bg-success-tint/60")}>
              <h2 id="ready-title" className="text-lg font-semibold">
                {blockers.length ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} to fix before you submit` : "Ready to submit"}
              </h2>
              {issues.length ? (
                <ul className="mt-3 space-y-1">
                  {issues.map((iss, k) => (
                    <li key={k} className="flex flex-wrap items-center gap-x-3 text-base">
                      {iss.blocking ? <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden /> : <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{iss.blocking ? "Required: " : "Check: "}</span>
                        {iss.message}
                      </span>
                      <Button type="button" variant="link" size="sm" onClick={() => goTo(iss.step)}>
                        Fix in {STEPS[iss.step - 1]!.label}
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 flex items-center gap-2 text-base text-success-foreground">
                  <CheckCircle2 className="size-5" aria-hidden />
                  Everything the committee needs is filled in.
                </p>
              )}
            </section>

            <section aria-labelledby="summary-title" className="rounded-lg border border-border bg-card">
              <h2 id="summary-title" className="border-b border-border px-4 py-3 text-lg font-semibold md:px-6">Summary</h2>
              <dl className="divide-y divide-border">
                {[
                  { step: 1 as WizardStep, label: "Type and track", value: `${currentSubmissionType?.name ?? "—"} · ${categories.find((c) => c.id === selectedCategoryId)?.name ?? "No track"}` },
                  { step: 1 as WizardStep, label: "Presentation", value: presentationLabel },
                  { step: 2 as WizardStep, label: "Length", value: `${totalWordCount} of ${maxWords} words · ${keywords.length} keyword${keywords.length === 1 ? "" : "s"}` },
                  { step: 3 as WizardStep, label: "Authors", value: `${authors.length} author${authors.length === 1 ? "" : "s"}${presenter ? ` · ${presenter.surname} ${presenter.initials} presenting` : ""}` },
                  { step: 4 as WizardStep, label: "Ethics", value: ercStatus ? `${ercStatus === "NOT_APPLICABLE" ? "Not applicable" : ercStatus === "APPROVED" ? "Approved" : "Exempt"}${ercRefNo ? ` · ${ercRefNo}` : ""}${ercFileUploaded ? " · certificate uploaded" : ""}` : "Not given" },
                  { step: 5 as WizardStep, label: "Declarations", value: [allAuthorsConsented ? "Consent confirmed" : "Consent missing", noIdentifiableData ? "no patient data" : "patient data not confirmed", noConflictOfInterest ? "no conflicts" : "conflict declared"].join(" · ") },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 px-4 py-3 md:px-6">
                    <dt className="w-28 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 flex-1 text-base">{row.value}</dd>
                    <Button type="button" variant="ghost" size="sm" onClick={() => goTo(row.step)}>
                      Edit<span className="sr-only"> {row.label}</span>
                    </Button>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="preview-title" className="rounded-lg border border-border bg-card p-4 md:p-6">
              <h2 id="preview-title" className="mb-4 text-sm text-muted-foreground">How it will appear in the abstract book</h2>
              {preview}
            </section>

            {submitError ? (
              <div role="alert" className="rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-base text-danger-foreground">
                <p className="font-semibold">Not submitted yet</p>
                <p>{submitError}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Sticky action bar: Back / Next (or Submit) + autosave state */}
      <div className="sticky bottom-0 z-20 -mx-gutter border-t border-border bg-background/95 px-gutter pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:mx-0 md:rounded-t-lg md:border-x">
        {visibleStepError ? (
          <p role="alert" className="mb-2 flex items-start gap-2 text-sm font-medium text-danger-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {visibleStepError}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" disabled={currentStep === 1} onClick={() => goTo((currentStep - 1) as WizardStep)} aria-label="Back">
            <ChevronLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <AutosaveIndicator state={saveState} savedAt={lastSavedAt} onRetry={() => void saveDraft(false)} className="min-h-0 text-xs sm:text-sm" />
            <button
              type="button"
              onClick={() => void saveDraft(false)}
              disabled={savingDraft || !title.trim()}
              className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-brand-ink underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline pointer-coarse:min-h-8"
            >
              <Save className="size-3.5" aria-hidden />
              Save draft
            </button>
          </div>
          {currentStep < 6 ? (
            <Button type="button" onClick={next}>
              Next: {STEPS[currentStep]!.label}
              <ChevronRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button type="button" onClick={() => void submitAbstract()} disabled={submitting || isOverWordLimit}>
              {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {submitting ? "Submitting…" : "Submit abstract"}
            </Button>
          )}
        </div>
        <span className="sr-only" aria-live="polite">Step {currentStep} of 6: {stepMeta.label}</span>
      </div>

      {/* Author editor */}
      <SidePanel
        open={authorModalOpen}
        onOpenChange={setAuthorModalOpen}
        title={editingAuthorIdx !== null ? "Edit author" : "Add author"}
        description="As it should appear in the abstract book."
        footer={
          <>
            <Button variant="outline" onClick={() => setAuthorModalOpen(false)}>Cancel</Button>
            <Button onClick={saveAuthorFromModal}>{editingAuthorIdx !== null ? "Save author" : "Add author"}</Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <FormField label="Surname" required error={authorErrors.surname}>
              <Input value={authorForm.surname} onChange={(e) => setAuthorForm({ ...authorForm, surname: e.target.value })} placeholder="Perera" autoComplete="family-name" />
            </FormField>
            <FormField label="Initials" required error={authorErrors.initials}>
              <Input value={authorForm.initials} onChange={(e) => setAuthorForm({ ...authorForm, initials: e.target.value })} placeholder="K.A.D." />
            </FormField>
          </div>
          <FormField label="Email" required error={authorErrors.email}>
            <Input type="email" inputMode="email" value={authorForm.email} onChange={(e) => setAuthorForm({ ...authorForm, email: e.target.value })} placeholder="name@hospital.lk" />
          </FormField>
          <FormField label="Designation" optional>
            <Input value={authorForm.designation} onChange={(e) => setAuthorForm({ ...authorForm, designation: e.target.value })} placeholder="e.g. Senior Registrar" />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
            <FormField label="SLMC no." optional>
              <Input inputMode="numeric" value={authorForm.slmcNo} onChange={(e) => setAuthorForm({ ...authorForm, slmcNo: e.target.value })} />
            </FormField>
            <FormField label="Membership no." optional>
              <Input value={authorForm.membershipNo} onChange={(e) => setAuthorForm({ ...authorForm, membershipNo: e.target.value })} />
            </FormField>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-base font-medium">Affiliations</legend>
            {affiliations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add institutions under Affiliations first, then tick them here.</p>
            ) : (
              affiliations.map((aff) => (
                <Label key={aff.number} className="flex min-h-control items-start gap-3 rounded-md border border-border px-3 py-2.5 font-normal has-[[data-state=checked]]:border-primary">
                  <Checkbox
                    className="mt-0.5"
                    checked={authorForm.affiliationNos.includes(aff.number)}
                    onCheckedChange={(v) =>
                      setAuthorForm({
                        ...authorForm,
                        affiliationNos: v === true
                          ? [...authorForm.affiliationNos, aff.number].sort((x, y) => x - y)
                          : authorForm.affiliationNos.filter((n) => n !== aff.number),
                      })
                    }
                  />
                  <span className="text-base">
                    <sup className="mr-1 font-semibold text-brand-ink">{aff.number}</sup>
                    {aff.text || "Unnamed institution"}
                  </span>
                </Label>
              ))
            )}
          </fieldset>

          <div className="grid gap-2 rounded-md border border-border p-3">
            <label className="flex min-h-control items-center justify-between gap-3 text-base">
              <span>
                <span className="block font-medium">Presenting author</span>
                <span className="block text-sm text-muted-foreground">Presents if accepted.</span>
              </span>
              <Switch checked={authorForm.isPresenting} onCheckedChange={(v) => setAuthorForm({ ...authorForm, isPresenting: v })} />
            </label>
            <label className="flex min-h-control items-center justify-between gap-3 border-t border-border pt-2 text-base">
              <span>
                <span className="block font-medium">Corresponding author</span>
                <span className="block text-sm text-muted-foreground">The committee&apos;s point of contact.</span>
              </span>
              <Switch checked={authorForm.isCorresponding} onCheckedChange={(v) => setAuthorForm({ ...authorForm, isCorresponding: v })} />
            </label>
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={removeAuthorIdx !== null}
        onOpenChange={(o) => !o && setRemoveAuthorIdx(null)}
        title="Remove this author?"
        description={removeAuthorIdx !== null && authors[removeAuthorIdx] ? `${authors[removeAuthorIdx]!.surname} ${authors[removeAuthorIdx]!.initials} will be taken off this abstract.` : ""}
        confirmLabel="Remove author"
        destructive
        onConfirm={() => {
          if (removeAuthorIdx !== null) removeAuthor(removeAuthorIdx);
          setRemoveAuthorIdx(null);
        }}
      />
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────── */

/** Sticky live word count: amber from 90% of the limit, red when over. */
function WordCounter({ count, max }: { count: number; max: number }) {
  const ratio = max > 0 ? count / max : 0;
  const state = count > max ? "over" : ratio >= 0.9 ? "near" : "ok";
  return (
    <div
      className={cn(
        "sticky top-14 z-10 -mx-gutter flex items-center gap-3 border-y px-gutter py-2.5 backdrop-blur md:mx-0 md:rounded-lg md:border lg:top-16",
        state === "over" && "border-danger/40 bg-danger-tint/95 text-danger-foreground",
        state === "near" && "border-warning/40 bg-warning-tint/95 text-warning-foreground",
        state === "ok" && "border-border bg-background/95",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="text-base font-semibold tabular-nums">
        {count} / {max} words
      </span>
      <span className="text-sm">
        {state === "over" ? `${count - max} over the limit` : state === "near" ? `${max - count} left` : "Title and keywords don't count"}
      </span>
      <span className="ml-auto hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
        <span
          className={cn("block h-full rounded-full", state === "over" ? "bg-danger" : state === "near" ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </span>
    </div>
  );
}

function DeclarationRow({
  id,
  checked,
  onChange,
  title,
  text,
  required = false,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  text: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border p-4 has-[[data-state=checked]]:border-primary/50">
      <Label htmlFor={id} className="flex items-start gap-3 font-normal">
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" aria-required={required || undefined} />
        <span>
          <span className="block text-base font-medium">
            {title}
            {required ? <span className="text-danger" aria-hidden> *</span> : null}
          </span>
          <span className="block text-sm text-muted-foreground">{text}</span>
        </span>
      </Label>
      {children}
    </div>
  );
}

/** Formatted abstract (review step, confirmation page, and the printable PDF). */
function AbstractPreview({
  title,
  refNo,
  typeName,
  categoryName,
  presentation,
  authors,
  affiliations,
  sections,
  abstractBody,
  keywords,
}: {
  title: string;
  refNo: string | null;
  typeName: string;
  categoryName: string | null;
  presentation: string;
  authors: SubmissionAuthorDto[];
  affiliations: SubmissionAffiliationDto[];
  sections: Array<{ key: string; label: string }>;
  abstractBody: Record<string, string>;
  keywords: string[];
}) {
  return (
    <article className="text-foreground">
      <p className="text-sm text-muted-foreground">
        {[refNo, typeName, categoryName, presentation].filter(Boolean).join(" · ")}
      </p>
      <h3 className="mt-2 font-heading text-2xl leading-snug font-semibold">{title || "Untitled abstract"}</h3>
      {authors.length ? (
        <p className="mt-3 text-base">
          {authors.map((a, i) => (
            <span key={a.id}>
              <span className={a.isPresenting ? "underline decoration-2 underline-offset-4" : undefined}>
                {a.surname} {a.initials}
              </span>
              {a.affiliationNos?.length ? <sup>{a.affiliationNos.join(",")}</sup> : null}
              {i < authors.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
      {affiliations.filter((f) => f.text.trim()).length ? (
        <ol className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          {affiliations.filter((f) => f.text.trim()).map((f) => (
            <li key={f.number}>
              <sup>{f.number}</sup> {f.text}
            </li>
          ))}
        </ol>
      ) : null}
      {authors.some((a) => a.isPresenting) ? <p className="mt-1 text-sm text-muted-foreground">Presenting author underlined.</p> : null}
      <div className="mt-5 space-y-4 border-t border-border pt-4">
        {sections.map((sec) => (
          <section key={sec.key}>
            <h4 className="text-base font-semibold">{sec.label}</h4>
            {abstractBody[sec.key]?.replace(/<[^>]*>/g, "").trim() ? (
              <div className="rich-text text-base" dangerouslySetInnerHTML={{ __html: abstractBody[sec.key]! }} />
            ) : (
              <p className="text-base text-muted-foreground italic">Not written yet.</p>
            )}
          </section>
        ))}
      </div>
      {keywords.length ? (
        <p className="mt-4 text-base">
          <span className="font-semibold">Keywords: </span>
          {keywords.join(", ")}
        </p>
      ) : null}
    </article>
  );
}
