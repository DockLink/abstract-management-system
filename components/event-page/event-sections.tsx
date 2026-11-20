import type { ReactNode } from "react";
import { Download, FileText, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/** A titled block on the event page. */
export function EventSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24", className)}>
      <h2 id={`${id}-title`} className="font-heading text-2xl font-semibold">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Guidelines body (sanitised rich text) + PDF download card. */
export function Guidelines({ html, pdfUrl }: { html: string | null; pdfUrl: string | null }) {
  return (
    <div className="space-y-5">
      {html ? (
        <div
          className="rich-text"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex max-w-md items-center gap-4 rounded-lg border border-border bg-background p-4 hover:border-primary"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-tint text-brand-ink">
            <FileText className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Author guidelines</span>
            <span className="block text-sm text-muted-foreground">PDF · opens in a new tab</span>
          </span>
          <Download className="size-5 shrink-0 text-brand-ink" aria-hidden />
        </a>
      ) : null}
      {!html && !pdfUrl ? (
        <p className="text-base text-muted-foreground">
          The organising committee will publish author guidelines here.
        </p>
      ) : null}
    </div>
  );
}

export function CategoriesList({ categories }: { categories: Array<{ id: string; name: string }> }) {
  if (categories.length === 0) {
    return <p className="text-base text-muted-foreground">Tracks will be announced with the call for abstracts.</p>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {categories.map((c) => (
        <li
          key={c.id}
          className="flex min-h-control items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-base"
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
          {c.name}
        </li>
      ))}
    </ul>
  );
}

export function ContactBlock({
  orgName,
  email,
  phone,
}: {
  orgName: string;
  email: string | null;
  phone: string | null;
}) {
  if (!email && !phone) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <h2 className="text-lg font-semibold">Questions?</h2>
      <p className="mt-1 text-base text-muted-foreground">Contact the {orgName} secretariat.</p>
      <ul className="mt-3 space-y-1">
        {email ? (
          <li>
            <a
              href={`mailto:${email}`}
              className="-mx-2 flex min-h-control items-center gap-3 rounded-md px-2 text-base text-brand-ink hover:bg-muted [overflow-wrap:anywhere]"
            >
              <Mail className="size-5 shrink-0" aria-hidden />
              {email}
            </a>
          </li>
        ) : null}
        {phone ? (
          <li>
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="-mx-2 flex min-h-control items-center gap-3 rounded-md px-2 text-base text-brand-ink hover:bg-muted"
            >
              <Phone className="size-5 shrink-0" aria-hidden />
              {phone}
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
