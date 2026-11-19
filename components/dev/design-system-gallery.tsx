"use client";

import { useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { FileText, Inbox, MoreHorizontal, Plus, Users } from "lucide-react";

import { AppShell, AppShellNavLink } from "@/components/shared/app-shell";
import { AutosaveIndicator, type AutosaveState } from "@/components/shared/autosave-indicator";
import { BrandScope } from "@/components/shared/brand-scope";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DeadlineCountdown } from "@/components/shared/deadline-countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { FilterBar } from "@/components/shared/filter-bar";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import {
  CardListSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { brandForeground, contrastRatio, DEFAULT_BRAND } from "@/lib/theme/brand";
import { STATUS_MAP, type StatusKey } from "@/lib/status";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

/* ─── Page frame ─────────────────────────────────────────────────────────── */

type ViewMode = "light" | "dark" | "split";

const BRAND_PRESETS = [
  { name: "Clinical teal (default)", value: DEFAULT_BRAND },
  { name: "College maroon", value: "#7a1f2b" },
  { name: "Ceylon blue", value: "#1e4f8a" },
  { name: "Saffron (light brand)", value: "#e8b400" },
];

export function DesignSystemGallery() {
  const { setTheme } = useTheme();
  const [mode, setMode] = useState<ViewMode>("light");
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  const changeMode = (next: ViewMode) => {
    setMode(next);
    setTheme(next === "dark" ? "dark" : "light");
  };

  const fg = brandForeground(brand);

  return (
    <div className="min-h-screen bg-surface">
      <div className="z-40 border-b border-border bg-background/95 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-gutter py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-heading text-xl font-semibold">AMS design system</p>
            <p className="text-sm text-muted-foreground">
              Development only · tokens in app/globals.css · components in components/shared
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border border-border p-0.5">
              {(["light", "dark", "split"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => changeMode(m)}
                  className={cn(
                    "min-h-control-sm flex-1 rounded-[5px] px-3 text-sm font-medium whitespace-nowrap pointer-coarse:min-h-control",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "split" ? "Side by side" : m === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <Select value={BRAND_PRESETS.some((p) => p.value === brand) ? brand : "custom"} onValueChange={(v) => v !== "custom" && setBrand(v)}>
              <SelectTrigger size="sm" aria-label="Event brand colour" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="size-3 rounded-full" style={{ background: p.value }} aria-hidden />
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="color"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="size-9 cursor-pointer rounded-md border border-border bg-transparent pointer-coarse:size-control"
                aria-label="Custom brand colour"
              />
              <span className="tabular-nums text-muted-foreground">
                {brand} · text {fg === "#ffffff" ? "white" : "ink"} {contrastRatio(brand, fg).toFixed(1)}:1
              </span>
            </label>
          </div>
        </div>
      </div>

      <BrandScope color={brand}>
        {mode === "split" ? (
          <div className="grid xl:grid-cols-2">
            <div className="min-w-0 border-border xl:border-r">
              <PanelLabel>Light</PanelLabel>
              <Gallery />
            </div>
            <div className="dark min-w-0 bg-surface text-foreground">
              <PanelLabel>Dark</PanelLabel>
              <Gallery />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            <Gallery />
          </div>
        )}
      </BrandScope>
    </div>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-border bg-background px-gutter py-2 text-sm font-medium text-muted-foreground md:px-6">
      {children} theme
    </p>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 border-b border-border px-gutter py-10 md:px-6">
      <h2 id={`${id}-title`} className="font-heading text-2xl font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-[65ch] text-base text-muted-foreground">{description}</p> : null}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  );
}

function Demo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-muted-foreground">{label}</p>
      <div className={className}>{children}</div>
    </div>
  );
}

/* ─── Gallery body ───────────────────────────────────────────────────────── */

function Gallery() {
  return (
    <div className="text-foreground">
      <Foundations />
      <Primitives />
      <StatusSection />
      <LayoutSection />
      <StatesSection />
      <DataSection />
      <FormsSection />
      <FeedbackSection />
    </div>
  );
}

/* Foundations */

const SWATCHES: { name: string; token: string; text?: string }[] = [
  { name: "Surface (page)", token: "--surface" },
  { name: "Background (cards)", token: "--background" },
  { name: "Muted", token: "--muted" },
  { name: "Foreground", token: "--foreground", text: "--background" },
  { name: "Muted foreground", token: "--muted-foreground", text: "--background" },
  { name: "Border (rules)", token: "--border" },
  { name: "Input (outlines)", token: "--input", text: "--background" },
  { name: "Brand", token: "--brand", text: "--brand-foreground" },
  { name: "Brand ink (links)", token: "--brand-ink", text: "--background" },
  { name: "Brand tint", token: "--primary-tint", text: "--brand-ink" },
];

const SEMANTIC = ["success", "warning", "danger", "info"] as const;

function Foundations() {
  return (
    <Section id="foundations" title="Foundations" description="Ink on cool paper, one action colour that follows the event brand (GEN-02), tinted semantic pairs.">
      <Demo label="Colour tokens" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SWATCHES.map((s) => (
          <div key={s.token} className="overflow-hidden rounded-lg border border-border">
            <div className="flex h-16 items-end p-2 text-xs font-medium" style={{ background: `var(${s.token})`, color: s.text ? `var(${s.text})` : undefined }}>
              {s.text ? "Aa" : null}
            </div>
            <div className="bg-background p-2">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{s.token}</p>
            </div>
          </div>
        ))}
      </Demo>

      <Demo label="Semantic pairs — solid · tint with foreground text" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEMANTIC.map((name) => (
          <div key={name} className="overflow-hidden rounded-lg border border-border">
            <div className="h-10" style={{ background: `var(--${name})` }} />
            <div className="p-3 text-sm font-medium" style={{ background: `var(--${name}-tint)`, color: `var(--${name}-foreground)` }}>
              {name[0].toUpperCase() + name.slice(1)} message on tint
            </div>
          </div>
        ))}
      </Demo>

      <Demo label="Type — Source Serif 4 for titles, Source Sans 3 for everything else. 16px body, 13px floor." className="space-y-3">
        <p className="font-heading text-4xl font-semibold">Annual Academic Sessions 2027</p>
        <p className="font-heading text-3xl font-semibold">Page title · text-3xl</p>
        <p className="font-heading text-2xl font-semibold">Page title on phones · text-2xl</p>
        <p className="text-xl font-semibold">Section title · text-xl</p>
        <p className="text-lg">Lead paragraph · text-lg — 18px</p>
        <p className="max-w-[65ch] text-base">
          Body · text-base — 16px. Management of open tibial fractures: a prospective five-year multicentre study across
          three teaching hospitals in Sri Lanka. Line length stays under 75 characters.
        </p>
        <p className="text-sm text-muted-foreground">Secondary · text-sm — 15px, dense tables and help text</p>
        <p className="text-xs text-muted-foreground">Caption · text-xs — 13px, the smallest size in the system</p>
        <p className="font-mono text-sm">AAS27-0042 · reference numbers in mono</p>
      </Demo>

      <Demo label="Radius · spacing · elevation" className="flex flex-wrap items-end gap-4">
        <div className="flex size-20 items-center justify-center rounded-md border border-input text-xs">6px controls</div>
        <div className="flex size-20 items-center justify-center rounded-lg border border-border text-xs">8px cards</div>
        <div className="flex h-control items-center rounded-md bg-muted px-3 text-xs">h-control · 44px</div>
        <div className="flex size-20 items-center justify-center rounded-lg bg-popover text-xs shadow-overlay">overlay shadow</div>
      </Demo>
    </Section>
  );
}

