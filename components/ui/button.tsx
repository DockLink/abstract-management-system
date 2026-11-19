import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // Sizes: `default`, `lg` and `icon` are always ≥ 44px. `sm`/`xs` are dense
  // desktop sizes that grow to 44px on touch screens (pointer-coarse).
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border bg-background text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_7%)] aria-expanded:bg-secondary",
        ghost: "text-foreground hover:bg-muted aria-expanded:bg-muted",
        /** Quiet destructive (row actions). Use `danger` for the confirming action. */
        destructive:
          "bg-danger-tint text-danger-foreground hover:bg-[color-mix(in_oklch,var(--danger-tint),var(--danger)_14%)] focus-visible:ring-danger/30",
        danger:
          "bg-danger-solid text-danger-solid-foreground hover:bg-[color-mix(in_oklch,var(--danger-solid),black_12%)] focus-visible:ring-danger/35",
        link: "text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-control gap-2 px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 gap-1 px-2 text-xs pointer-coarse:h-control pointer-coarse:px-3 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-control-sm gap-1.5 px-3 text-sm pointer-coarse:h-control has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-control",
        "icon-xs":
          "size-8 pointer-coarse:size-control [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-control-sm pointer-coarse:size-control",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
