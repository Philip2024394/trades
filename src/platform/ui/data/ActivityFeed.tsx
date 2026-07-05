// ActivityFeed — vertical timeline of activity items.
//
// Used for merchant dashboards ("Sarah quoted for fire doors, 3h ago")
// + coach activity ("Coach recommended: publish town pages").

import type { ComponentType, ReactNode } from "react";

export type ActivityFeedItem = {
  key: string;
  icon: ComponentType<{ className?: string }>;
  /** Colour tone for the icon dot. */
  tone?: "neutral" | "amber" | "emerald" | "blue" | "red";
  title: string;
  /** Body content — can be plain string or rich node. */
  body?: ReactNode;
  timestamp?: string;
  /** Optional action link. */
  action?: { label: string; onClick?: () => void; href?: string };
};

const TONE_CLASS: Record<
  NonNullable<ActivityFeedItem["tone"]>,
  string
> = {
  neutral: "bg-neutral-200 text-neutral-700",
  amber: "bg-amber-200 text-amber-800",
  emerald: "bg-emerald-200 text-emerald-800",
  blue: "bg-blue-200 text-blue-800",
  red: "bg-red-200 text-red-800"
};

export type ActivityFeedProps = {
  items: readonly ActivityFeedItem[];
  emptyState?: ReactNode;
};

export function ActivityFeed({ items, emptyState }: ActivityFeedProps) {
  if (!items.length && emptyState) return <>{emptyState}</>;
  return (
    <ol className="relative flex flex-col gap-4">
      {items.map((item, i) => {
        const Icon = item.icon;
        const isLast = i === items.length - 1;
        return (
          <li key={item.key} className="relative flex gap-3">
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[item.tone ?? "neutral"]}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {!isLast ? (
                <span className="mt-1 w-px flex-1 bg-neutral-200" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[13px] font-medium text-neutral-900">
                  {item.title}
                </div>
                {item.timestamp ? (
                  <div className="text-[11px] text-neutral-500">
                    {item.timestamp}
                  </div>
                ) : null}
              </div>
              {item.body ? (
                <div className="mt-1 text-[12px] leading-relaxed text-neutral-700">
                  {item.body}
                </div>
              ) : null}
              {item.action ? (
                <div className="mt-1.5">
                  {item.action.href ? (
                    <a
                      href={item.action.href}
                      className="text-[12px] font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {item.action.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={item.action.onClick}
                      className="text-[12px] font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