/* Primitives */

function Primitives() {
  return (
    <Section id="primitives" title="Controls" description="shadcn primitives restyled with tokens. Default, lg and icon sizes are 44px+; sm and xs grow to 44px on touch screens.">
      <Demo label="Button variants" className="flex flex-wrap gap-2">
        <Button>Submit abstract</Button>
        <Button variant="outline">Save draft</Button>
        <Button variant="secondary">Preview</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Remove</Button>
        <Button variant="danger">Withdraw abstract</Button>
        <Button variant="link">View guidelines</Button>
      </Demo>
      <Demo label="Button sizes and states" className="flex flex-wrap items-center gap-2">
        <Button size="lg">Large</Button>
        <Button>Default</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra small</Button>
        <Button size="icon" aria-label="More actions"><MoreHorizontal /></Button>
        <Button disabled>Disabled</Button>
        <Button disabled>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          Saving…
        </Button>
        <Button><Plus data-icon="inline-start" />Add author</Button>
      </Demo>

      <div className="grid gap-6 md:grid-cols-2">
        <Demo label="Input states" className="space-y-3">
          <Input placeholder="Placeholder text" aria-label="Placeholder example" />
          <Input defaultValue="Dr. Anoma Silva" aria-label="Filled example" />
          <Input defaultValue="Disabled" disabled aria-label="Disabled example" />
          <Input defaultValue="not-an-email" aria-invalid aria-label="Invalid example" />
        </Demo>
        <Demo label="Select · textarea" className="space-y-3">
          <Select defaultValue="trauma">
            <SelectTrigger className="w-full" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trauma">Trauma &amp; Emergency Orthopaedics</SelectItem>
              <SelectItem value="spine">Spine &amp; Spinal Deformity</SelectItem>
              <SelectItem value="paeds">Paediatric Orthopaedics</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-full" aria-label="Empty select"><SelectValue placeholder="Select a category" /></SelectTrigger>
            <SelectContent><SelectItem value="a">Option</SelectItem></SelectContent>
          </Select>
          <Textarea placeholder="Comments for the authors" aria-label="Comments" />
        </Demo>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Demo label="Checkbox — declarations" className="space-y-3">
          <Label className="flex min-h-control items-start gap-3 text-base font-normal">
            <Checkbox defaultChecked className="mt-0.5" />
            All authors have approved this version
          </Label>
          <Label className="flex min-h-control items-start gap-3 text-base font-normal">
            <Checkbox className="mt-0.5" />
            No patient-identifiable data
          </Label>
          <Label className="flex min-h-control items-start gap-3 text-base font-normal opacity-60">
            <Checkbox disabled className="mt-0.5" />
            Disabled
          </Label>
        </Demo>
        <Demo label="Radio group — one choice">
          <RadioGroup defaultValue="approved" className="gap-1" aria-label="ERC status">
            {["ERC approved", "ERC exempt", "Not applicable"].map((l) => (
              <Label key={l} className="flex min-h-control items-center gap-3 rounded-md border border-border px-3 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-tint">
                <RadioGroupItem value={l === "ERC approved" ? "approved" : l} />
                {l}
              </Label>
            ))}
          </RadioGroup>
        </Demo>
        <Demo label="Switch — settings only" className="space-y-3">
          <Label className="flex min-h-control items-center justify-between gap-3 text-base font-normal">
            Require member author <Switch defaultChecked />
          </Label>
          <Label className="flex min-h-control items-center justify-between gap-3 text-base font-normal">
            Show reviews to authors <Switch />
          </Label>
        </Demo>
      </div>

      <Demo label="Tabs">
        <Tabs defaultValue="progress">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="pool">Reviewer pool</TabsTrigger>
            <TabsTrigger value="rubric">Scoring rubric</TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="pt-2 text-base text-muted-foreground">Progress content</TabsContent>
          <TabsContent value="pool" className="pt-2 text-base text-muted-foreground">Reviewer pool content</TabsContent>
          <TabsContent value="rubric" className="pt-2 text-base text-muted-foreground">Rubric content</TabsContent>
        </Tabs>
      </Demo>
    </Section>
  );
}

