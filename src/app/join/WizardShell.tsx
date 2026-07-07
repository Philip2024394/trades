// Shared trade-join wizard chrome — same design language as the
// project wizard but sized for 3 steps.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const STEPS = [
  { key: "start", label: "Business" },
  { key: "contact", label: "Contact" },
  { key: "done", label: "Done" }
];

export function WizardShell({
  step,
  backHref,
  title,
  subtitle,
  children
}: {
  step: "start" | "contact" | "done";
  backHref?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const stepNumber = stepIndex + 1;

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.18) 0%, transparent 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 39px, #ffffff 40px)",
          backgroundSize: "100% 40px"
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 py-8 md:px-8 md:py-12">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref ?? "/"}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <div className="text-[13px] font-mono text-[#1B1A17]/55">
            Step {stepNumber} of {STEPS.length}
          </div>
        </div>

        <div className="mt-4 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-amber-400" : "bg-[#1B1A17]/5"
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            aria-hidden
          />
          The Construction Notebook · For trades
        </div>

        <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight md:text-[42px]">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          {subtitle}
        </p>

        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30";

export const labelClass =
  "text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60";
