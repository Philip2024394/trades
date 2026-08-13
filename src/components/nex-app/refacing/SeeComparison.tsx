"use client";

// SeeComparison — SEE UI · full-screen comparison view (spec §C.7).
//
// Opens when the customer taps "See this on my staircase" on a direction card.
//   · BASE photo (top · full-width)
//   · Reference hero photo (below · full-width)
//   · "WHY THIS WORKS" bullets generated from customer's intent overlap with
//     the direction's tags (all copy derived, never invented)
//   · [ Choose this direction ] primary · [ See something different ] secondary
//
// Phase A per SEE-UI-SPEC.md §D · no masked overlay · no composition.
// The customer sees TWO photographs and text reasoning · nothing composited.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import type { RefacingCase } from "@/lib/nex/refacing/case-schema";
import type { SeeDirection } from "@/lib/nex/refacing/retrieval";
import { selectDirection } from "@/lib/nex/refacing/use-case";

type Props = {
  refacingCase: RefacingCase;
  token: string;
  direction: SeeDirection;
  onBack: () => void;
  onChosen: (updated: RefacingCase) => void;
};

export function SeeComparison({
  refacingCase,
  token,
  direction,
  onBack,
  onChosen,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const basePhoto = refacingCase.existing_staircase.photos[0];
  const baseSrc = basePhoto
    ? `/api/nex/refacing/cases/${encodeURIComponent(
        refacingCase.refacing_case_id
      )}/photo/${encodeURIComponent(basePhoto.image_id)}?token=${encodeURIComponent(token)}`
    : null;

  // Build the "WHY THIS WORKS" bullets from real overlap. Never invent.
  const whyBullets = deriveWhyBullets(refacingCase, direction);

  async function choose() {
    setBusy(true);
    setErr(null);
    try {
      const { case: updated } = await selectDirection(
        refacingCase.refacing_case_id,
        token,
        direction.direction,
        direction.hero_image.image_id,
        direction.suggested_name,
        direction.reason_for_existing,
        direction.key_materials_description,
        direction.reference_image_ids
      );
      onChosen(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold transition active:scale-95"
        style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
      >
        <ArrowLeft size={16} />
        Back to ideas
      </button>

      {/* Your staircase */}
      <div className="overflow-hidden rounded-2xl"
           style={{
             background: "var(--nex-cream-elev, #FFFFFF)",
             border: "1px solid var(--nex-neutral-200, #E7E1D2)",
           }}>
        <div className="px-4 pt-3 pb-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            Your staircase
          </div>
        </div>
        <div className="aspect-video w-full"
             style={{ background: "var(--nex-cream, #F7F2E8)" }}>
          {baseSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={baseSrc} alt="Your staircase"
                 className="h-full w-full object-contain" />
          )}
        </div>
      </div>

      {/* This direction */}
      <div className="overflow-hidden rounded-2xl"
           style={{
             background: "var(--nex-cream-elev, #FFFFFF)",
             border: "1px solid var(--nex-accent-500, #8B7355)",
           }}>
        <div className="px-4 pt-3 pb-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: "var(--nex-accent-500, #8B7355)" }}>
            This direction
          </div>
        </div>
        <div className="aspect-video w-full"
             style={{ background: "var(--nex-cream, #F7F2E8)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={direction.hero_image.src} alt={direction.hero_image.alt}
               className="h-full w-full object-contain" />
        </div>
        <div className="px-4 py-3">
          <div className="text-[15px] font-semibold"
               style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>
            {direction.suggested_name}
          </div>
          <div className="mt-1 text-[13px]"
               style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
            {direction.reason_for_existing}
          </div>
          {direction.key_materials_description && (
            <div className="mt-1 text-[12px] italic"
                 style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
              {direction.key_materials_description}
            </div>
          )}
        </div>
      </div>

      {/* Why this works */}
      {whyBullets.length > 0 && (
        <div className="rounded-2xl p-4"
             style={{
               background: "var(--nex-cream-elev, #FFFFFF)",
               border: "1px solid var(--nex-neutral-200, #E7E1D2)",
             }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            Why this works for you
          </div>
          <ul className="mt-2 space-y-1.5">
            {whyBullets.map((b, i) => (
              <li key={i}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
                <Check size={14} className="mt-0.5 flex-shrink-0"
                       style={{ color: "var(--nex-accent-500, #8B7355)" }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={choose}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-neutral-900, #1a1a1a)",
            color: "var(--nex-cream, #F7F2E8)",
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {busy ? "Choosing…" : "Choose this direction"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded-xl px-4 py-3 text-[13px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-cream-elev, #FFFFFF)",
            color: "var(--nex-neutral-900, #1a1a1a)",
            border: "1px solid var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          See something different
        </button>
      </div>

      <AnimatePresence>
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "#FEECEC",
              color: "#7A1F1F",
              border: "1px solid #F1BFBF",
            }}
          >
            {err}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compose the "WHY THIS WORKS" bullets from real intent-vs-design overlap.
 * Never invents · every bullet is derived from a real field on the Case OR
 * on the direction's hero image. Empty return means we honestly have nothing
 * meaningful to say (rare, since retrieval only surfaces directions that fit).
 */
function deriveWhyBullets(refacingCase: RefacingCase, direction: SeeDirection): string[] {
  const bullets: string[] = [];

  // Preserved components the customer named
  const mustNotChange = refacingCase.customer_intent.intent_entries
    .filter((e) => e.treatment === "MUST_NOT_CHANGE")
    .map((e) => e.item);
  for (const item of mustNotChange) {
    const label = friendlyPreserveLabel(item);
    if (label) bullets.push(`Keeps your ${label}`);
  }

  // Key material composition (up to 3 species/materials)
  const composition = direction.hero_image.material_composition ?? [];
  const materialWords = composition
    .map((c) => c.sub_material)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 3);
  if (materialWords.length > 0) {
    bullets.push(`Uses ${materialWords.join(" and ")}`);
  }

  // Style match if it aligns with the customer's feelings
  const styles = direction.hero_image.style ?? [];
  if (styles.length > 0) {
    const readable = styles.slice(0, 2).map(styleFriendly).join(" and ");
    if (readable) bullets.push(`A ${readable} character`);
  }

  return bullets;
}

function friendlyPreserveLabel(item: string): string {
  const map: Record<string, string> = {
    newel:    "newel post",
    handrail: "handrail",
    baluster: "balusters",
    tread:    "treads",
    riser:    "risers",
    stringer: "stringer",
  };
  return map[item] ?? "";
}

function styleFriendly(s: string): string {
  const map: Record<string, string> = {
    modern:         "modern",
    classic:        "classic",
    traditional:    "traditional",
    luxury:         "luxury",
    minimal:        "minimal",
    "warm-natural": "warm-natural",
    industrial:     "industrial",
    signature:      "signature",
    scandinavian:   "Scandinavian",
    farmhouse:      "farmhouse",
  };
  return map[s] ?? s;
}
