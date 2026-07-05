// StatsBand — 3-4 large-number callouts inline.
//
// Perfect for "15 years / 800 jobs / 5★ rating / 100% guarantee" strips.
// Grid density is stats-3 on mobile (3 tight columns) growing to
// 4 on desktop when 4 stats are supplied.

import type { ComponentType } from "react";

export type Stat = {
  value: string | number;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  suffix?: string;
};

export type StatsBandProps = {
  stats: readonly Stat[];
  variant?: "light" | "dark" | "muted";
};

export function StatsBand({ stats, variant = "muted" }: StatsBandProps) {
  const surface =
    variant === "dark"
      ? "bg-neutral-900 text-white"
      : variant === "muted"
      ? "bg-neutral-50"
      : "bg-white";
  const valueColor =
    variant === "dark" ? "text-white" : "text-neutral-900";
  const labelColor =
    variant === "dark" ? "text-neutral-400" : "text-neutral-500";
  const iconBg =
    variant === "dark" ? "bg-white/10" : "bg-white";
  const iconColor =
    variant === "dark" ? "text-amber-300" : "text-amber-600";

  const cols = stats.length <= 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <section className={`${surface} py-8 md:py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <div className={`grid gap-3 md:gap-6 ${cols}`}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1 text-center md:gap-2"
              >
                {Icon ? (
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg} ${iconColor} md:h-11 md:w-11`}
                  >
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                ) : null}
                <div className={`text-[24px] font-bold leading-none md:text-[36px] ${valueColor}`}>
                  {stat.value}
                  {stat.suffix ? (
                    <span className="ml-0.5 text-[16px] font-semibold md:text-[22px]">
                      {stat.suffix}
                    </span>
                  ) : null}
                </div>
                <div className={`text-[11px] font-medium uppercase tracking-wide md:text-[12px] ${labelColor}`}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
