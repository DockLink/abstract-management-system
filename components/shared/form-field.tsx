"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

/**
 * Label above, control, help text, inline error. Wires `id`, `aria-invalid`,
 * `aria-describedby` and `aria-required` onto its single child control, so
 * <Input> and <Textarea> need no extra props.
 *
 *   <FormField label="Abstract title" required help="Max 25 words" error={errors.title}>
 *     <Input value={title} onChange={…} />
 *   </FormField>
 *
 * For composite controls (Select, RadioGroup) pass a render function and
 * spread the props onto the focusable element:
 *
 *   <FormField label="Track">
 *     {(p) => <Select><SelectTrigger {...p}>…</SelectTrigger>…</Select>}
 *   </FormField>
 */
export function FormField({
  label,
  help,
  error,
  required = false,
  optional = false,
  counter,
  id,
  className,
  children,
}: {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Show "(optional)" instead of marking required fields. */
  optional?: boolean;
  /** Right-aligned meta under the label row, e.g. "120 / 300 words". */
  counter?: ReactNode;
  id?: string;
  className?: string;
  children:
    | ReactElement<FormControlProps>
    | ((props: FormControlProps) => ReactNode);
}) {
  const autoId = useId();
  const element = typeof children === "function" ? null : children;
  const controlId = id ?? element?.props.id ?? `field-${autoId}`;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy =
    [element?.props["aria-describedby"], errorId, helpId]
      .filter(Boolean)
      .join(" ") || undefined;

  const controlProps: FormControlProps = {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : element?.props["aria-invalid"],
    "aria-required": required || undefined,
  };

  const control =
    typeof children === "function"
      ? children(controlProps)
      : isValidElement(children)
        ? cloneElement(children, controlProps)
        : children;

  return (
    <div className={cn("grid gap-2", className)} data-invalid={error ? "" : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={controlId} className="text-base font-medium">
          {label}
          {required ? (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
          {optional ? (
            <span className="font-normal text-muted-foreground"> (optional)</span>
          ) : null}
        </Label>
        {counter ? (
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {counter}
          </span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {help ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
