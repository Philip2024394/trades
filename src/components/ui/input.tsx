// shadcn/ui · Input — native input with theme-aware styling + error state.

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** True when the field has a validation error — swaps border colour
   *  + adds aria-invalid. */
  error?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        aria-invalid={error || props["aria-invalid"]}
        className={cn(
          "flex h-11 w-full rounded-md border bg-background px-3 py-2 text-body-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-body-sm file:font-bold",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive" : "border-border",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
