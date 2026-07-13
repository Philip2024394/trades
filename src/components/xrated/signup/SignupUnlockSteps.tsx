"use client";

// SignupUnlockSteps — reward-framed progress card.
//
// Replaces the earlier "4 sections to fill" framing with "4 free
// things you're picking up." Kahneman + Tversky Prospect Theory:
// gain-framing outperforms loss-framing on commitment tasks by ~30%.
//
// Each step ticks green when the corresponding form section is
// meaningfully filled. Detection uses a section-header text match on
// the surrounding form — TradeOffForm doesn't expose `name`
// attributes but its <Section> primitive renders <h2> titles ("Your
// trade & app URL", "Identity", "Location details", "Contact",
// "About you") that we can grep the DOM for. Any non-empty input
// inside that section counts as "filled" for that step. Same pattern
// as SignupDraftTicker: reach into the DOM rather than plumb through
// the 2347-line form's state graph.

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Circle, Gift, Sparkles } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

// Row-flash + toast keyframes. Every unlock does two things:
//   1. The row itself flashes brand-yellow → settles into mint-green
//   2. A "GRANTED" toast slides in above the card for 3.5s
// Respects prefers-reduced-motion by skipping the animations entirely.
const UNLOCK_CSS = `
@keyframes unlock-flash {
  0%   { background-color: rgba(255,179,0,0.55); transform: scale(1); }
  40%  { background-color: rgba(255,179,0,0.35); transform: scale(1.012); }
  100% { background-color: rgba(22,101,52,0.05); transform: scale(1); }
}
@keyframes unlock-toast-in {
  0%   { opacity: 0; transform: translateY(-12px) scale(0.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes unlock-toast-out {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
}
@keyframes unlock-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.08); }
}
.unlock-row-flash { animation: unlock-flash 1.4s cubic-bezier(0.4, 0, 0.2, 1); }
.unlock-toast     { animation: unlock-toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.unlock-toast-out { animation: unlock-toast-out 0.3s ease forwards; }
.unlock-pulse     { animation: unlock-pulse 0.6s ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  .unlock-row-flash, .unlock-toast, .unlock-toast-out, .unlock-pulse {
    animation: none;
  }
}
`;

type UnlockStepKey = "app" | "canteen" | "url" | "access";

type UnlockDef = {
  key: UnlockStepKey;
  title: string;
  subtitle: string;
  /** Section titles (as rendered in the form's <h2>) that ALL must
   *  have at least one filled input for this step to tick. */
  requiredSectionTitles: string[];
  /** Optional minimum character count applied to the LAST input in
   *  the last section (used for the bio requirement — a 60-char
   *  minimum reads as intentional writing, not just "typed anything"). */
  minChars?: number;
};

const UNLOCKS: readonly UnlockDef[] = [
  {
    key: "app",
    title: "Your free business app",
    subtitle: "Studio to design it, App Warehouse to install features",
    requiredSectionTitles: ["Your trade & app URL"]
  },
  {
    key: "canteen",
    title: "Your free canteen",
    subtitle: "Your trade's private group — real people, real chat",
    requiredSectionTitles: ["Identity"]
  },
  {
    key: "url",
    title: "Your free URL, live",
    subtitle: "thenetworkers.app/your-name — screenshot it, put it on your van",
    requiredSectionTitles: ["Location details", "Contact"]
  },
  {
    key: "access",
    title: "Free access to The Yard + Trade Center",
    subtitle: "Trades-only jobs, cross-syndicated products, zero commission",
    requiredSectionTitles: ["About you"],
    minChars: 60
  }
] as const;

function findSectionByTitle(form: HTMLFormElement, title: string): HTMLElement | null {
  const headings = form.querySelectorAll("h2");
  for (const h of Array.from(headings)) {
    if ((h.textContent ?? "").trim() === title) {
      return h.closest("section") as HTMLElement | null;
    }
  }
  return null;
}

function sectionHasFilledInputs(section: HTMLElement, minChars?: number): boolean {
  const inputs = section.querySelectorAll("input, textarea, select");
  for (const el of Array.from(inputs)) {
    const value = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ?? "";
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      if (minChars === undefined || trimmed.length >= minChars) return true;
    }
  }
  return false;
}

