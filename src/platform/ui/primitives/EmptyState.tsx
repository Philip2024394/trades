// EmptyState — universal empty pattern.
//
// Icon → title → description → optional action. Consistent look
// across every "nothing to show" surface (empty backlog, no
// projects, no reviews, no leads yet).

import type { ComponentType, ReactNode } from "react";
import { SurfaceCard } from "./SurfaceCard";

export type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "primary" | "success" | "warning" | "info";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "primary"
}: EmptyStateProps) {
  return (
    <SurfaceCard variant={variant === "primary" ? "secondary" : variant} padding="lg">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-1 text-[14px] font-semibold text-neutral-900">
          {title}
        </div>
        {description ? (
          <p className="max-w-md text-[13px] text-neutral-600">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </SurfaceCard>
  );
}
