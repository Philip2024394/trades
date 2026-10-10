"use client";

// src/app/nex-native/_submit-button.tsx
//
// Wave 10 · mobile-readiness · Server-Action-aware submit button that
// disables itself while the surrounding form's action is pending.
// Prevents mobile users double-tapping and producing duplicate
// submissions on Server Actions like signInAction, signUpAction,
// createBusinessAction and postMessageAction.
//
// Meets iOS HIG 44 pt touch-target: `min-h-[44px]` + generous
// horizontal padding. Renders a pending label + spinner when the
// enclosing form is in flight.

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<SubmitButtonProps["variant"]>, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-500",
  secondary: "bg-neutral-700 text-white hover:bg-neutral-500 disabled:bg-neutral-400",
};

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  fullWidth = false,
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const text = pending ? pendingLabel ?? `${label}…` : label;
  return (
    <button
      type="submit"
      aria-disabled={pending}
      disabled={pending}
      className={`${fullWidth ? "w-full" : ""} inline-flex min-h-[44px] items-center justify-center rounded px-4 py-2 text-sm font-medium ${VARIANT_CLASSES[variant]} disabled:cursor-wait ${className}`.trim()}
    >
      {pending && (
        <span
          className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-white"
          aria-hidden
        />
      )}
      {text}
    </button>
  );
}