/* Status */

function StatusSection() {
  const submission: StatusKey[] = ["draft", "submitted", "under_review", "revisions_requested", "accepted", "rejected", "waitlisted", "confirmed", "withdrawn"];
  const other: StatusKey[] = ["pending", "in_progress", "completed", "conflict", "open", "closed"];
  return (
    <Section id="status" title="StatusBadge" description="One map for every status (lib/status.ts). The label is always shown; the dot keeps chips distinguishable without colour.">
      <Demo label="Submission lifecycle" className="flex flex-wrap gap-2">
        {submission.map((s) => <StatusBadge key={s} status={s} />)}
      </Demo>
      <Demo label="Review assignment · event lifecycle" className="flex flex-wrap gap-2">
        {other.map((s) => <StatusBadge key={s} status={s} />)}
      </Demo>
      <Demo label="Small · from raw enum values" className="flex flex-wrap gap-2">
        {["UNDER_REVIEW", "REVISIONS_REQUESTED", "CONFIRMED"].map((s) => <StatusBadge key={s} status={s} size="sm" />)}
      </Demo>
      <p className="text-sm text-muted-foreground">{Object.keys(STATUS_MAP).length} statuses mapped.</p>
    </Section>
  );
}

/* Layout */

function LayoutSection() {
  return (
    <Section id="layout" title="PageHeader · AppShell">
      <Demo label="PageHeader — back link, meta, actions (stack full-width on phones)" className="rounded-lg border border-dashed border-border p-4">
        <PageHeader
          back={{ href: "#layout", label: "My submissions" }}
          title="Management of open tibial fractures"
          description="Original research · Trauma & Emergency Orthopaedics"
          meta={<><StatusBadge status="under_review" /><span className="font-mono text-sm text-muted-foreground">AAS27-0001</span></>}
          actions={<><Button variant="outline">View history</Button><Button>Edit abstract</Button></>}
        />
      </Demo>
      <Demo label="AppShell — sidebar on desktop (lg+), sheet behind the menu button below that" className="h-[28rem] overflow-auto rounded-lg border border-border">
        <AppShell
          title="Annual Academic Sessions 2027"
          subtitle="Submissions"
          topbar={<span className="font-medium">Demo Medical College / Annual Academic Sessions 2027</span>}
          actions={<Button size="icon" variant="ghost" aria-label="Account menu"><Users /></Button>}
          sidebar={({ closeNav }) => (
            <nav className="flex flex-col gap-1 p-3">
              <AppShellNavLink href="#layout" onClick={closeNav} active><Inbox className="size-5" aria-hidden />Submissions</AppShellNavLink>
              <AppShellNavLink href="#layout" onClick={closeNav}><FileText className="size-5" aria-hidden />Reviews</AppShellNavLink>
            </nav>
          )}
        >
          <PageHeader title="Submissions" description="Everything authors have sent for this event." />
        </AppShell>
      </Demo>
    </Section>
  );
}

