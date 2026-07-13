// Shared join-wizard chrome — used by every step of the /join flow
// (/join/start, /join/contact, /join/done).
//
// Post-July 2026 master-brand rebrand: the earlier "Construction
// Notebook · For trades" eyebrow is retired; this shell now:
//   - Renders the canonical XratedHeader (yellow-dot + "The Network"
//     wordmark) so joiners can navigate to Yard/Warehouse/Trade News
//     from within the wizard without feeling isolated
//   - Uses "Join The Network" eyebrow
//   - Displays the 4 free unlocks strip so the trades see what they're
//     picking up at every step, not just "step 1 of 3"
//
// See project_thenetwork_domain_option.md for the master brand rule.

import Link from "next/link";
import { ChevronLeft, ShieldCheck, MessageCircle, Sparkles } from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";

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
      <XratedHeader />

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
        {/* Free-unlocks strip — sits above the step nav so joiners see
            what they're picking up before they see how many steps
            remain. Same 4 unlocks the SignupUnlockSteps card shows on
            the flat form. */}
        <div
          className="mb-6 rounded-2xl border-2 p-4 shadow-sm"
          style={{
            borderColor: "#FFB300",
            background: "linear-gradient(135deg, rgba(255,179,0,0.18) 0%, #FFFFFF 60%)"
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              <span
                className="block h-3 w-3 rounded-full"
                style={{ backgroundColor: "#FFB300" }}
                aria-hidden
              />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1B1A17]/70">
                Join The Network
              </div>
              <div className="text-[13px] font-black text-[#1B1A17]">
                4 free unlocks · Free for life
              </div>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-black uppercase tracking-wider text-[#1B1A17]/80">
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color="#FFB300" strokeWidth={2.5}/>
              Free business app
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color="#FFB300" strokeWidth={2.5}/>
              Free canteen
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color="#FFB300" strokeWidth={2.5}/>
              Free URL live
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color="#FFB300" strokeWidth={2.5}/>
              Free Yard + Trade Center
            </li>
          </ul>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[10px] font-black uppercase tracking-wider text-[#1B1A17]/50" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <li className="inline-flex items-center gap-1">
              <ShieldCheck size={10} color="#166534" strokeWidth={2.5}/>
              No card · No commission
            </li>
            <li className="inline-flex items-center gap-1">
              <MessageCircle size={10} color="#166534" strokeWidth={2.5}/>
              Customers WhatsApp you direct
            </li>
          </ul>
        </div>

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

        <div className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            aria-hidden
          />
          The Network · For trades
        </div>

        <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight md:text-[42px]">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          {subtitle}
        </p>

        <div className="mt-10">{children}</div>
      </div>

      <XratedFooter />
    </main>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30";

export const labelClass =
  "text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60";
