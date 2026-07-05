// Alert — inline informational banner.
//
// Four intents: info / warning / success / danger. Optional icon
// override (defaults to lucide semantic icon).

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { CARD_RADIUS } from "../tokens";

export type AlertIntent = "info" | "warning" | "success" | "danger";

const INTENT_META: Record<
  AlertIntent,
  { icon: ComponentType<{ className?: string }>; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-900",
    iconClass: "text-blue-600"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-900",
    iconClass: "text-amber-600"
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    iconClass: "text-emerald-600"
  },
  danger: {
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-900",
    iconClass: "text-red-600"
  }
};

export type AlertProps = {
  intent?: AlertIntent;
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  children?: ReactNode;
  /** Optional trailing action — usually a small text link or button. */
  action?: ReactNode;
};

export function Alert({
  intent = "info",
  icon,
  title,
  children,
  action
}: AlertProps) {
  const meta = INTENT_META[intent];
  const Icon = icon ?? meta.icon;
  return (
    <div className={`flex items-start gap-3 border p-3 md:p-4 ${CARD_RADIUS} ${meta.className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClass}`} />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 text-[13px]">{action}</div> : null}
    </div>
  );
}