/* States */

function StatesSection() {
  const [retrying, setRetrying] = useState(false);
  return (
    <Section id="states" title="Loading · empty · error" description="Every data screen has all three, plus a success toast.">
      <div className="grid gap-6 md:grid-cols-2">
        <Demo label="EmptyState — with next action">
          <EmptyState icon={Inbox} title="No abstracts yet" description="Submissions open on 10 November 2026. Share the call for abstracts to get started." actionLabel="Copy event link" onAction={() => toast.success("Link copied")} />
        </Demo>
        <Demo label="EmptyState — compact, no action">
          <EmptyState compact icon={Users} title="No reviewers in the pool" description="Invited reviewers appear here once they accept." />
        </Demo>
        <Demo label="ErrorState — retry">
          <ErrorState
            description="The submissions list couldn't be reached."
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => setRetrying(false), 1500);
            }}
          />
        </Demo>
        <Demo label="ErrorState — permission, with way out">
          <ErrorState compact title="You're not a reviewer for this event" description="Ask the event secretary to add you to the reviewer pool." action={<Button variant="outline">Back to event</Button>} />
        </Demo>
      </div>
      <Demo label="Skeletons" className="space-y-6">
        <PageHeaderSkeleton />
        <StatCardsSkeleton />
        <TableSkeleton rows={3} />
        <div className="grid gap-6 md:grid-cols-2">
          <CardListSkeleton count={2} />
          <FormSkeleton fields={2} />
        </div>
      </Demo>
    </Section>
  );
}

/* Data */

type Row = { id: string; ref: string; title: string; category: string; status: StatusKey; updated: string };

const ROWS: Row[] = [
  { id: "1", ref: "AAS27-0002", title: "Antibiotic stewardship in surgical prophylaxis: a closed-loop clinical audit", category: "Trauma & Emergency", status: "accepted", updated: "17 November 2026" },
  { id: "2", ref: "AAS27-0001", title: "Management of open tibial fractures: a prospective 5-year multicentre study", category: "Trauma & Emergency", status: "under_review", updated: "17 November 2026" },
  { id: "3", ref: "Draft", title: "Outcomes of minimally invasive plate osteosynthesis for distal tibia fractures", category: "Arthroplasty", status: "draft", updated: "16 November 2026" },
  { id: "4", ref: "AAS27-0004", title: "Paediatric supracondylar fractures: a 10-year review", category: "Paediatric", status: "revisions_requested", updated: "15 November 2026" },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "ref", header: "Ref no.", cell: (r) => <span className="font-mono">{r.ref}</span>, mobile: "meta", className: "w-32" },
  { id: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} size="sm" />, mobile: "meta" },
  { id: "title", header: "Title", cell: (r) => <span className="line-clamp-2 font-medium">{r.title}</span>, mobile: "title", className: "min-w-72" },
  { id: "category", header: "Category", cell: (r) => r.category },
  { id: "updated", header: "Updated", cell: (r) => r.updated, className: "whitespace-nowrap" },
];

function DataSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const shown = ROWS.filter((r) => (status === "all" || r.status === status) && r.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <Section id="data" title="StatCard · FilterBar · DataTable" description="Tables become cards below md; actions stay visible.">
      <Demo label="StatCard" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total submissions" value={42} hint="Across all statuses" href="#data" linkLabel="View submissions" />
        <StatCard label="Reviews complete" value="68%" hint="85 of 125 assigned" progress={68} />
        <StatCard label="Conflicts declared" value={3} hint="Returned to track chairs" tone="warning" />
        <StatCard label="Overdue reviews" value={7} hint="Past 1 January 2027" tone="danger" />
      </Demo>
      <Demo label="FilterBar + DataTable (interactive)" className="space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search titles"
          activeCount={status === "all" ? 0 : 1}
          onClear={() => { setSearch(""); setStatus("all"); }}
          resultCount={{ shown: shown.length, total: ROWS.length, noun: "abstracts" }}
        >
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["draft", "under_review", "revisions_requested", "accepted"] as const).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_MAP[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
        <DataTable
          caption="Abstracts"
          columns={COLUMNS}
          rows={shown}
          getRowId={(r) => r.id}
          rowActions={(r) => <Button size="sm" variant="outline">Open<span className="sr-only"> {r.ref}</span></Button>}
          empty={{ icon: Inbox, title: "No abstracts match", description: "Try a different search or clear the filters.", action: <Button variant="outline" onClick={() => { setSearch(""); setStatus("all"); }}>Clear filters</Button> }}
        />
      </Demo>
      <div className="grid gap-6 lg:grid-cols-3">
        <Demo label="DataTable — loading"><DataTable columns={COLUMNS} rows={[]} getRowId={(r) => r.id} loading /></Demo>
        <Demo label="DataTable — empty"><DataTable columns={COLUMNS} rows={[]} getRowId={(r) => r.id} empty={{ icon: Inbox, title: "No abstracts yet", description: "They appear here as authors submit." }} /></Demo>
        <Demo label="DataTable — error"><DataTable columns={COLUMNS} rows={[]} getRowId={(r) => r.id} error="The server didn't respond." onRetry={() => toast.info("Retrying…")} /></Demo>
      </div>
    </Section>
  );
}

/* Forms */

const STEPS: Step[] = [
  { label: "Details", description: "Type and category" },
  { label: "Authors", description: "Authors and affiliations" },
  { label: "Abstract", description: "Structured body" },
  { label: "Ethics", description: "ERC and declarations" },
  { label: "Review", description: "Check and submit" },
];

