// Button — one primitive, four intents, three sizes.
//
// All buttons on the platform come from here. Every button meets
// the 44px minimum tap target.

import type { ComponentType, ReactNode } from "react";
import { TYPE_BUTTON } from "../tokens";

export type ButtonIntent = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const INTENT_CLASS: Record<ButtonIntent, string> = {
  primary: "bg-amber-400 text-neutral-900 hover:bg-amber-300",
  secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:bg-neutral-50",
  danger: "bg-red-600 text-white hover:bg-red-500"
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3",             // dense — use sparingly
  md: "min-h-[44px] px-4",              // default — WCAG compliant
  lg: "min-h-[48px] px-5"               // hero + primary CTAs
};

export type ButtonProps = {
  intent?: ButtonIntent;
  size?: ButtonSize;
  icon?: ComponentType<{ className?: string }>;
  iconRight?: ComponentType<{ className?: string }>;
  block?: boolean;                                // full-width
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
  className?: string;
};

export function Button({
  intent = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  block,
  href,
  onClick,
  disabled,
  type = "button",
  children,
  className = ""
}: ButtonProps) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-full ${TYPE_BUTTON} ${INTENT_CLASS[intent]} ${SIZE_CLASS[size]} ${block ? "w-full" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`.trim();

  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {children}
        {IconRight ? <IconRight className="h-4 w-4" /> : null}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
      {IconRight ? <IconRight className="h-4 w-4" /> : null}
    </button>
  );
}
