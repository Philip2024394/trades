// TrustBar — horizontal strip of trust badges / accreditations /
// review-site logos. Small primitive, big credibility boost.
//
// Layout: overline label + horizontally-scrolling row on mobile,
// justify-around row on desktop.

import type { ComponentType, ReactNode } from "react";

export type TrustBadge = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Optional custom render — for actual logo SVGs. */
  render?: () => ReactNode;
};

export type TrustBarProps = {
  overline?: string;
  badges: readonly TrustBadge[];
  variant?: "light" | "dark" | "muted";
};

export function TrustBar({ overline, badges, variant = "light" }: TrustBarProps) {
  const surface =
    variant === "dark"
      ? "bg-neutral-900 border-y border-neutral-800 text-white"
      : variant === "muted"
      ? "bg-neutral-50 border-y border-neutral-100"
      : "bg-white border-y border-neutral-100";
  const overlineTone =
    variant === "dark" ? "text-neutral-400" : "text-neutral-500";
  const itemTone =
    variant === "dark"
      ? "text-neutral-300 border-neutral-700"
      : "text-neutral-700 border-neutral-200";
  return (
    <section className={`${surface} py-6 md:py-8`}>
      <div className="mx-auto max-w-6xl px-4">
        {overline ? (
          <div
            className={`mb-3 text-center text-[11px] font-semibold uppercase tracking-wide ${overlineTone}`}
          >
            {overline}
          </div>
        ) : null}
        <div
          className="-mx-4 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto scroll-smooth px-4 pb-1 md:mx-0 md:flex-wrap md:justify-center md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          style={{ scrollbarWidth: "none" }}
        >
          {badges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <div
                key={i}
                className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium md:text-[13px] ${itemTone}`}
              >
                {badge.render ? (
                  badge.render()
                ) : (
                  <>
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    <span>{badge.label}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