function FormsSection() {
  const [step, setStep] = useState(2);
  const [title, setTitle] = useState("Management of open tibial fractures");
  const [save, setSave] = useState<AutosaveState>("saved");
  const savedAt = useNow(); // null during prerender (Cache Components)
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const words = title.trim() ? title.trim().split(/\s+/).length : 0;

  const fakeUpload = (f: File) => {
    setUploading(true);
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += 20;
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        setUploading(false);
        setFile({ name: f.name, size: f.size });
        toast.success("Certificate uploaded");
      }
    }, 300);
  };

  return (
    <Section id="forms" title="Forms" description="Labels above inputs, help under them, errors inline and announced.">
      <Demo label="StepIndicator — interactive (complete steps are clickable, upcoming are not)" className="space-y-4">
        <StepIndicator steps={STEPS} current={step} onStepClick={setStep} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Continue</Button>
        </div>
      </Demo>
      <Demo label="StepIndicator — step with a validation error">
        <StepIndicator steps={STEPS.map((s, i) => (i === 1 ? { ...s, state: "error" } : s))} current={3} />
      </Demo>

      <FormSection
        title="Abstract details"
        description="Choose the track and give the abstract a clear, specific title."
        aside={<AutosaveIndicator state={save} savedAt={savedAt} onRetry={() => setSave("saving")} />}
        footer={<><Button variant="outline">Save draft</Button><Button>Continue to authors</Button></>}
      >
        <FormField label="Abstract title" required help="Sentence case. No abbreviations." counter={`${words} / 25 words`}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Track" required error="Choose the track that best fits your study.">
          {(p) => (
            <Select>
              <SelectTrigger {...p} className="w-full"><SelectValue placeholder="Select a track" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trauma">Trauma &amp; Emergency Orthopaedics</SelectItem>
                <SelectItem value="spine">Spine &amp; Spinal Deformity</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Clinical trial registry number" optional help="SLCTR or WHO ICTRP ID, if registered.">
          <Input placeholder="SLCTR/2026/012" />
        </FormField>
        <FormField label="Submitting institution" help="Locked after submission.">
          <Input defaultValue="National Hospital of Sri Lanka" disabled />
        </FormField>
      </FormSection>

      <Demo label="AutosaveIndicator — every state" className="flex flex-col gap-1">
        {(["idle", "saving", "saved", "error", "offline"] as const).map((s) => (
          <div key={s} className="flex items-center gap-4">
            <span className="w-16 font-mono text-xs text-muted-foreground">{s}</span>
            <AutosaveIndicator state={s} savedAt={s === "idle" ? null : savedAt} onRetry={() => toast.info("Retrying save")} />
          </div>
        ))}
      </Demo>

      <div className="grid gap-6 md:grid-cols-2">
        <FileUpload
          label="ERC approval letter (interactive)"
          accept=".pdf,image/*"
          acceptLabel="PDF, JPG or PNG"
          maxSizeMb={5}
          value={file}
          uploading={uploading}
          progress={progress}
          onSelect={fakeUpload}
          onRemove={() => setFile(null)}
        />
        <FileUpload label="Uploading" acceptLabel="PDF" uploading progress={45} onSelect={() => {}} />
        <FileUpload label="Uploaded" value={{ name: "ERC-approval-NHSL-2026.pdf", size: 482_000 }} onSelect={() => {}} onRemove={() => {}} />
        <FileUpload label="Error" acceptLabel="PDF" error="ERC-letter.docx isn't a PDF. Save it as PDF and try again." onSelect={() => {}} />
      </div>
    </Section>
  );
}

/* Feedback */

function FeedbackSection() {
  const [confirm, setConfirm] = useState<null | "plain" | "destructive">(null);
  const [loading, setLoading] = useState(false);
  const now = useNow();
  const base = now?.getTime() ?? 0;
  const day = 86_400_000;

  return (
    <Section id="feedback" title="DeadlineCountdown · ConfirmDialog · Toast">
      <Demo label="DeadlineCountdown — neutral > 7 days, amber ≤ 7 days, red < 24 hours, closed" className="grid gap-3 sm:grid-cols-2">
        {now ? (
          <>
            <DeadlineCountdown label="Submissions close" deadline={new Date(base + 30 * day)} />
            <DeadlineCountdown label="Submissions close" deadline={new Date(base + 4 * day)} />
            <DeadlineCountdown label="Reviews due" deadline={new Date(base + 5 * 3_600_000)} />
            <DeadlineCountdown label="Early-bird registration" deadline={new Date(base - 2 * day)} />
          </>
        ) : null}
      </Demo>

      <Demo label="ConfirmDialog" className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setConfirm("plain")}>Assign reviewers…</Button>
        <Button variant="destructive" onClick={() => setConfirm("destructive")}>Withdraw abstract…</Button>
      </Demo>
      <ConfirmDialog
        open={confirm === "plain"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Assign 12 abstracts?"
        description="Each abstract goes to 2 reviewers in its track. Reviewers are emailed straight away."
        confirmLabel="Assign reviewers"
        loading={loading}
        onConfirm={() => {
          setLoading(true);
          setTimeout(() => { setLoading(false); setConfirm(null); toast.success("Reviewers assigned", "24 invitations sent"); }, 1200);
        }}
      />
      <ConfirmDialog
        open={confirm === "destructive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Withdraw this abstract?"
        description="Reviewers will no longer see it. You can't undo this after the submission deadline."
        confirmLabel="Withdraw abstract"
        destructive
        onConfirm={() => { setConfirm(null); toast.success("Abstract withdrawn"); }}
      />

      <Demo label="Toast" className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast.success("Abstract submitted", "Reference AAS27-0042")}>Success</Button>
        <Button variant="outline" onClick={() => toast.info("Reviews open on 1 December 2026")}>Info</Button>
        <Button variant="outline" onClick={() => toast.warning("Word limit exceeded", "Methods is 12 words over.")}>Warning</Button>
        <Button variant="outline" onClick={() => toast.error("Couldn't save your review", { description: "Check your connection.", onRetry: () => toast.success("Review saved") })}>Error with retry</Button>
      </Demo>
    </Section>
  );
}
