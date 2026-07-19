"use client";

// SiteBookOnboardingModal — first-visit 3-card walkthrough.
//
// Fires once on `/sitebook` if localStorage flag `tn_sb_onboarded`
// isn't set. Three cards explain the loop: post project → invite
// trades → get replies. Dismissed forever on close or after last
// card ("Got it").

import { useEffect, useState } from "react";
import { HardHat, UserPlus, MessageCircle, X, ArrowRight, Check } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";
const STORAGE_KEY  = "tn_sb_onboarded";

const STEPS = [
  {
    icon: HardHat,
    title: "Post your project",
    body:  "Type a subject + a couple of details. Attach photos or a quote if you have one. That's your first post.",
    hint:  "Start with what you need done."
  },
  {
    icon: UserPlus,
    title: "Invite trades",
    body:  "Tap Add trades on the post to pick who sees it. Trades get a WhatsApp link and can reply straight from their phone.",
    hint:  "You control who sees what."
  },
  {
    icon: MessageCircle,
    title: "Get replies + coordinate",
    body:  "Trades reply on the card. Owner and trades can nest replies — no more chasing across 4 WhatsApp threads.",
    hint:  "One card per topic. Zero chaos."
  }
] as const;

export function SiteBookOnboardingModal() {
  const [open, setOpen] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      /* localStorage unavailable — skip onboarding silently */
    }
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const S      = STEPS[step];
  const Icon   = S.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle — mobile only */}
        <div className="mx-auto my-2 h-1 w-10 rounded-full bg-neutral-300 sm:hidden" aria-hidden="true"/>
        {/* Close */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          aria-label="Skip"
        >
          <X size={16}/>
        </button>

        {/* Yellow illustration band */}
        <div className="flex h-40 items-center justify-center" style={{ backgroundColor: "rgba(255,179,0,0.15)" }}>
          <span
            className="inline-flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <Icon size={36} strokeWidth={2.4} className="text-neutral-900"/>
          </span>
        </div>

        {/* Body */}
        <div className="p-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-2 text-[22px] font-black leading-tight text-neutral-900">{S.title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-neutral-700">{S.body}</p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">{S.hint}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="inline-block h-1.5 w-1.5 rounded-full transition"
                style={{ backgroundColor: i === step ? "#0A0A0A" : "rgba(0,0,0,0.15)" }}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex h-9 items-center rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => isLast ? dismiss() : setStep(step + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {isLast
                ? <><Check size={12} strokeWidth={2.6}/> Got it</>
                : <>Next <ArrowRight size={12} strokeWidth={2.6}/></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
