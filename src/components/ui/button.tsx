// shadcn/ui — Button primitive.
//
// Radix Slot for `asChild` polymorphism; class-variance-authority for
// typed variant + size props. All variants read from the shadcn CSS
// variable theme so brand-picker changes flow through automatically.

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.35),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-105 active:scale-[0.98]",
        outline:
          "border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:brightness-95",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Signature Xrated CTA — accent-tinted border + accent text.
        // Reads as premium-ghost. Perfect secondary next to `default`.
        accentGhost:
          "border-2 border-primary text-primary bg-background hover:bg-primary/5 active:scale-[0.98]"
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5 text-[13px] font-extrabold uppercase tracking-widest",
        // xl = the signature CTA size. h-14 (56px) always — no thin
        // mobile variant. Padding scales up on tablet+ for more
        // breathing room; on mobile stays px-4 so long uppercase
        // labels still fit a 375px viewport.
        xl: "h-14 px-4 text-[13px] font-extrabold uppercase tracking-widest sm:px-7",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
