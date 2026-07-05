// shadcn/ui — Badge primitive.
//
// The workhorse chip for eyebrows, trust labels, category chips.
// Every rebuilt hero uses this for the top eyebrow chip.

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:brightness-105",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:brightness-95",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:brightness-105",
        outline: "border-border text-foreground",
        // Xrated signature chip — tinted accent background + accent
        // border + accent text. Used as eyebrow / trust chip on every
        // rebuilt hero.
        accent:
          "border-primary/40 bg-primary/10 text-primary [&_svg]:text-primary"
      },
      size: {
        default: "h-6 px-3 text-[10px] tracking-[0.22em]",
        sm: "h-5 px-2 text-[9px] tracking-widest",
        lg: "h-7 px-3.5 text-[11px] tracking-[0.22em]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