export function SignupUnlockSteps() {
  const [unlocked, setUnlocked] = useState<Set<UnlockStepKey>>(new Set());
  // Which step just flipped from locked → unlocked. Triggers the row
  // flash animation + the "GRANTED" toast overlay. Cleared 3.5s later
  // so the toast can fade out and the row settles into its resting
  // unlocked state.
  const [justUnlocked, setJustUnlocked] = useState<UnlockStepKey | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const prevUnlockedRef = useRef<Set<UnlockStepKey>>(new Set());

  useEffect(() => {
    const form = document.querySelector("form");
    if (!form) return;

    const compute = () => {
      const nextUnlocked = new Set<UnlockStepKey>();
      for (const step of UNLOCKS) {
        const allFilled = step.requiredSectionTitles.every((title, i) => {
          const section = findSectionByTitle(form, title);
          if (!section) return false;
          // Apply the minChars floor only to the LAST section (bio).
          const isLast = i === step.requiredSectionTitles.length - 1;
          return sectionHasFilledInputs(section, isLast ? step.minChars : undefined);
        });
        if (allFilled) nextUnlocked.add(step.key);
      }
      // Detect the NEWLY-unlocked step (there can only be one per
      // input event because compute() is fired on each keystroke).
      for (const step of UNLOCKS) {
        if (nextUnlocked.has(step.key) && !prevUnlockedRef.current.has(step.key)) {
          setJustUnlocked(step.key);
          setToastLeaving(false);
          break;
        }
      }
      prevUnlockedRef.current = nextUnlocked;
      setUnlocked(nextUnlocked);
    };

    compute();
    form.addEventListener("input", compute);
    form.addEventListener("change", compute);
    return () => {
      form.removeEventListener("input", compute);
      form.removeEventListener("change", compute);
    };
  }, []);

  // Auto-dismiss the celebration toast after 3.5 seconds (300ms
  // fade-out + 3.2s hold). Clears justUnlocked so the row flash class
  // is removed and the row settles into resting green state.
  useEffect(() => {
    if (!justUnlocked) return;
    const holdT = setTimeout(() => setToastLeaving(true), 3200);
    const clearT = setTimeout(() => {
      setJustUnlocked(null);
      setToastLeaving(false);
    }, 3500);
    return () => {
      clearTimeout(holdT);
      clearTimeout(clearT);
    };
  }, [justUnlocked]);

  const unlockedCount = unlocked.size;
  const totalCount = UNLOCKS.length;
  const justUnlockedDef = justUnlocked ? UNLOCKS.find((u) => u.key === justUnlocked) : null;

  return (
    <section
      className="relative mb-4 overflow-visible rounded-xl border-2 shadow-sm"
      style={{
        borderColor: BRAND_YELLOW,
        background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
      }}
    >
      <style>{UNLOCK_CSS}</style>

      {/* Celebration toast — pops above the card when a step just
          unlocked. Big yellow chip with a Gift icon + step title +
          "Yours free" tag so the user physically feels they picked up
          a reward, not just ticked a to-do. */}
      {justUnlockedDef && (
        <div
          className={`pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 ${toastLeaving ? "unlock-toast-out" : "unlock-toast"}`}
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-2 rounded-full border-2 px-4 py-2 shadow-xl"
            style={{
              borderColor: BRAND_BLACK,
              backgroundColor: BRAND_YELLOW,
              color: BRAND_BLACK
            }}
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full shadow-inner"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              <Gift size={13} color={BRAND_YELLOW} strokeWidth={2.5}/>
            </div>
            <div className="text-left leading-tight">
              <div className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_BLACK, opacity: 0.7 }}>
                Unlocked · Yours free
              </div>
              <div className="text-[13px] font-black" style={{ color: BRAND_BLACK }}>
                {justUnlockedDef.title}
              </div>
            </div>
            <Sparkles size={14} color={BRAND_BLACK} strokeWidth={2.5} className="unlock-pulse flex-shrink-0"/>
          </div>
        </div>
      )}
      {/* Header — Join Thenetworkers + unlock counter */}
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: "1px solid rgba(139,69,19,0.10)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: BRAND_YELLOW }}
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-700">
              Join Thenetworkers
            </div>
            <div className="text-[13px] font-black text-neutral-900">
              Your 4 free unlocks
            </div>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: unlockedCount === totalCount ? BRAND_GREEN_DARK : `${BRAND_BLACK}0F`,
            color: unlockedCount === totalCount ? "#FFFFFF" : BRAND_BLACK
          }}
        >
          {unlockedCount}/{totalCount} unlocked
        </span>
      </div>

      {/* Unlock rows */}
      <ul className="flex flex-col">
        {UNLOCKS.map((step, i) => (
          <UnlockRow
            key={step.key}
            index={i + 1}
            title={step.title}
            subtitle={step.subtitle}
            unlocked={unlocked.has(step.key)}
            justUnlocked={justUnlocked === step.key}
            isLast={i === UNLOCKS.length - 1}
          />
        ))}
      </ul>

      {/* Footer nudge — visible reassurance that FREE means FREE */}
      <div
        className="border-t px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-500"
        style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FAFAFA" }}
      >
        No card. No commission. Free for life. Save as draft any time.
      </div>
    </section>
  );
}

function UnlockRow({
  index,
  title,
  subtitle,
  unlocked,
  justUnlocked,
  isLast
}: {
  index: number;
  title: string;
  subtitle: string;
  unlocked: boolean;
  justUnlocked: boolean;
  isLast: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 transition ${justUnlocked ? "unlock-row-flash" : ""}`}
      style={{
        borderBottom: isLast ? undefined : "1px solid rgba(139,69,19,0.06)",
        backgroundColor: unlocked && !justUnlocked ? `${BRAND_GREEN_DARK}0A` : "transparent"
      }}
    >
      <div className="mt-0.5 flex-shrink-0">
        {unlocked ? (
          <CircleCheck
            size={22}
            color="#FFFFFF"
            strokeWidth={2.5}
            fill={BRAND_GREEN_DARK}
            className={justUnlocked ? "unlock-pulse" : ""}
          />
        ) : (
          <Circle size={22} color="#A3A3A3" strokeWidth={2}/>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: unlocked ? BRAND_GREEN_DARK : "#737373" }}
          >
            Step {index}
          </span>
          <span
            className="rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider"
            style={{
              backgroundColor: BRAND_YELLOW,
              color: BRAND_BLACK
            }}
          >
            Free
          </span>
          {/* Persistent "GRANTED" chip appears next to Step N once a
              row has been unlocked. Stays there for the rest of the
              session so the user feels they OWN the reward, not just
              ticked a to-do off. */}
          {unlocked && (
            <span
              className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <Gift size={8} strokeWidth={2.5}/>
              Granted
            </span>
          )}
        </div>
        <div
          className="mt-0.5 text-[13px] font-black leading-tight"
          style={{
            color: unlocked ? BRAND_GREEN_DARK : "#0A0A0A"
          }}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
          {subtitle}
        </div>
      </div>
    </li>
  );
}
